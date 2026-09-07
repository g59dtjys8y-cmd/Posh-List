import { useState } from 'react';
import { Link } from '../router.jsx';
import { requestRecoveryEmail } from '../lib/api.js';

/**
 * The last resort for a device that's lost every list it knew about (see
 * JoinByLink.jsx) and never saved a link anywhere else either — no room to
 * open here, just an email to check against whatever's been attached to a
 * list via Share.jsx. Always shows the same confirmation regardless of
 * whether anything actually matched, so this page can't be used to find
 * out whether a given email is registered to a list.
 */
export default function Recover() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await requestRecoveryEmail(trimmed);
      setSent(true);
    } catch {
      setError("Couldn't reach the server right now — try again.");
    } finally {
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
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, lineHeight: 1.1, color: 'var(--on-brand)' }}>
        Recover your lists
      </div>

      {sent ? (
        <div style={{ marginTop: 20, maxWidth: 420 }}>
          <div style={{ fontSize: 15, color: 'var(--on-brand)', lineHeight: 1.5, fontWeight: 600 }}>
            If that email has any lists attached, we've sent the links — check your inbox.
          </div>
          <Link
            to="/"
            style={{
              display: 'inline-block',
              marginTop: 20,
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--on-brand)',
              textDecoration: 'underline',
            }}
          >
            Back to Posh List
          </Link>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 15, color: 'var(--on-brand-muted)', marginTop: 12, lineHeight: 1.5, maxWidth: 420 }}>
            If you've ever attached an email to one of your lists (on its Share screen), type it
            below and we'll email you every list link it's attached to.
          </div>

          <form onSubmit={handleSubmit} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
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
            <button type="submit" disabled={busy || !email.trim()} className="ticket" style={{ justifyContent: 'center', fontSize: 16, width: '100%' }}>
              {busy ? 'Sending…' : 'Send me my list links'}
            </button>
          </form>
          {error && <div style={{ fontSize: 13, color: 'var(--on-brand)', marginTop: 10, fontWeight: 600 }}>{error}</div>}

          <Link
            to="/"
            style={{
              display: 'inline-block',
              marginTop: 24,
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--on-brand-muted)',
            }}
          >
            Back to Posh List
          </Link>
        </>
      )}
    </div>
  );
}
