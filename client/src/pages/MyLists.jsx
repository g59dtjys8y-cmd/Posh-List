import { useState } from 'react';
import { useNavigate, Link } from '../router.jsx';
import { createRoom } from '../lib/api.js';
import { getVisitedRooms } from '../lib/identity.js';
import { relativeTime } from '../lib/time.js';

/**
 * Every list this device has opened — including ones you were only ever
 * invited to via someone else's share link, not just the one you started.
 * No accounts, so this is per-device: open a share link once on a phone or
 * browser and that device remembers it here from then on.
 */
export default function MyLists() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const rooms = getVisitedRooms();

  async function startNew() {
    setBusy(true);
    try {
      const { slug } = await createRoom('Shopping list');
      navigate(`/r/${slug}`);
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="app-page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--brand-yellow)', flexShrink: 0, padding: '20px 20px 16px' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: '0.16em',
            color: 'var(--on-brand)',
          }}
        >
          POSH LIST
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 27, lineHeight: 1, color: 'var(--text)', marginTop: 10 }}>
          Your lists
        </div>
      </div>

      <div style={{ flex: 1, padding: '8px 0' }}>
        {rooms.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            No lists yet on this device — start one, or open someone else's share link.
          </div>
        ) : (
          rooms.map((r) => (
            <Link
              key={r.slug}
              to={`/r/${r.slug}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '15px 20px',
                borderBottom: '1px solid var(--hairline)',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{r.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                {relativeTime(r.lastVisitedAt)}
              </span>
            </Link>
          ))
        )}
      </div>

      <div style={{ flexShrink: 0, padding: '12px 16px 16px', background: '#fff', borderTop: '1px solid var(--hairline)' }}>
        <button
          type="button"
          onClick={startNew}
          disabled={busy}
          className="ticket"
          style={{ justifyContent: 'center', fontSize: 16, width: '100%' }}
        >
          {busy ? 'Starting…' : '+ Start a new list'}
        </button>
      </div>
    </div>
  );
}
