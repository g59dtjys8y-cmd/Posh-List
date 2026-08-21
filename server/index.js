import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from './wsServer.js';
import {
  createRoom,
  getRoom,
  roomExists,
  renameRoom,
  setActiveLayout,
  addLayout,
  updateLayout,
  deleteLayout,
  addItem,
  setItemDone,
  deleteItem,
  upsertPerson,
  touchPerson,
} from './db.js';
import { isValidAisleKey, isValidLayoutOrder } from './aisles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;
const PUBLIC_DIR = path.join(__dirname, '..', 'client', 'public');

// ---------------------------------------------------------------------------
// Live presence + broadcast bookkeeping, keyed by room slug.
// ---------------------------------------------------------------------------
const roomSockets = new Map(); // slug -> Set<WSConnection>
const roomPersonCounts = new Map(); // slug -> Map<personId, openSocketCount>

function socketsFor(slug) {
  if (!roomSockets.has(slug)) roomSockets.set(slug, new Set());
  return roomSockets.get(slug);
}
function personCountsFor(slug) {
  if (!roomPersonCounts.has(slug)) roomPersonCounts.set(slug, new Map());
  return roomPersonCounts.get(slug);
}
function connectedPersonIds(slug) {
  return new Set([...personCountsFor(slug).entries()].filter(([, n]) => n > 0).map(([id]) => id));
}
function roomStateWithPresence(slug) {
  const room = getRoom(slug);
  if (!room) return null;
  const connected = connectedPersonIds(slug);
  room.people = room.people.map((p) => ({ ...p, connected: connected.has(p.id) }));
  return room;
}
function broadcast(slug, message) {
  const payload = JSON.stringify(message);
  for (const ws of socketsFor(slug)) {
    if (ws.readyState === 'open') ws.send(payload);
  }
}
function broadcastState(slug) {
  const room = roomStateWithPresence(slug);
  if (room) broadcast(slug, { type: 'state', room });
}

// ---------------------------------------------------------------------------
// Tiny helpers standing in for express: JSON body parsing + static files.
// ---------------------------------------------------------------------------

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function serveStatic(req, res, pathname) {
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  // SPA fallback: any non-file, non-API, non-asset route serves index.html
  // so client-side routes like /r/8fk3q2/share survive a hard refresh.
  const hasExt = path.extname(safePath) !== '';
  if (!hasExt) filePath = path.join(PUBLIC_DIR, 'index.html');

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (hasExt) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, fallback) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(fallback);
      });
      return;
    }
    const ext = path.extname(filePath);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    // The JS bundle changes constantly in dev — never let the browser cache it.
    if (ext === '.js' || ext === '.html') headers['Cache-Control'] = 'no-store';
    res.writeHead(200, headers);
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

async function handleApi(req, res, url) {
  const { pathname } = url;

  if (pathname === '/api/rooms' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const room = createRoom(String(body.name || 'Shopping list').slice(0, 80));
    return sendJson(res, 201, { slug: room.slug });
  }

  const roomMatch = pathname.match(/^\/api\/rooms\/([a-z0-9]+)$/);
  if (roomMatch && req.method === 'GET') {
    const slug = roomMatch[1];
    if (!roomExists(slug)) return sendJson(res, 404, { error: 'Room not found' });
    return sendJson(res, 200, roomStateWithPresence(slug));
  }

  const identifyMatch = pathname.match(/^\/api\/rooms\/([a-z0-9]+)\/identify$/);
  if (identifyMatch && req.method === 'POST') {
    const slug = identifyMatch[1];
    if (!roomExists(slug)) return sendJson(res, 404, { error: 'Room not found' });
    const body = await readJsonBody(req);
    if (!body.name && !body.id) return sendJson(res, 400, { error: 'name required' });
    const person = upsertPerson(slug, {
      id: body.id,
      name: body.name ? String(body.name).slice(0, 40) : undefined,
    });
    return sendJson(res, 200, person);
  }

  sendJson(res, 404, { error: 'Not found' });
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('API error', err);
      sendJson(res, 500, { error: 'Internal error' });
    });
    return;
  }
  serveStatic(req, res, url.pathname);
});

// ---------------------------------------------------------------------------
// WebSocket realtime sync
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const slug = url.searchParams.get('room');
  const personId = url.searchParams.get('personId');
  const name = url.searchParams.get('name');

  if (!slug || !roomExists(slug)) {
    ws.close(4004, 'Room not found');
    return;
  }

  ws.slug = slug;
  ws.personId = personId || null;
  socketsFor(slug).add(ws);

  if (personId) {
    upsertPerson(slug, { id: personId, name: name || undefined });
    const counts = personCountsFor(slug);
    counts.set(personId, (counts.get(personId) || 0) + 1);
  }

  ws.send(JSON.stringify({ type: 'state', room: roomStateWithPresence(slug) }));
  broadcastState(slug);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;
    try {
      handleMessage(ws, slug, msg);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('WS message error', err);
    }
  });

  ws.on('close', () => {
    socketsFor(slug).delete(ws);
    if (ws.personId) {
      const counts = personCountsFor(slug);
      const n = (counts.get(ws.personId) || 1) - 1;
      counts.set(ws.personId, Math.max(0, n));
      touchPerson(slug, ws.personId);
    }
    broadcastState(slug);
  });
});

function handleMessage(ws, slug, msg) {
  switch (msg.type) {
    case 'identify': {
      if (!msg.name && !msg.personId) return;
      const person = upsertPerson(slug, { id: msg.personId, name: msg.name });
      ws.personId = person.id;
      const counts = personCountsFor(slug);
      counts.set(person.id, (counts.get(person.id) || 0) + 1);
      ws.send(JSON.stringify({ type: 'identified', person }));
      broadcastState(slug);
      break;
    }

    case 'add_item': {
      const name = String(msg.name || '').trim().slice(0, 120);
      if (!name) return;
      const aisleKey = isValidAisleKey(msg.aisleKey) ? msg.aisleKey : 'cupboard';
      const qty = Number.isFinite(msg.qty) && msg.qty > 0 ? Math.floor(msg.qty) : 1;
      const itemId = addItem(slug, {
        name,
        qty,
        aisleKey,
        addedBy: msg.addedBy || ws.personId,
        addedColor: msg.addedColor,
      });
      broadcastState(slug);
      broadcast(slug, {
        type: 'item_added',
        item: { id: itemId, name, qty, aisleKey },
        addedByName: msg.addedByName || null,
        fromPersonId: ws.personId,
      });
      break;
    }

    case 'toggle_item': {
      if (!msg.itemId) return;
      setItemDone(slug, msg.itemId, !!msg.done, msg.doneBy || ws.personId);
      broadcastState(slug);
      break;
    }

    case 'delete_item': {
      if (!msg.itemId) return;
      deleteItem(slug, msg.itemId);
      broadcastState(slug);
      break;
    }

    case 'rename_room': {
      if (typeof msg.name !== 'string' || !msg.name.trim()) return;
      renameRoom(slug, msg.name.trim().slice(0, 80));
      broadcastState(slug);
      break;
    }

    case 'add_layout': {
      const name = String(msg.name || '').trim().slice(0, 60) || 'New layout';
      const order = isValidLayoutOrder(msg.order) ? msg.order : null;
      if (!order) return;
      const id = addLayout(slug, name, order);
      if (msg.makeActive) setActiveLayout(slug, id);
      broadcastState(slug);
      break;
    }

    case 'update_layout': {
      if (!msg.layoutId) return;
      const patch = {};
      if (typeof msg.name === 'string' && msg.name.trim()) patch.name = msg.name.trim().slice(0, 60);
      if (isValidLayoutOrder(msg.order)) patch.order = msg.order;
      updateLayout(slug, msg.layoutId, patch);
      broadcastState(slug);
      break;
    }

    case 'delete_layout': {
      if (!msg.layoutId) return;
      deleteLayout(slug, msg.layoutId);
      broadcastState(slug);
      break;
    }

    case 'set_active_layout': {
      if (!msg.layoutId) return;
      setActiveLayout(slug, msg.layoutId);
      broadcastState(slug);
      break;
    }

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    default:
      break;
  }
}

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Posh Shop server listening on http://localhost:${PORT}`);
});
