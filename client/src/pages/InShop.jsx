import { useRoom } from '../RoomContext.jsx';
import { useNavigate } from '../router.jsx';
import ItemRow from '../components/ItemRow.jsx';
import Toast from '../components/Toast.jsx';
import { AISLE_BY_KEY } from '../lib/aisles.js';

export default function InShop() {
  const { slug, room, identity, send, toasts, dismissToast, activeLayout } = useRoom();
  const navigate = useNavigate();

  if (!room) return null;

  const order = activeLayout?.order || [];
  const groups = order
    .map((aisleKey) => ({ aisleKey, items: room.items.filter((i) => i.aisleKey === aisleKey) }))
    .filter((g) => g.items.length > 0);

  const total = room.items.length;
  const done = room.items.filter((i) => i.done).length;
  const aislesLeft = groups.filter((g) => g.items.some((i) => !i.done)).length;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  function handleToggle(item) {
    send({ type: 'toggle_item', itemId: item.id, done: !item.done, doneBy: identity?.id });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div
        style={{
          background: 'var(--brand-yellow)',
          flexShrink: 0,
          padding: '20px 20px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, letterSpacing: '0.16em', color: 'var(--on-brand)' }}>
          IN THE SHOP
        </div>
        <button
          onClick={() => navigate(`/r/${slug}`)}
          style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--on-brand)', cursor: 'pointer' }}
        >
          Done
        </button>
      </div>

      <div style={{ padding: '18px 20px 14px', flexShrink: 0 }}>
        <div className="ticket" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, padding: '11px 18px 11px 24px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 19 }}>
            {done}/{total}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>in the trolley</span>
        </div>
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)' }}>
          {total === 0
            ? 'Nothing on the list yet'
            : aislesLeft === 0
              ? 'All aisles done'
              : `${aislesLeft} ${aislesLeft === 1 ? 'aisle' : 'aisles'} left`}
        </div>
        <div style={{ marginTop: 9, height: 6, borderRadius: 3, background: 'var(--hairline)', overflow: 'hidden' }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--ticket-pink)', borderRadius: 3, transition: 'width 200ms ease' }} />
        </div>
      </div>

      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onClose={() => dismissToast(t.id)} />
      ))}

      <div style={{ flex: 1 }}>
        {groups.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            Nothing on the list yet
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.aisleKey}>
              <div
                style={{
                  padding: '20px 20px 10px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.11em',
                  color: AISLE_BY_KEY[group.aisleKey]?.color,
                }}
              >
                {AISLE_BY_KEY[group.aisleKey]?.label.toUpperCase()}
              </div>
              {group.items.map((item) => (
                <ItemRow key={item.id} item={item} onToggle={handleToggle} big />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
