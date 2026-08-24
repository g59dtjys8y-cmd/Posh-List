import { useState } from 'react';
import { useNavigate } from '../router.jsx';
import { createRoom } from '../lib/api.js';

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function start(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { slug } = await createRoom(name.trim() || 'Shopping list');
      navigate(`/r/${slug}`);
    } catch {
      setBusy(false);
    }
  }

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
        <span style={{ color: 'var(--brand-yellow)' }}>POSH SHOP</span>
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
        <button type="submit" disabled={busy} className="ticket" style={{ justifyContent: 'center', fontSize: 16, width: '100%' }}>
          {busy ? 'Starting…' : 'Start the list'}
        </button>
      </form>
    </div>
  );
}
