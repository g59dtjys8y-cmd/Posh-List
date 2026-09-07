import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from '../router.jsx';
import { createRoom } from '../lib/api.js';
import { getVisitedRooms, saveVisitedRooms } from '../lib/identity.js';
import { relativeTime } from '../lib/time.js';
import { CrossIcon } from '../components/Icons.jsx';
import NavMenu from '../components/NavMenu.jsx';

const UNDO_TIMEOUT_MS = 6000;

/**
 * Every list this device has opened — including ones you were only ever
 * invited to via someone else's share link, not just the one you started.
 * No accounts, so this is per-device: open a share link once on a phone or
 * browser and that device remembers it here from then on.
 *
 * Removing a row only forgets it on this device — there's no server-side
 * delete and no accounts, so the room stays live and everyone else keeps
 * it. One tap removes (no confirm dialog); an undo bar holds the previous
 * state for 6 seconds in case that was a mis-tap.
 */
export default function MyLists() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [rooms, setRooms] = useState(getVisitedRooms);
  const [undo, setUndo] = useState(null); // { name, previousRooms } | null
  const undoTimer = useRef(null);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  async function startNew() {
    setBusy(true);
    try {
      const { slug } = await createRoom('Shopping list');
      navigate(`/r/${slug}`);
    } catch {
      setBusy(false);
    }
  }

  function removeRoom(room) {
    const previousRooms = rooms;
    const next = rooms.filter((r) => r.slug !== room.slug);
    setRooms(next);
    saveVisitedRooms(next);

    clearTimeout(undoTimer.current);
    setUndo({ name: room.name, previousRooms });
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_TIMEOUT_MS);
  }

  function undoRemove() {
    if (!undo) return;
    clearTimeout(undoTimer.current);
    setRooms(undo.previousRooms);
    saveVisitedRooms(undo.previousRooms);
    setUndo(null);
  }

  return (
    <div className="app-page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          background: 'var(--brand-yellow)',
          flexShrink: 0,
          padding: '20px 20px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
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
        <NavMenu slug={rooms[0]?.slug} roomLabel={rooms[0]?.name} />
      </div>

      <div style={{ flex: 1, padding: '8px 0' }}>
        {rooms.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            No lists yet on this device — start one, or open someone else's share link.
          </div>
        ) : (
          rooms.map((r) => (
            <div key={r.slug} style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--hairline)' }}>
              <Link
                to={`/r/${r.slug}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '15px 8px 15px 20px',
                  flex: 1,
                  minWidth: 0,
                  textDecoration: 'none',
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{r.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {relativeTime(r.lastVisitedAt)}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => removeRoom(r)}
                aria-label={`Remove ${r.name}`}
                style={{
                  flexShrink: 0,
                  width: 48,
                  background: 'none',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <CrossIcon color="var(--icon-muted)" />
              </button>
            </div>
          ))
        )}
      </div>

      {undo && (
        <div
          style={{
            flexShrink: 0,
            margin: '0 16px 12px',
            background: 'var(--on-brand)',
            color: '#fff',
            borderRadius: 12,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 12px 26px rgba(20,23,28,0.32)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>
            Removed &quot;{undo.name}&quot; from this device
          </span>
          <button
            type="button"
            onClick={undoRemove}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--brand-yellow)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Undo
          </button>
        </div>
      )}

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
