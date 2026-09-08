import { useEffect, useState } from 'react';
import { useNavigate, Link } from '../router.jsx';
import { createRoom, fetchRoom } from '../lib/api.js';
import { getVisitedRooms, forgetVisitedRoom } from '../lib/identity.js';
import { relativeTime } from '../lib/time.js';
import BadgePrompt from '../components/BadgePrompt.jsx';
import OfferChecker from '../components/OfferChecker.jsx';
import NavMenu from '../components/NavMenu.jsx';
import QuickAdd from '../components/QuickAdd.jsx';
import JoinByLink from '../components/JoinByLink.jsx';
import NewListPrompt from '../components/NewListPrompt.jsx';

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [naming, setNaming] = useState(false);
  const [rooms, setRooms] = useState(getVisitedRooms);

  // Fetches one room's live unticked count and folds it into `rooms` —
  // shared by the mount-time refresh below and by QuickAdd, which needs
  // the badge next to that room's name to reflect a tap immediately
  // rather than waiting for the next visit to Home.
  function refreshRoomCount(slug) {
    fetchRoom(slug)
      .then((room) => {
        if (room) {
          const count = room.items.filter((i) => !i.done).length;
          setRooms((rs) => rs.map((x) => (x.slug === slug ? { ...x, count } : x)));
        } else {
          forgetVisitedRoom(slug);
          setRooms((rs) => rs.filter((x) => x.slug !== slug));
        }
      })
      .catch(() => {
        // Network hiccup, not a confirmed 404 — leave this room alone.
      });
  }

  // Render immediately from localStorage, then let each room's count fill
  // in behind it. Only a confirmed 404 (fetchRoom resolves null) means the
  // room is actually gone — a thrown error is just a bad request, and must
  // leave that room's entry alone, or one patchy signal in the shop would
  // wipe every list on the phone.
  useEffect(() => {
    getVisitedRooms().forEach((r) => refreshRoomCount(r.slug));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Home-screen icon badge, driven by the most recently visited list so it
  // matches what you'd see on tapping through. RoomContext already does
  // this from the open room's own count — this covers the case where the
  // installed icon launches straight at "/" and never opens a room at all.
  const topCount = rooms[0]?.count;
  useEffect(() => {
    if (topCount == null) return;
    try {
      if ('setAppBadge' in navigator) {
        if (topCount > 0) navigator.setAppBadge(topCount).catch(() => {});
        else navigator.clearAppBadge?.().catch(() => {});
      }
    } catch {
      // Badging API not supported here — progressive enhancement, no-op.
    }
  }, [topCount]);

  async function start(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const { slug } = await createRoom(trimmed);
      navigate(`/r/${slug}`);
    } catch {
      setBusy(false);
    }
  }

  async function startNew(newName) {
    setBusy(true);
    try {
      const { slug } = await createRoom(newName);
      navigate(`/r/${slug}`);
    } catch {
      setBusy(false);
    }
  }

  // First-run landing — only for a device that doesn't know about any list
  // yet. Everything below this is the dashboard.
  if (rooms.length === 0) {
    return (
      <div
        className="app-page"
        style={{
          background: 'var(--brand-yellow)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '32px 24px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: '0.16em',
            color: 'var(--on-brand)',
            background: 'var(--on-brand)',
            display: 'inline-block',
            padding: '6px 12px',
            borderRadius: 4,
            alignSelf: 'flex-start',
            marginBottom: 18,
          }}
        >
          <span style={{ color: 'var(--brand-yellow)' }}>POSH LIST</span>
        </div>

        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 40, lineHeight: 1.05, color: 'var(--on-brand)' }}>
          One shopping list, everyone in the house.
        </div>
        <div style={{ fontSize: 15, color: 'var(--on-brand-muted)', marginTop: 12, lineHeight: 1.5, maxWidth: 420 }}>
          No accounts, no sign-up. Start a list, send the link, and whoever opens it lands straight on
          the live shop — same list, updated the moment anyone changes it.
        </div>

        <form onSubmit={start} style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this list — e.g. Sunday big shop"
            maxLength={80}
            style={{
              background: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '14px 16px',
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--text)',
              fontFamily: 'var(--font-body)',
            }}
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="ticket"
            style={{ justifyContent: 'center', fontSize: 16, width: '100%' }}
          >
            {busy ? 'Starting…' : 'Start the list'}
          </button>
        </form>

        <div style={{ marginTop: 28, maxWidth: 420 }}>
          <JoinByLink onBrand />
          <Link
            to="/recover"
            style={{ display: 'inline-block', marginTop: 14, fontSize: 12.5, fontWeight: 700, color: 'var(--on-brand-muted)' }}
          >
            Don't have the link either? Recover by email
          </Link>
        </div>
      </div>
    );
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
        <div style={{ flex: 1, minWidth: 0 }}>
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
            Home
          </div>
        </div>
        <NavMenu slug={rooms[0]?.slug} roomLabel={rooms[0]?.name} />
      </div>

      <BadgePrompt />

      <div style={{ padding: '16px 20px 8px' }}>
        <OfferChecker slug={rooms[0]?.slug} />
      </div>

      <QuickAdd
        slug={rooms[0]?.slug}
        roomName={rooms[0]?.name}
        onAdded={() => refreshRoomCount(rooms[0]?.slug)}
      />

      <div style={{ flex: 1, padding: '20px 0 0', borderTop: '1px solid var(--hairline)' }}>
        <div
          style={{
            padding: '0 20px 8px',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.11em',
            color: 'var(--text-muted)',
          }}
        >
          YOUR LISTS
        </div>
        {rooms.map((r) => (
          <Link
            key={r.slug}
            to={`/r/${r.slug}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '13px 20px',
              borderBottom: '1px solid var(--hairline)',
              textDecoration: 'none',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{r.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {r.count != null ? `${r.count} to buy · ` : ''}
                {relativeTime(r.lastVisitedAt)}
              </div>
            </div>
            {r.count > 0 && (
              <span
                style={{
                  flexShrink: 0,
                  background: 'var(--ticket-pink)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 999,
                  minWidth: 22,
                  height: 22,
                  padding: '0 7px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {r.count}
              </span>
            )}
          </Link>
        ))}
      </div>

      <div style={{ flexShrink: 0, padding: '12px 16px 16px', background: '#fff', borderTop: '1px solid var(--hairline)' }}>
        <button
          type="button"
          onClick={() => setNaming(true)}
          disabled={busy}
          className="ticket"
          style={{ justifyContent: 'center', fontSize: 16, width: '100%' }}
        >
          + Start a new list
        </button>
      </div>

      {naming && (
        <NewListPrompt
          placeholder="e.g. Kitchen, Weekly shop"
          busy={busy}
          onCreate={(newName) => {
            setNaming(false);
            startNew(newName);
          }}
          onClose={() => setNaming(false)}
        />
      )}
    </div>
  );
}
