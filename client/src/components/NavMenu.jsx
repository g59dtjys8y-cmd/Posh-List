import { useEffect, useRef, useState } from 'react';
import { useRouter } from '../router.jsx';
import { useRoomOptional } from '../RoomContext.jsx';
import { createRoom } from '../lib/api.js';
import { MenuIcon } from './Icons.jsx';
import NewListPrompt from './NewListPrompt.jsx';

export default function NavMenu({ slug, roomLabel }) {
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [starting, setStarting] = useState(false);
  const ref = useRef(null);
  const { path, navigate } = useRouter();
  const roomCtx = useRoomOptional();
  const activeLayout = roomCtx?.activeLayout;
  // NavMenu also renders room-less (Home, Your lists) and from MyLists with
  // no RoomProvider at all (slug={rooms[0]?.slug}, no room context) — kind
  // is unknown in both cases, so default to shopping rather than hiding
  // entries a legitimate shopping list's menu should still show.
  const isOther = roomCtx?.room?.kind === 'other';

  async function startOwnList(name, kind) {
    if (starting) return;
    setStarting(true);
    try {
      const { slug: newSlug } = await createRoom(name, {
        // Seeding a walking order only makes sense for a shopping list — an
        // `other` list's UI never uses aisles at all.
        layoutOrder: kind === 'shopping' ? activeLayout?.order : undefined,
        from: slug,
        kind,
      });
      setNaming(false);
      navigate(`/r/${newSlug}`);
    } catch {
      setStarting(false);
    }
  }

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const items = [
    { label: 'Home', to: '/home' },
    // Only a device with a list to reach builds this group at all — no six
    // dead entries pointing nowhere useful for a brand-new visitor.
    ...(slug
      ? [
          { label: 'Open the list', to: `/r/${slug}`, heading: roomLabel },
          { label: 'Share the list', to: `/r/${slug}/share` },
          // Shopping-only: an `other` list has no in-shop mode, recipes,
          // usuals, loyalty cards or aisle layouts to speak of.
          ...(isOther
            ? []
            : [
                { label: 'In the shop', to: `/r/${slug}/shop` },
                { label: 'Add from a recipe', to: `/r/${slug}/paste-recipe` },
                { label: 'Your usuals', to: `/r/${slug}/usuals` },
                { label: 'Loyalty cards', to: `/r/${slug}/loyalty-cards` },
                { label: 'Layouts', to: `/r/${slug}/layouts` },
              ]),
        ]
      : []),
    { label: 'Manage lists', to: '/lists' },
    {
      label: '+ Start your own list',
      onClick: () => {
        setOpen(false);
        setNaming(true);
      },
    },
    // No `to` matches the page you're already on, so it drops itself from
    // the list instead of needing a special case per page (Home included).
  ].filter((item) => item.to !== path);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        style={{
          width: 32,
          height: 32,
          margin: -6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <MenuIcon />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 38,
            right: 0,
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 12px 30px rgba(20,23,28,0.24)',
            overflow: 'hidden',
            zIndex: 30,
            minWidth: 200,
            maxWidth: 260,
          }}
        >
          {items.map((item) => (
            <div key={item.label}>
              {item.heading && (
                <div
                  style={{
                    padding: '10px 16px 4px',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: '0.11em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.heading}
                </div>
              )}
              <button
                onClick={() => {
                  if (item.onClick) {
                    item.onClick();
                    return;
                  }
                  setOpen(false);
                  navigate(item.to);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '13px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid var(--hairline)',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
      {naming && (
        <NewListPrompt
          placeholder="e.g. Kitchen, Weekly shop"
          busy={starting}
          onCreate={startOwnList}
          onClose={() => setNaming(false)}
        />
      )}
    </div>
  );
}
