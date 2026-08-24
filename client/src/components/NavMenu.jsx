import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '../router.jsx';
import { MenuIcon } from './Icons.jsx';

export default function NavMenu({ slug }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const items = [
    { label: 'Share the list', to: `/r/${slug}/share` },
    { label: 'In the shop', to: `/r/${slug}/shop` },
    { label: 'Layouts', to: `/r/${slug}/layouts` },
    { label: 'Your lists', to: '/lists' },
  ];

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
            minWidth: 180,
          }}
        >
          {items.map((item) => (
            <button
              key={item.to}
              onClick={() => {
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
          ))}
        </div>
      )}
    </div>
  );
}
