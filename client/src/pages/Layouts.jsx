import { useRoom } from '../RoomContext.jsx';
import { useNavigate } from '../router.jsx';
import { BackIcon, CheckIcon, PlusIcon } from '../components/Icons.jsx';
import { AISLE_BY_KEY } from '../lib/aisles.js';

export default function Layouts() {
  const { slug, room, send } = useRoom();
  const navigate = useNavigate();

  if (!room) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ background: 'var(--brand-yellow)', flexShrink: 0, padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(`/r/${slug}`)}
            aria-label="Back to the list"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <BackIcon />
          </button>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--on-brand)' }}>Layouts</div>
        </div>
      </div>

      <div style={{ padding: '16px 20px 4px', flexShrink: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45 }}>
          Save the aisle order for each shop you use, then switch between them in a tap.
        </div>
      </div>

      <div style={{ flex: 1, padding: '10px 0 16px' }}>
        {room.aisleLayouts.map((layout) => {
          const active = layout.id === room.activeLayoutId;
          return (
            <div key={layout.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--hairline)' }}>
              <button
                onClick={() => send({ type: 'set_active_layout', layoutId: layout.id })}
                aria-label={active ? `${layout.name} is in use` : `Switch to ${layout.name}`}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  flexShrink: 0,
                  border: active ? 'none' : '2px solid var(--hairline-strong)',
                  background: active ? 'var(--ticket-pink)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {active && <CheckIcon />}
              </button>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{layout.name}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {layout.order.map((key) => (
                    <div key={key} style={{ width: 7, height: 7, borderRadius: 2, background: AISLE_BY_KEY[key]?.color }} />
                  ))}
                </div>
                <button
                  onClick={() => navigate(`/r/${slug}/layouts/${layout.id}`)}
                  style={{ background: 'none', border: 'none', padding: 0, marginTop: 8, fontSize: 11.5, fontWeight: 600, color: 'var(--on-brand-muted)', cursor: 'pointer' }}
                >
                  Edit order
                </button>
              </div>

              {active && (
                <div className="ticket" style={{ padding: '6px 10px 6px 13px', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10, letterSpacing: '0.08em' }}>IN USE</span>
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={() => navigate(`/r/${slug}/layouts/new`)}
          style={{
            margin: '16px 20px 0',
            border: '1.5px dashed var(--hairline-strong)',
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'none',
            cursor: 'pointer',
            width: 'calc(100% - 40px)',
          }}
        >
          <PlusIcon />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Add a layout for another shop</span>
        </button>
      </div>
    </div>
  );
}
