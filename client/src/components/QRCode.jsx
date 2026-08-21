import { useMemo } from 'react';
import { encodeQR } from '../lib/qrcode.js';

/** Renders a real QR code (own encoder — see lib/qrcode.js) as chunky SVG rects. */
export default function QRCode({ text, size = 168, dark = '#14171C', light = 'transparent' }) {
  const { moduleCount, modules } = useMemo(() => encodeQR(text), [text]);
  const quiet = 2;
  const total = moduleCount + quiet * 2;
  const unit = size / total;

  const rects = [];
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (modules[r][c]) {
        rects.push(
          <rect
            key={`${r}-${c}`}
            x={(c + quiet) * unit}
            y={(r + quiet) * unit}
            width={unit}
            height={unit}
          />
        );
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={`QR code linking to ${text}`}
    >
      <rect x="0" y="0" width={size} height={size} fill={light} />
      <g fill={dark}>{rects}</g>
    </svg>
  );
}
