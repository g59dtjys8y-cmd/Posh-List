import { SHOPS } from '../lib/offer.js';

/**
 * The two "go check for yourself" shop links — shared between OfferBanner
 * (on the pink ticket, `onDark`) and the home screen's "no offer running"
 * white card, so the two surfaces' pill styling can't drift apart from
 * each other over time. Each shop's real logo (public/logos/*.png,
 * background keyed out to transparent) is its own brand colour, not
 * white — a solid white backing reads best under both, so both variants
 * use it; `onDark` (the pink ticket) just drops the border, since the pill
 * already stands out against the pink without one.
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
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            textDecoration: 'none',
            background: '#fff',
            border: onDark ? 'none' : '1px solid var(--hairline-strong)',
          }}
        >
          <img src={shop.logo} alt={shop.name} style={{ height: 26, maxWidth: '85%', objectFit: 'contain' }} />
        </a>
      ))}
    </div>
  );
}
