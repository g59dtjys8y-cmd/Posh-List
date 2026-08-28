import { useEffect, useRef, useState } from 'react';
import { encodeQR } from '../lib/qrcode.js';

const W = 1080;
const H = 1350;

function firstName(name) {
  return (name || 'Someone').trim().split(/\s+/)[0];
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Draws the end-of-shop recap onto `canvas`. Hand-rolled 2D canvas, no
 * dependencies — matches the from-scratch QR encoder it reuses. No item
 * names on the card (a shopping list is mildly personal); counts and vibe
 * only.
 */
function drawCard(canvas, { listName, itemCount, aisleCount, minutes, shopperName, shopperColor, url }) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  // Ground
  ctx.fillStyle = '#ffd400';
  ctx.fillRect(0, 0, W, H);

  const pad = 96;
  const ink = '#14171c';
  const pink = '#ff2e7e';

  // Wordmark
  ctx.fillStyle = ink;
  ctx.font = '800 34px "Big Shoulders Display", system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.save();
  ctx.translate(pad, 150);
  ctx.fillText('P O S H   L I S T', 0, 0);
  ctx.restore();

  // "shop done" pink shelf-ticket
  const ticketY = 210;
  ctx.fillStyle = pink;
  roundRect(ctx, pad, ticketY, 300, 78, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '800 30px "Big Shoulders Display", system-ui, sans-serif';
  ctx.fillText('SHOP DONE', pad + 34, ticketY + 51);

  // List name
  ctx.fillStyle = ink;
  ctx.font = '700 96px "Big Shoulders Display", system-ui, sans-serif';
  const name = listName.length > 22 ? `${listName.slice(0, 21)}…` : listName;
  const nameLines = wrapText(ctx, name, pad, 420, W - pad * 2, 96);

  // Stats
  const statsY = 420 + nameLines * 96 + 90;
  ctx.fillStyle = ink;
  ctx.font = '700 44px "Space Mono", ui-monospace, monospace';
  const stats = [
    `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`,
    `${aisleCount} ${aisleCount === 1 ? 'aisle' : 'aisles'}`,
    minutes >= 1 ? `${minutes} min` : null,
  ]
    .filter(Boolean)
    .join('   ·   ');
  ctx.fillText(stats, pad, statsY);

  // Shopper
  ctx.beginPath();
  ctx.arc(pad + 15, statsY + 78, 15, 0, Math.PI * 2);
  ctx.fillStyle = shopperColor || pink;
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.font = '600 36px "Public Sans", system-ui, sans-serif';
  ctx.fillText(`${firstName(shopperName)} did this shop`, pad + 44, statsY + 90);

  // QR card
  const qrBox = 300;
  const qrX = pad;
  const qrY = H - qrBox - 190;
  ctx.fillStyle = '#fff';
  roundRect(ctx, qrX - 24, qrY - 24, qrBox + 48, qrBox + 48, 20);
  ctx.fill();
  try {
    const { moduleCount, modules } = encodeQR(url);
    const unit = qrBox / moduleCount;
    ctx.fillStyle = ink;
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (modules[r][c]) ctx.fillRect(qrX + c * unit, qrY + r * unit, unit + 0.5, unit + 0.5);
      }
    }
  } catch {
    /* URL too long for the encoder — skip the QR, the text link still shows */
  }

  // Join text next to QR
  ctx.fillStyle = ink;
  ctx.font = '700 32px "Big Shoulders Display", system-ui, sans-serif';
  ctx.fillText('SCAN TO JOIN', qrX + qrBox + 40, qrY + 40);
  ctx.font = '400 26px "Space Mono", ui-monospace, monospace';
  const shortUrl = url.replace(/^https?:\/\//, '');
  wrapText(ctx, shortUrl, qrX + qrBox + 40, qrY + 84, W - (qrX + qrBox + 40) - pad, 34);

  ctx.font = '600 24px "Public Sans", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(20,23,28,0.55)';
  ctx.fillText('One shopping list, everyone in the house.', qrX + qrBox + 40, qrY + qrBox - 8);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
      lines += 1;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, yy);
    lines += 1;
  }
  return lines;
}

export default function ShopRecap({ listName, itemCount, aisleCount, minutes, shopperName, shopperColor, url, onClear, onClose }) {
  const canvasRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      // Best-effort: wait for the display/mono webfonts so the canvas text
      // isn't drawn in a fallback face, but don't block forever on it.
      try {
        await Promise.race([
          Promise.all([
            document.fonts.load('700 92px "Big Shoulders Display"'),
            document.fonts.load('700 40px "Space Mono"'),
          ]),
          new Promise((r) => setTimeout(r, 1200)),
        ]);
      } catch {
        /* fonts API unavailable — fallback faces are fine */
      }
      if (cancelled || !canvasRef.current) return;
      drawCard(canvasRef.current, { listName, itemCount, aisleCount, minutes, shopperName, shopperColor, url });
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [listName, itemCount, aisleCount, minutes, shopperName, shopperColor, url]);

  function canvasBlob() {
    return new Promise((resolve) => canvasRef.current?.toBlob(resolve, 'image/png'));
  }

  async function share() {
    setBusy(true);
    try {
      const blob = await canvasBlob();
      if (!blob) return;
      const file = new File([blob], 'posh-list-shop.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${listName} — done`, url });
        setShared(true);
      } else {
        downloadBlob(blob);
      }
    } catch {
      /* share sheet cancelled — stay on the modal */
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    const blob = await canvasBlob();
    if (blob) downloadBlob(blob);
  }

  function downloadBlob(blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'posh-list-shop.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,23,28,0.55)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '20px 20px 0 0',
          padding: '18px 20px calc(20px + env(safe-area-inset-bottom))',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>
            Nice one — shop done
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
          >
            ×
          </button>
        </div>

        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            maxWidth: 360,
            display: 'block',
            margin: '0 auto',
            borderRadius: 12,
            border: '1px solid var(--hairline)',
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          <button
            type="button"
            onClick={share}
            disabled={busy}
            className="ticket"
            style={{ justifyContent: 'center', width: '100%', fontSize: 16 }}
          >
            {busy ? 'Preparing…' : shared ? 'Shared ✓ — share again' : 'Share the recap'}
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={download}
              style={{ flex: 1, background: 'var(--field-bg)', border: '1px solid var(--hairline)', borderRadius: 10, padding: '11px 12px', fontSize: 13, fontWeight: 700, color: 'var(--text)', cursor: 'pointer' }}
            >
              Save image
            </button>
            <button
              type="button"
              onClick={copyLink}
              style={{ flex: 1, background: 'var(--field-bg)', border: '1px solid var(--hairline)', borderRadius: 10, padding: '11px 12px', fontSize: 13, fontWeight: 700, color: 'var(--text)', cursor: 'pointer' }}
            >
              Copy join link
            </button>
          </div>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              style={{ background: 'none', border: 'none', padding: '8px 0 2px', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              Clear the {itemCount} ticked {itemCount === 1 ? 'item' : 'items'} & finish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
