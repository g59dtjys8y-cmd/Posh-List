import { useState } from 'react';
import { useRoomOptional } from '../RoomContext.jsx';
import { subscribeToPush } from '../lib/push.js';

// iOS/iPadOS 16.4+ and Chrome both support setting a home-screen icon
// badge (see RoomContext's unticked-count effect) — but on iOS the badge
// only actually displays once the user has granted notification
// permission; setAppBadge() itself resolves silently either way, so
// without asking for that permission the badge would just never appear
// and look broken. The same permission is also what lets a push
// notification actually show (sw.js handles the push) — so one ask covers
// both, and iOS specifically needs it to come from a tap, not a page-load
// side effect. One-time, dismissible.
//
// This prompt must NOT require badge support to show, though: it's the
// only place in the whole app that ever calls Notification.requestPermission
// (subscribeToPush only fires once permission is already "granted" — see
// lib/push.js). Firefox (desktop and Android) has no Badging API at all,
// but fully supports Notification + Push — gating on badge support used to
// mean Firefox users were silently never asked, and so could never get
// notified of anything, which is the one thing this app is actually for.
// Badge support is an independent nice-to-have layered on top, not a gate.
const DISMISSED_KEY = 'posh-list:badge-prompt-dismissed';

function isDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function setDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // no-op — worst case the prompt shows again next visit.
  }
}

// What subscribeToPush (lib/push.js) actually needs to have a chance of
// working — Notification for the permission itself, a service worker and
// PushManager to receive and show a push. Independent of badge support.
const pushSupported =
  typeof navigator !== 'undefined' &&
  typeof Notification !== 'undefined' &&
  'serviceWorker' in navigator &&
  typeof window !== 'undefined' &&
  'PushManager' in window;

const badgeSupported = typeof navigator !== 'undefined' && 'setAppBadge' in navigator;

export default function BadgePrompt() {
  const [visible, setVisible] = useState(
    () => pushSupported && Notification.permission === 'default' && !isDismissed()
  );
  // null on room-less pages (Home) — RoomContext.jsx's own mount-time
  // effect is what covers subscribing there, next time a room's opened.
  const room = useRoomOptional();

  if (!visible) return null;

  async function enable() {
    try {
      const permission = await Notification.requestPermission();
      // RoomContext's subscribe effect only re-runs on slug/identity
      // changes, neither of which this triggers — without this, granting
      // permission here wouldn't actually subscribe until the room next
      // (re)mounts. Fire it directly so it takes effect immediately.
      if (permission === 'granted' && room?.slug) {
        subscribeToPush(room.slug, room.identity?.id);
      }
    } catch {
      // Permission API can reject in odd embedded contexts — nothing to
      // do but stop asking.
    }
    setDismissed();
    setVisible(false);
  }

  function dismiss() {
    setDismissed();
    setVisible(false);
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 20px',
        background: 'var(--field-bg)',
        borderBottom: '1px solid var(--hairline)',
      }}
    >
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}>
        {badgeSupported
          ? "Get notified when someone adds to the list, and see how many's left on your home screen icon?"
          : 'Get notified when someone adds to the list?'}
      </span>
      <button
        type="button"
        onClick={enable}
        style={{
          background: 'none',
          border: 'none',
          padding: '4px 8px',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--text)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Turn on
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          padding: '4px 6px',
          fontSize: 14,
          color: 'var(--text-muted)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
