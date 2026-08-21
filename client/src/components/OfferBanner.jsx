import { useEffect, useState } from 'react';
import { CrossIcon, TrolleyTagIcon } from './Icons.jsx';

const OFFER_ID = 'tesco-wine-25-2026-08-24';

function storageKey(slug) {
  return `posh-shop:offer-dismissed:${slug}:${OFFER_ID}`;
}

/**
 * The one designed offer banner. Dismissal is per device (localStorage),
 * never broadcast to the room — hiding it on your phone doesn't hide it on
 * anyone else's.
 */
export default function OfferBanner({ slug }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey(slug)) === '1');
    } catch {
      setDismissed(false);
    }
  }, [slug]);

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey(slug), '1');
    } catch {
      /* ignore */
    }
  }

  return (
    <div style={{ padding: '14px 20px 4px', flexShrink: 0 }}>
      <div
        style={{
          position: 'relative',
          background: 'var(--ticket-pink)',
          borderRadius: '0 10px 10px 0',
          padding: '14px 18px 14px 24px',
          clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%,0 66%,12px 50%,0 34%)',
        }}
      >
        <button
          onClick={dismiss}
          aria-label="Dismiss offer"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <CrossIcon />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, paddingRight: 20 }}>
          <TrolleyTagIcon />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.13em',
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            TESCO
          </span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.3, paddingRight: 14 }}>
          25% off 6+ wines, until Mon 24 Aug
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 6, lineHeight: 1.4 }}>
          Clubcard price — scan your card at checkout. Excludes Scotland &amp; NI.
        </div>
      </div>
    </div>
  );
}
