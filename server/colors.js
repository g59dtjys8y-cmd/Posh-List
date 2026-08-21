// Person-colour generation.
//
// The two seed colours (#0A6CFF, #FF2E7E) are the first two people in any
// room. From the third person on we generate further colours in OKLCH,
// re-using the lightness + chroma of whichever seed colour they're paired
// with and rotating the hue by the golden angle each time round, so colours
// stay visually distinct as a family grows past two people.

const SEED_HEXES = ['#0A6CFF', '#FF2E7E'];
const GOLDEN_ANGLE = 137.508;

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function linearToSrgb(c) {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.abs(c) ** (1 / 2.4) - 0.055;
  return Math.min(1, Math.max(0, v));
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function rgbToHex([r, g, b]) {
  const toHex = (v) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function linearRgbToOklab([r, g, b]) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

function oklabToLinearRgb([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function hexToOklch(hex) {
  const linear = hexToRgb(hex).map(srgbToLinear);
  const [L, a, b] = linearRgbToOklab(linear);
  const C = Math.sqrt(a * a + b * b);
  const H = (Math.atan2(b, a) * 180) / Math.PI;
  return { L, C, H: (H + 360) % 360 };
}

function oklchToHex({ L, C, H }) {
  const rad = (H * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  const linear = oklabToLinearRgb([L, a, b]);
  const srgb = linear.map(linearToSrgb);
  return rgbToHex(srgb);
}

const SEEDS = SEED_HEXES.map(hexToOklch);

/**
 * Deterministic colour for the Nth person to join a room (0-indexed).
 * The first two get the exact seed hexes; every colour after that keeps
 * one seed's lightness/chroma and rotates hue by the golden angle so
 * colours stay spread out and consistent as the family grows.
 */
export function personColorForIndex(index) {
  if (index === 0) return SEED_HEXES[0];
  if (index === 1) return SEED_HEXES[1];
  const family = index % 2;
  const turn = Math.floor((index - 2) / 2) + 1;
  const seed = SEEDS[family];
  const hue = (seed.H + turn * GOLDEN_ANGLE) % 360;
  return oklchToHex({ L: seed.L, C: seed.C, H: hue });
}
