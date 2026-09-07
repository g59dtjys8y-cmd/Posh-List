import { OFFER, isOfferLive } from '../lib/offer.js';
import ShopLinks from './ShopLinks.jsx';
import { TrolleyTagIcon } from './Icons.jsx';
import { Link } from '../router.jsx';

/**
 * The home screen's answer to "is anything running right now?" — unlike
 * OfferBanner (a dismissible nudge that hides itself once there's nothing
 * on), this always renders: "no" is still a useful answer here. Shares
 * `OFFER`/`isOfferLive` with the banner so there is exactly one copy of
 * the offer facts, and `ShopLinks` so the pill styling can't drift between
 * the two surfaces.
 *
 * The loyalty-cards link lives here rather than inside ShopLinks: ShopLinks
 * is shared with OfferBanner on the list page and is only ever external
 * "go check for yourself" retailer links — an internal app route doesn't
 * belong there. OFFER.disclaimer already tells you to scan your card at
 * checkout, so it sits naturally with this shop cluster instead.
 */
export default function OfferChecker({ slug }) {
  if (isOfferLive()) {
    return (
      <div
        style={{
          position: 'relative',
          background: 'var(--ticket-pink)',
          borderRadius: '0 10px 10px 0',
          padding: '14px 18px 14px 24px',
          clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%,0 66%,12px 50%,0 34%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
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
            {OFFER.retailer}
          </span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
          {OFFER.headline}, {OFFER.displayDates}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 6, lineHeight: 1.4 }}>
          {OFFER.disclaimer}
        </div>
        <ShopLinks onDark />
        {slug && (
          <Link
            to={`/r/${slug}/loyalty-cards`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              minHeight: 38,
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              marginTop: 8,
              background: 'rgba(255,255,255,0.18)',
              color: '#fff',
            }}
          >
            💳 Loyalty cards
          </Link>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--hairline-strong)',
        borderRadius: 14,
        padding: '14px 16px',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
        No 25% offer running right now
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
        Last one: {OFFER.headline} at {OFFER.retailer} ({OFFER.displayDates}).
      </div>
      <ShopLinks />
      {slug && (
        <Link
          to={`/r/${slug}/loyalty-cards`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            minHeight: 38,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            textDecoration: 'none',
            marginTop: 8,
            background: 'var(--field-bg)',
            color: 'var(--text)',
            border: '1px solid var(--hairline-strong)',
          }}
        >
          💳 Loyalty cards
        </Link>
      )}
    </div>
  );
}
