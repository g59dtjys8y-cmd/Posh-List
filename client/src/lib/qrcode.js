// A small, self-contained QR code encoder (ISO/IEC 18004), written from
// scratch because this sandbox has no npm registry access to install the
// `qrcode` package the spec calls for (see the project report). Supports
// byte-mode data, versions 1-6, error-correction level M — comfortably
// enough for a room URL like "https://posh.shop/r/8fk3q2" (version 1-6 at
// level M holds up to 108 raw data bytes). If a caller ever needs more than
// that it throws a clear error rather than silently emitting a broken code.
//
// Verified against a real decoder (OpenCV's QRCodeDetector) during
// development — see server/tools/verify-qr output in the build notes.

const EXP_TABLE = new Array(256);
const LOG_TABLE = new Array(256);
for (let i = 0; i < 8; i++) EXP_TABLE[i] = 1 << i;
for (let i = 8; i < 256; i++) {
  EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
}
for (let i = 0; i < 255; i++) LOG_TABLE[EXP_TABLE[i]] = i;

function gexp(n) {
  while (n < 0) n += 255;
  while (n >= 256) n -= 255;
  return EXP_TABLE[n];
}
function glog(n) {
  if (n < 1) throw new Error('glog(' + n + ')');
  return LOG_TABLE[n];
}

class Polynomial {
  constructor(num, shift = 0) {
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
    for (let i = 0; i < shift; i++) this.num[num.length - offset + i] = 0;
  }
  get(i) {
    return this.num[i];
  }
  get length() {
    return this.num.length;
  }
  multiply(e) {
    const result = new Array(this.length + e.length - 1).fill(0);
    for (let i = 0; i < this.length; i++) {
      for (let j = 0; j < e.length; j++) {
        result[i + j] ^= gexp(glog(this.get(i)) + glog(e.get(j)));
      }
    }
    return new Polynomial(result, 0);
  }
  mod(e) {
    if (this.length - e.length < 0) return this;
    const ratio = glog(this.get(0)) - glog(e.get(0));
    const num = this.num.slice();
    for (let i = 0; i < e.length; i++) {
      num[i] ^= gexp(glog(e.get(i)) + ratio);
    }
    return new Polynomial(num, 0).mod(e);
  }
}

function errorCorrectPolynomial(ecLength) {
  let a = new Polynomial([1], 0);
  for (let i = 0; i < ecLength; i++) a = a.multiply(new Polynomial([1, gexp(i)], 0));
  return a;
}

class BitBuffer {
  constructor() {
    this.buffer = [];
    this.length = 0;
  }
  put(num, length) {
    for (let i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) === 1);
  }
  putBit(bit) {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) this.buffer.push(0);
    if (bit) this.buffer[bufIndex] |= 0x80 >>> this.length % 8;
    this.length++;
  }
}

// Reed-Solomon block layout, error-correction level M, versions 1-6.
// [numBlocks, totalCodewordsPerBlock, dataCodewordsPerBlock]
const RS_BLOCKS_M = {
  1: [[1, 26, 16]],
  2: [[1, 44, 28]],
  3: [[1, 70, 44]],
  4: [[2, 50, 32]],
  5: [[2, 67, 43]],
  6: [[4, 43, 27]],
};
const REMAINDER_BITS = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7 };
// [6, x] -> the one non-overlapping alignment-pattern centre for v2-6 is (x, x).
const ALIGNMENT_POS = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };

function getRSBlocks(version) {
  const table = RS_BLOCKS_M[version];
  const blocks = [];
  for (const [count, totalCount, dataCount] of table) {
    for (let i = 0; i < count; i++) blocks.push({ totalCount, dataCount });
  }
  return blocks;
}

function bestVersion(byteLength) {
  for (let version = 1; version <= 6; version++) {
    const dataCount = getRSBlocks(version).reduce((s, b) => s + b.dataCount, 0);
    // mode(4) + 8-bit byte-mode count indicator + data + 4-bit terminator, in bits.
    const neededBits = 4 + 8 + byteLength * 8 + 4;
    if (neededBits <= dataCount * 8) return version;
  }
  return null;
}

function createDataCodewords(version, bytes) {
  const rsBlocks = getRSBlocks(version);
  const totalDataCount = rsBlocks.reduce((s, b) => s + b.dataCount, 0);

  const buffer = new BitBuffer();
  buffer.put(4, 4); // byte mode
  buffer.put(bytes.length, 8); // count indicator (8 bits: valid for v1-9)
  for (const byte of bytes) buffer.put(byte, 8);

  if (buffer.length + 4 <= totalDataCount * 8) buffer.put(0, 4);
  while (buffer.length % 8 !== 0) buffer.putBit(false);

  const padBytes = [0xec, 0x11];
  let p = 0;
  while (buffer.buffer.length < totalDataCount) {
    buffer.buffer.push(padBytes[p % 2]);
    p++;
  }
  return { dataCodewords: buffer.buffer, rsBlocks };
}

function interleave(dataCodewords, rsBlocks) {
  let offset = 0;
  let maxDc = 0;
  let maxEc = 0;
  const dcData = [];
  const ecData = [];

  for (const block of rsBlocks) {
    const dcCount = block.dataCount;
    const ecCount = block.totalCount - block.dataCount;
    maxDc = Math.max(maxDc, dcCount);
    maxEc = Math.max(maxEc, ecCount);

    const dc = dataCodewords.slice(offset, offset + dcCount);
    offset += dcCount;

    const rsPoly = errorCorrectPolynomial(ecCount);
    const rawPoly = new Polynomial(dc, rsPoly.length - 1);
    const modPoly = rawPoly.mod(rsPoly);
    const ec = new Array(ecCount);
    for (let i = 0; i < ecCount; i++) {
      const modIndex = i + modPoly.length - ecCount;
      ec[i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
    }
    dcData.push(dc);
    ecData.push(ec);
  }

  const totalCount = rsBlocks.reduce((s, b) => s + b.totalCount, 0);
  const result = new Array(totalCount);
  let index = 0;
  for (let i = 0; i < maxDc; i++) {
    for (const dc of dcData) if (i < dc.length) result[index++] = dc[i];
  }
  for (let i = 0; i < maxEc; i++) {
    for (const ec of ecData) if (i < ec.length) result[index++] = ec[i];
  }
  return result;
}

const MASK_FNS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r * c) % 3) + ((r + c) % 2)) % 2 === 0,
];

const G15 = 0x537;
const G15_MASK = 0x5412;
function bchDigitLength(data) {
  let digit = 0;
  let d = data;
  while (d !== 0) {
    digit++;
    d >>>= 1;
  }
  return digit;
}
function bchTypeInfo(data) {
  let d = data << 10;
  while (bchDigitLength(d) - bchDigitLength(G15) >= 0) {
    d ^= G15 << (bchDigitLength(d) - bchDigitLength(G15));
  }
  return ((data << 10) | d) ^ G15_MASK;
}

// EC level indicator bits used inside the 15-bit format string (ISO Table 25).
const EC_LEVEL_BITS = { L: 1, M: 0, Q: 3, H: 2 };

class Matrix {
  constructor(moduleCount) {
    this.moduleCount = moduleCount;
    this.modules = Array.from({ length: moduleCount }, () => new Array(moduleCount).fill(null));
  }
  setupFinder(row, col) {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.moduleCount <= row + r) continue;
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.moduleCount <= col + c) continue;
        const dark =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        this.modules[row + r][col + c] = dark;
      }
    }
  }
  setupTiming() {
    for (let r = 8; r < this.moduleCount - 8; r++) {
      if (this.modules[r][6] !== null) continue;
      this.modules[r][6] = r % 2 === 0;
    }
    for (let c = 8; c < this.moduleCount - 8; c++) {
      if (this.modules[6][c] !== null) continue;
      this.modules[6][c] = c % 2 === 0;
    }
  }
  setupAlignment(version) {
    const pos = ALIGNMENT_POS[version];
    for (const pr of pos) {
      for (const pc of pos) {
        if (this.modules[pr][pc] !== null) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const dark = r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
            this.modules[pr + r][pc + c] = dark;
          }
        }
      }
    }
  }
  setupTypeInfo(test, ecLevel, maskPattern) {
    const data = (EC_LEVEL_BITS[ecLevel] << 3) | maskPattern;
    const bits = bchTypeInfo(data);

    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      if (i < 6) this.modules[i][8] = mod;
      else if (i < 8) this.modules[i + 1][8] = mod;
      else this.modules[this.moduleCount - 15 + i][8] = mod;
    }
    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
      else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
      else this.modules[8][15 - i - 1] = mod;
    }
    this.modules[this.moduleCount - 8][8] = !test;
  }
  mapData(data, maskPattern) {
    let inc = -1;
    let row = this.moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;
    const maskFn = MASK_FNS[maskPattern];

    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] === null) {
            let dark = false;
            if (byteIndex < data.length) {
              dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
            }
            if (maskFn(row, col - c)) dark = !dark;
            this.modules[row][col - c] = dark;
            bitIndex--;
            if (bitIndex === -1) {
              byteIndex++;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if (row < 0 || row >= this.moduleCount) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  }
  clone() {
    const m = new Matrix(this.moduleCount);
    m.modules = this.modules.map((row) => row.slice());
    return m;
  }
}

function lostPoint(matrix) {
  const n = matrix.moduleCount;
  const mods = matrix.modules;
  let lost = 0;

  // Rule 1: runs of same-colour modules, 5+ in a row/col.
  for (let row = 0; row < n; row++) {
    let runColor = mods[row][0];
    let runLen = 1;
    for (let col = 1; col < n; col++) {
      if (mods[row][col] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) lost += 3 + (runLen - 5);
        runColor = mods[row][col];
        runLen = 1;
      }
    }
    if (runLen >= 5) lost += 3 + (runLen - 5);
  }
  for (let col = 0; col < n; col++) {
    let runColor = mods[0][col];
    let runLen = 1;
    for (let row = 1; row < n; row++) {
      if (mods[row][col] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) lost += 3 + (runLen - 5);
        runColor = mods[row][col];
        runLen = 1;
      }
    }
    if (runLen >= 5) lost += 3 + (runLen - 5);
  }

  // Rule 2: 2x2 blocks of the same colour.
  for (let row = 0; row < n - 1; row++) {
    for (let col = 0; col < n - 1; col++) {
      const v = mods[row][col];
      if (v === mods[row][col + 1] && v === mods[row + 1][col] && v === mods[row + 1][col + 1]) {
        lost += 3;
      }
    }
  }

  // Rule 3: 1:1:3:1:1 finder-like patterns.
  const patternA = [true, false, true, true, true, false, true, false, false, false, false];
  const patternB = [false, false, false, false, true, false, true, true, true, false, true];
  const matchesAt = (arr, seq) => {
    for (let i = 0; i < seq.length; i++) if (arr[i] !== seq[i]) return false;
    return true;
  };
  for (let row = 0; row < n; row++) {
    for (let col = 0; col + 11 <= n; col++) {
      const slice = mods[row].slice(col, col + 11);
      if (matchesAt(slice, patternA) || matchesAt(slice, patternB)) lost += 40;
    }
  }
  for (let col = 0; col < n; col++) {
    for (let row = 0; row + 11 <= n; row++) {
      const slice = [];
      for (let k = 0; k < 11; k++) slice.push(mods[row + k][col]);
      if (matchesAt(slice, patternA) || matchesAt(slice, patternB)) lost += 40;
    }
  }

  // Rule 4: proportion of dark modules.
  let dark = 0;
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) if (mods[row][col]) dark++;
  const ratio = (dark / (n * n)) * 100;
  lost += Math.floor(Math.abs(ratio - 50) / 5) * 10;

  return lost;
}

/**
 * Encode `text` (UTF-8) as a QR code matrix.
 * Returns { moduleCount, modules } where modules[row][col] is true (dark)
 * or false (light).
 */
export function encodeQR(text) {
  const bytes = Array.from(new TextEncoder().encode(text));
  const version = bestVersion(bytes.length);
  if (!version) {
    throw new Error('Text too long to encode at QR error-correction level M (versions 1-6)');
  }

  const { dataCodewords, rsBlocks } = createDataCodewords(version, bytes);
  const allCodewords = interleave(dataCodewords, rsBlocks);

  const moduleCount = version * 4 + 17;
  const remainderBits = REMAINDER_BITS[version];

  // Pad the codeword stream with the version's remainder bits (all zero)
  // by simply letting mapData run past the codeword array — it treats any
  // bit index beyond `data.length` bytes as 0, which is exactly right.
  void remainderBits;

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const matrix = new Matrix(moduleCount);
    matrix.setupFinder(0, 0);
    matrix.setupFinder(0, moduleCount - 7);
    matrix.setupFinder(moduleCount - 7, 0);
    matrix.setupTiming();
    matrix.setupAlignment(version);
    matrix.setupTypeInfo(true, 'M', mask);
    matrix.mapData(allCodewords, mask);
    const score = lostPoint(matrix);
    if (!best || score < best.score) best = { score, mask };
  }

  const matrix = new Matrix(moduleCount);
  matrix.setupFinder(0, 0);
  matrix.setupFinder(0, moduleCount - 7);
  matrix.setupFinder(moduleCount - 7, 0);
  matrix.setupTiming();
  matrix.setupAlignment(version);
  matrix.setupTypeInfo(false, 'M', best.mask);
  matrix.mapData(allCodewords, best.mask);

  return { moduleCount, modules: matrix.modules, version };
}
