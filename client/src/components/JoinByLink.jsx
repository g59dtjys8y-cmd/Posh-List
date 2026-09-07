import { useState } from 'react';
import { useNavigate } from '../router.jsx';
import { fetchRoom } from '../lib/api.js';

// Someone's list lives on the server, keyed by its slug — never lost. What
// *is* only ever local is this device's own memory of which lists it knows
// about (posh-list:rooms in localStorage), and that's exactly what a fresh
// "Add to Home Screen" starts with none of: iOS gives a newly (re)installed
// home-screen app its own separate storage, disconnected from whatever
// Safari tab you used to open a share link in — so simply having opened the
// link once before doesn't help the new install. This is the way back in:
// paste the same link again, here, and this install remembers it from then
// on, same as opening it fresh ever does.
function extractRoomId(input) {
  const trimmed = input.trim();
  const match = trimmed.match(/\/r\/([a-z0-9-]+)/i);
  return (match ? match[1] : trimmed).toLowerCase();
}

export default function JoinByLink({ onBrand = false }) {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const id = extractRoomId(value);
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const room = await fetchRoom(id);
      if (!room) {
        setError("Couldn't find that list — check the link and try again.");
        setBusy(false);
        return;
      }
      navigate(`/r/${id}`);
    } catch {
      setError("Couldn't reach the list right now — try again.");
      setBusy(false);
    }
  }

  const labelColor = onBrand ? 'var(--on-brand-muted)' : 'var(--text-muted)';

  return (
    <div>
      <div style={{ fontSize: 13, color: labelColor, marginBottom: 8 }}>
        Already have a list? Paste the link someone sent you.
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste a list link"
          style={{
            flex: 1,
            minWidth: 0,
            background: onBrand ? '#fff' : 'var(--field-bg)',
            border: onBrand ? 'none' : '1px solid var(--hairline-strong)',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text)',
            fontFamily: 'var(--font-body)',
          }}
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          style={{
            flexShrink: 0,
            padding: '0 18px',
            borderRadius: 10,
            border: 'none',
            background: onBrand ? 'var(--on-brand)' : 'var(--text)',
            color: onBrand ? 'var(--brand-yellow)' : '#fff',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {busy ? '…' : 'Open'}
        </button>
      </form>
      {error && (
        <div style={{ fontSize: 12, color: 'var(--ticket-pink)', marginTop: 6, fontWeight: 600 }}>{error}</div>
      )}
    </div>
  );
}
