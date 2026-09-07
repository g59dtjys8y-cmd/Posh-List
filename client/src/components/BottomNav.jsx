import { useRouter } from '../router.jsx';
import { useRoomOptional } from '../RoomContext.jsx';
import { getVisitedRooms } from '../lib/identity.js';
import { HomeIcon, ListIcon, StackIcon } from './Icons.jsx';

/**
 * Persistent app-wide tab bar, rendered once in App.jsx on every page —
 * the always-visible counterpart to NavMenu's dropdown, not a replacement
 * for it (NavMenu still covers the less-frequent room actions: Share, In
 * the shop, Add from a recipe, Your usuals, Layouts).
 */
export default function BottomNav() {
  const { path, navigate } = useRouter();
  // Inside a room's own pages this is the live room; everywhere else
  // (Home, Your lists, 404) there's no RoomProvider, so fall back to
  // whichever list this device opened most recently — same "most recently
  // visited" signal Home and MyLists already use for NavMenu's room group.
  const roomSlug = useRoomOptional()?.slug || getVisitedRooms()[0]?.slug || null;

  const tabs = [
    { label: 'Home', to: '/', Icon: HomeIcon },
    { label: 'List', to: roomSlug ? `/r/${roomSlug}` : null, Icon: ListIcon },
    { label: 'Your lists', to: '/lists', Icon: StackIcon },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 25,
        display: 'flex',
        height: 'var(--bottom-nav-height)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: '#fff',
        borderTop: '1px solid var(--hairline)',
      }}
    >
      {tabs.map(({ label, to, Icon }) => {
        // A sub-page of the room (Share, In the shop, ...) still counts as
        // "on the list" for highlighting purposes, not just its exact URL.
        const active = to != null && (to === path || path.startsWith(`${to}/`));
        const disabled = to == null;
        const tone = active ? 'var(--ticket-pink)' : 'var(--icon-muted)';
        return (
          <button
            key={label}
            type="button"
            disabled={disabled}
            aria-current={active ? 'page' : undefined}
            onClick={() => to && navigate(to)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.35 : 1,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Icon color={tone} size={21} />
            <span
              style={{
                fontSize: 11,
                fontWeight: active ? 700 : 600,
                color: active ? 'var(--text)' : 'var(--text-muted)',
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
