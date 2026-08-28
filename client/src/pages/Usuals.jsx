import { useEffect } from 'react';
import { useRoom } from '../RoomContext.jsx';
import { useNavigate } from '../router.jsx';
import { BackIcon } from '../components/Icons.jsx';
import { AISLE_BY_KEY } from '../lib/aisles.js';

/**
 * "Your usuals" — every item name this list has ever added, with a star to
 * force one on or off the usuals regardless of how often it's been added.
 * A third tap on the star clears the override back to automatic (a filled
 * star just means "currently a usual", however that came about).
 */
export default function Usuals() {
  const { slug, room, knownItems, requestKnownItems, send } = useRoom();
  const navigate = useNavigate();

  useEffect(() => {
    requestKnownItems();
  }, [requestKnownItems]);

  function cycle(item) {
    // auto → force on → force off → auto
    let next;
    if (!item.overridden) next = item.isRegular ? 0 : 1;
    else if (item.isRegular) next = 0;
    else next = null;
    send({ type: 'set_regular', nameKey: item.nameKey, value: next });
  }

  const items = knownItems || [];
  const regularCount = items.filter((i) => i.isRegular).length;

  return (
    <div className="app-page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--brand-yellow)', flexShrink: 0, padding: '20px 20px 16px' }}>
        <button
          onClick={() => navigate(`/r/${slug}`)}
          aria-label="Back to the list"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <BackIcon />
        </button>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 27, lineHeight: 1, color: 'var(--text)', marginTop: 12 }}>
          Your usuals
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
          {regularCount} {regularCount === 1 ? 'usual' : 'usuals'} · rebuild next week's list in one tap from the list screen
        </div>
      </div>

      <div style={{ flex: 1, padding: '6px 0' }}>
        {!knownItems ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            Nothing added yet. Add items to the list a few times and they'll show up here as usuals.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.nameKey}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '13px 20px',
                borderBottom: '1px solid var(--hairline)',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: AISLE_BY_KEY[item.aisleKey]?.color || 'var(--text-muted)',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  added {item.timesAdded}×{item.overridden ? ' · pinned' : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => cycle(item)}
                aria-label={item.isRegular ? 'Remove from usuals' : 'Add to usuals'}
                aria-pressed={item.isRegular}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 6,
                  margin: -6,
                  cursor: 'pointer',
                  fontSize: 20,
                  lineHeight: 1,
                  color: item.isRegular ? 'var(--ticket-pink)' : 'var(--hairline-strong)',
                }}
              >
                {item.isRegular ? '★' : '☆'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
