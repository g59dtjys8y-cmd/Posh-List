import { useEffect, useRef, useState } from 'react';
import { useRoom } from '../RoomContext.jsx';
import { useNavigate } from '../router.jsx';
import { BackIcon, DragHandleIcon } from '../components/Icons.jsx';
import { AISLE_BY_KEY, AISLE_KEYS } from '../lib/aisles.js';

/**
 * Drag-to-reorder without @dnd-kit (no npm registry access in this
 * sandbox — see the project report): plain Pointer Events tracking which
 * row the finger/cursor is currently over and live-reordering the array.
 * Works the same for touch and mouse.
 */
function useReorder(order, setOrder) {
  const draggingKey = useRef(null);
  const rowRefs = useRef({});

  function onPointerDown(aisleKey) {
    return (e) => {
      // Without this, iOS Safari treats the press-and-hold as the start of
      // text selection / its callout menu instead of a drag, so the row
      // never appears to move — this is what "doesn't work" looks like.
      e.preventDefault();
      draggingKey.current = aisleKey;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    };
  }

  function onPointerMove(e) {
    const key = draggingKey.current;
    if (!key) return;
    const y = e.clientY;
    let targetKey = null;
    let best = Infinity;
    for (const [k, el] of Object.entries(rowRefs.current)) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const dist = Math.abs(mid - y);
      if (dist < best) {
        best = dist;
        targetKey = k;
      }
    }
    if (targetKey && targetKey !== key) {
      setOrder((prev) => {
        const from = prev.indexOf(key);
        const to = prev.indexOf(targetKey);
        if (from === -1 || to === -1) return prev;
        const next = prev.slice();
        next.splice(from, 1);
        next.splice(to, 0, key);
        return next;
      });
    }
  }

  function onPointerUp() {
    draggingKey.current = null;
  }

  return { rowRefs, onPointerDown, onPointerMove, onPointerUp, isDragging: (key) => draggingKey.current === key };
}

export default function EditLayout({ layoutId }) {
  const { slug, room, send } = useRoom();
  const navigate = useNavigate();
  const isNew = layoutId === 'new';

  const existing = !isNew && room ? room.aisleLayouts.find((l) => l.id === layoutId) : null;
  const [name, setName] = useState('');
  const [order, setOrder] = useState(AISLE_KEYS);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (initialised || !room) return;
    if (isNew) {
      setName('');
      setOrder((room.aisleLayouts.find((l) => l.id === room.activeLayoutId) || {}).order || AISLE_KEYS);
      setInitialised(true);
    } else if (existing) {
      setName(existing.name);
      setOrder(existing.order);
      setInitialised(true);
    }
  }, [room, existing, isNew, initialised]);

  const { rowRefs, onPointerDown, onPointerMove, onPointerUp, isDragging } = useReorder(order, setOrder);

  if (!room || (!isNew && !existing && !initialised)) {
    return null;
  }

  const canDelete = !isNew && room.aisleLayouts.length > 1;

  function handleSave() {
    const finalName = name.trim() || 'New layout';
    if (isNew) {
      send({ type: 'add_layout', name: finalName, order, makeActive: false });
    } else {
      send({ type: 'update_layout', layoutId, name: finalName, order });
    }
    navigate(`/r/${slug}/layouts`);
  }

  function handleDelete() {
    if (!canDelete) return;
    send({ type: 'delete_layout', layoutId });
    navigate(`/r/${slug}/layouts`);
  }

  return (
    <div className="app-page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--brand-yellow)', flexShrink: 0, padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(`/r/${slug}/layouts`)}
            aria-label="Back to layouts"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <BackIcon />
          </button>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--on-brand)' }}>
            {isNew ? 'Add a layout' : 'Edit layout'}
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 20px 4px', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--on-brand-muted)', marginBottom: 6 }}>
          LAYOUT NAME
        </div>
        <div style={{ background: 'var(--field-bg)', border: '1px solid var(--hairline)', borderRadius: 10, padding: '12px 14px' }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aldi Camden"
            maxLength={60}
            style={{ width: '100%', background: 'none', border: 'none', outline: 'none', fontSize: 15, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-body)' }}
          />
        </div>
      </div>

      <div style={{ padding: '14px 20px 6px', flexShrink: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Drag to match this shop&rsquo;s aisles.</div>
      </div>

      <div style={{ flex: 1, padding: '6px 0 12px' }} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {order.map((aisleKey, i) => {
          const aisle = AISLE_BY_KEY[aisleKey];
          const dragging = isDragging(aisleKey);
          return (
            <div
              key={aisleKey}
              ref={(el) => {
                rowRefs.current[aisleKey] = el;
              }}
              onPointerDown={onPointerDown(aisleKey)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 20px 14px 16px',
                borderBottom: '1px solid var(--hairline)',
                position: 'relative',
                background: dragging ? '#FFFBEA' : 'transparent',
                touchAction: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none',
                WebkitTouchCallout: 'none',
                cursor: 'grab',
              }}
            >
              <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: aisle.color }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--icon-muted)', width: 14 }}>{i + 1}</span>
              <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, letterSpacing: '0.08em', color: aisle.color }}>
                {aisle.label.toUpperCase()}
              </span>
              <span
                aria-hidden="true"
                style={{ background: 'none', border: 'none', padding: 6, display: 'flex', pointerEvents: 'none' }}
              >
                <DragHandleIcon color={dragging ? '#9AA1AB' : '#C7CBD1'} />
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ flexShrink: 0, padding: '6px 16px 16px', background: '#fff', borderTop: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {canDelete && (
          <button
            onClick={handleDelete}
            style={{ background: 'none', border: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', paddingTop: 10, cursor: 'pointer' }}
          >
            Delete this layout
          </button>
        )}
        <button onClick={handleSave} className="ticket" style={{ width: '100%', justifyContent: 'center', fontSize: 16 }}>
          Save layout
        </button>
      </div>
    </div>
  );
}
