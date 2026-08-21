import { AISLE_BY_KEY } from '../lib/aisles.js';

/** A toast fired by a WebSocket 'item_added' event from another connected client. */
export default function Toast({ toast }) {
  const color = AISLE_BY_KEY[toast.aisleKey]?.color || 'var(--person-a)';
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 16,
        right: 16,
        background: 'var(--on-brand)',
        color: '#fff',
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 12px 26px rgba(20,23,28,0.32)',
        zIndex: 20,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{toast.text}</span>
    </div>
  );
}
