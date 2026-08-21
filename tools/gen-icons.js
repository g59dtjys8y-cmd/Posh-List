// Generates the real app-icon PNGs (192, 512, and a maskable 512 variant)
// recreating the tilted pink shelf-edge ticket + checkmark on the yellow
// squircle, from the Icon.dc.html mockup. Rendered with `sharp` via its
// librsvg-backed SVG rasteriser. Run `npm install` in this directory once,
// then `node gen-icons.js` to regenerate ../client/public/icons/*.png.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'client', 'public', 'icons');
fs.mkdirSync(OUT_DIR, { recursive: true });

const YELLOW = '#FFD400';
const PINK = '#FF2E7E';

// All geometry is expressed in a fixed 160x160 design space (matching the
// mockup 1:1) — sharp rasterises the SVG's viewBox to whatever pixel size
// we ask for, so this stays crisp at every output size.
const S = 160;
const CENTER = S / 2; // 80,80

function ticketAndCheckSvg({ squircle }) {
  const ticketW = 96;
  const ticketH = 78;
  const notch = 11;
  const tx = (S - ticketW) / 2; // 32
  const ty = (S - ticketH) / 2; // 41

  const pt = (x, y) => `${(tx + x).toFixed(2)},${(ty + y).toFixed(2)}`;
  const ticketPath = [
    `M ${pt(0, 0)}`,
    `L ${pt(ticketW, 0)}`,
    `L ${pt(ticketW, ticketH)}`,
    `L ${pt(0, ticketH)}`,
    `L ${pt(0, ticketH * 0.66)}`,
    `L ${pt(notch, ticketH / 2)}`,
    `L ${pt(0, ticketH * 0.34)}`,
    'Z',
  ].join(' ');

  // Checkmark "M5 13l4 4L19 7" from a 24-unit glyph, scaled to a 40x40 box
  // centred on the canvas (matches the mockup's centred 40x40 check icon).
  const glyphBox = 40;
  const scale = glyphBox / 24;
  const gx = CENTER - glyphBox / 2;
  const gy = CENTER - glyphBox / 2;
  const g = (x, y) => `${(gx + x * scale).toFixed(2)},${(gy + y * scale).toFixed(2)}`;
  const checkPath = `M ${g(5, 13)} L ${g(9, 17)} L ${g(19, 7)}`;
  const checkStroke = (3.4 * scale).toFixed(2);

  const bg = squircle
    ? `<rect x="0" y="0" width="${S}" height="${S}" rx="${S * 0.225}" fill="${YELLOW}"/>`
    : `<rect x="0" y="0" width="${S}" height="${S}" fill="${YELLOW}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">
  ${bg}
  <g transform="rotate(-6 ${CENTER} ${CENTER})">
    <path d="${ticketPath}" fill="${PINK}"/>
    <path d="${checkPath}" fill="none" stroke="#FFFFFF" stroke-width="${checkStroke}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

async function render(svg, size, outFile) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(path.join(OUT_DIR, outFile));
  console.log('wrote', outFile, `${size}x${size}`);
}

await render(ticketAndCheckSvg({ squircle: true }), 192, 'icon-192.png');
await render(ticketAndCheckSvg({ squircle: true }), 512, 'icon-512.png');
// Maskable: OS applies its own mask shape, so the safe content needs to sit
// inside the centre ~80% and the background must run edge-to-edge with no
// rounding of its own (a squircle here would double up / get clipped oddly).
await render(ticketAndCheckSvg({ squircle: false }), 512, 'icon-maskable-512.png');

console.log('done');
