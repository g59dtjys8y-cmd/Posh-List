import { SHOPS } from '../lib/offer.js';

/**
 * The two "go check for yourself" shop links — shared between OfferBanner
 * (on the pink ticket, `onDark`) and the home screen's "no offer running"
 * white card, so the two surfaces' pill styling can't drift apart from
 * each other over time.
 */
export default function ShopLinks({ onDark = false }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
      {SHOPS.map((shop) => (
        <a
          key={shop.name}
          href={shop.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1,
            minHeight: 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            textDecoration: 'none',
            background: onDark ? 'rgba(255,255,255,0.18)' : 'var(--field-bg)',
            color: onDark ? '#fff' : 'var(--text)',
            border: onDark ? 'none' : '1px solid var(--hairline-strong)',
          }}
        >
          {shop.name}
        </a>
      ))}
    </div>
  );
}
