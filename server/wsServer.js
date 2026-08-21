// A minimal, dependency-free WebSocket server (RFC 6455) standing in for
// the `ws` package — this sandbox has no npm registry access (see the
// project report). It implements exactly what this app needs: the opening
// handshake, unmasked-to-server text frames in and out, close/ping/pong,
// and nothing else (no per-message compression, no fragmentation of
// outgoing frames beyond what fits a single frame — plenty for JSON chat-
// sized payloads).

import { createHash, randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';

const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const OPCODE = {
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa,
};

function acceptKeyFor(clientKey) {
  return createHash('sha1').update(clientKey + WS_MAGIC).digest('base64');
}

function encodeFrame(opcode, payload) {
  const payloadLen = payload.length;
  let header;
  if (payloadLen < 126) {
    header = Buffer.alloc(2);
    header[1] = payloadLen;
  } else if (payloadLen < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(payloadLen, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payloadLen), 2);
  }
  header[0] = 0x80 | opcode; // FIN=1
  return Buffer.concat([header, payload]);
}

class WSConnection extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.readyState = 'open';
    this._buffer = Buffer.alloc(0);
    this._fragments = [];
    this._fragmentOpcode = null;

    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('close', () => this._onClose());
    socket.on('error', () => this._onClose());
  }

  get OPEN() {
    return 'open';
  }

  send(data) {
    if (this.readyState !== 'open') return;
    const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
    try {
      this.socket.write(encodeFrame(OPCODE.TEXT, payload));
    } catch {
      // socket already gone; the close handler will clean up.
    }
  }

  close(code = 1000, reason = '') {
    if (this.readyState !== 'open') return;
    this.readyState = 'closing';
    const reasonBuf = Buffer.from(reason, 'utf8');
    const payload = Buffer.alloc(2 + reasonBuf.length);
    payload.writeUInt16BE(code, 0);
    reasonBuf.copy(payload, 2);
    try {
      this.socket.write(encodeFrame(OPCODE.CLOSE, payload));
    } catch {
      /* ignore */
    }
    this.socket.end();
  }

  _onClose() {
    if (this.readyState === 'closed') return;
    this.readyState = 'closed';
    this.emit('close');
  }

  _onData(chunk) {
    this._buffer = this._buffer.length ? Buffer.concat([this._buffer, chunk]) : chunk;
    // Parse as many complete frames as are sitting in the buffer.
    while (true) {
      const frame = this._tryParseFrame(this._buffer);
      if (!frame) break;
      this._buffer = this._buffer.subarray(frame.totalLength);
      this._handleFrame(frame);
    }
  }

  _tryParseFrame(buf) {
    if (buf.length < 2) return null;
    const fin = (buf[0] & 0x80) !== 0;
    const opcode = buf[0] & 0x0f;
    const masked = (buf[1] & 0x80) !== 0;
    let len = buf[1] & 0x7f;
    let offset = 2;

    if (len === 126) {
      if (buf.length < offset + 2) return null;
      len = buf.readUInt16BE(offset);
      offset += 2;
    } else if (len === 127) {
      if (buf.length < offset + 8) return null;
      len = Number(buf.readBigUInt64BE(offset));
      offset += 8;
    }

    let maskKey = null;
    if (masked) {
      if (buf.length < offset + 4) return null;
      maskKey = buf.subarray(offset, offset + 4);
      offset += 4;
    }

    if (buf.length < offset + len) return null;

    let payload = buf.subarray(offset, offset + len);
    if (masked) {
      const unmasked = Buffer.alloc(len);
      for (let i = 0; i < len; i++) unmasked[i] = payload[i] ^ maskKey[i % 4];
      payload = unmasked;
    }

    return { fin, opcode, payload, totalLength: offset + len };
  }

  _handleFrame(frame) {
    const { fin, opcode, payload } = frame;

    if (opcode === OPCODE.CLOSE) {
      this.readyState = 'closed';
      try {
        this.socket.write(encodeFrame(OPCODE.CLOSE, payload.subarray(0, 2)));
      } catch {
        /* ignore */
      }
      this.socket.end();
      this.emit('close');
      return;
    }
    if (opcode === OPCODE.PING) {
      try {
        this.socket.write(encodeFrame(OPCODE.PONG, payload));
      } catch {
        /* ignore */
      }
      return;
    }
    if (opcode === OPCODE.PONG) return;

    if (opcode === OPCODE.TEXT || opcode === OPCODE.BINARY) {
      this._fragmentOpcode = opcode;
      this._fragments = [payload];
    } else if (opcode === OPCODE.CONTINUATION) {
      this._fragments.push(payload);
    }

    if (fin) {
      const full = Buffer.concat(this._fragments);
      this._fragments = [];
      if (this._fragmentOpcode === OPCODE.TEXT) {
        this.emit('message', full.toString('utf8'));
      }
    }
  }
}

export class WebSocketServer extends EventEmitter {
  constructor({ server, path: wsPath }) {
    super();
    this.path = wsPath;
    server.on('upgrade', (req, socket, head) => {
      this._handleUpgrade(req, socket, head);
    });
  }

  _handleUpgrade(req, socket, head) {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== this.path) {
      socket.destroy();
      return;
    }
    const key = req.headers['sec-websocket-key'];
    if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') {
      socket.destroy();
      return;
    }

    const acceptKey = acceptKeyFor(key);
    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '',
      '',
    ].join('\r\n');

    socket.write(responseHeaders);
    if (head && head.length) socket.unshift(head);

    const conn = new WSConnection(socket);
    this.emit('connection', conn, req);
  }
}

// Unused but kept so the module documents its own primitives cleanly.
export const _internal = { encodeFrame, acceptKeyFor, randomBytes };
