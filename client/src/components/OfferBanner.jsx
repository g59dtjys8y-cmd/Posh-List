import { useEffect, useState } from 'react';
import { useRoom } from '../RoomContext.jsx';
import { CrossIcon, TrolleyTagIcon } from './Icons.jsx';

// A single hand-maintained offer — not a general offers system (see
// README's "Deliberately not in this app"). `endsAt` is the actual
// timestamp checked against the clock; `displayDates` is just the text
// shown alongside it, so update both together when the offer changes.
const OFFER = {
  id: 'tesco-wine-25-2026-08-24',
  retailer: 'TESCO',
  headline: '25% off 6+ wines',
  displayDates: 'until Mon 24 Aug',
  disclaimer: 'Clubcard price — scan your card at checkout. Excludes Scotland & NI.',
  endsAt: new Date('2026-08-25T00:00:00').getTime(),
};

function storageKey(slug) {
  return `posh-list:offer-dismissed:${slug}:${OFFER.id}`;
}

/**
 * The one designed offer banner. Dismissal is per device (localStorage),
 * never broadcast to the room — hiding it on your phone doesn't hide it on
 * anyone else's. The offer itself auto-hides for everyone once `endsAt`
 * passes, regardless of dismissal. "Whose card is this" is a plain,
 * synced, editable note — not a claim/release toggle — since it's meant
 * to answer "whose Clubcard do we need", not track who's using it right now.
 */
export default function OfferBanner() {
  const { slug, room, send } = useRoom();
  const [dismissed, setDismissed] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey(slug)) === '1');
    } catch {
      setDismissed(false);
    }
  }, [slug]);

  if (Date.now() > OFFER.endsAt) return null;
  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey(slug), '1');
    } catch {
      /* ignore */
    }
  }

  function startEditing() {
    setDraft(room?.offerWhoHas || '');
    setEditing(true);
  }

  function saveWhoHas(e) {
    e.preventDefault();
    send({ type: 'set_offer_who_has', text: draft });
    setEditing(false);
  }

  const whoHas = room?.offerWhoHas;

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
            {OFFER.retailer}
          </span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.3, paddingRight: 14 }}>
          {OFFER.headline}, {OFFER.displayDates}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 6, lineHeight: 1.4 }}>
          {OFFER.disclaimer}
        </div>

        {editing ? (
          <form onSubmit={saveWhoHas} style={{ display: 'flex', gap: 6, marginTop: 9 }}>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Whose card is this?"
              maxLength={40}
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 12,
                background: 'rgba(255,255,255,0.9)',
                color: 'var(--text)',
              }}
            />
            <button
              type="submit"
              style={{
                background: 'rgba(255,255,255,0.25)',
                border: 'none',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Save
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            style={{
              display: 'block',
              marginTop: 9,
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 12,
              fontWeight: 700,
              color: '#fff',
              textDecoration: 'underline',
              textUnderlineOffset: 2,
              cursor: 'pointer',
            }}
          >
            {whoHas ? `On ${whoHas}'s card` : "Whose card is this? Tap to add"}
          </button>
        )}
      </div>
    </div>
  );
}
