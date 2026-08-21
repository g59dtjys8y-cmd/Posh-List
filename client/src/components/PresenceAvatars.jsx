function initials(name) {
  return (name || '?').trim().slice(0, 1).toUpperCase();
}

/** Overlapping avatar stack for people currently connected to the room. */
export default function PresenceAvatars({ people, size = 28, borderColor = 'var(--brand-yellow)' }) {
  const connected = people.filter((p) => p.connected);
  if (connected.length === 0) return null;

  return (
    <div style={{ display: 'flex' }}>
      {connected.slice(0, 5).map((p, i) => (
        <div
          key={p.id}
          title={p.name}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: p.color,
            border: `2px solid ${borderColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: size * 0.43,
            marginLeft: i === 0 ? 0 : -size * 0.32,
            flexShrink: 0,
          }}
        >
          {initials(p.name)}
        </div>
      ))}
    </div>
  );
}
