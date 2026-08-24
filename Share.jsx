import { useState } from 'react';
import { useRoom } from '../RoomContext.jsx';
import { useNavigate } from '../router.jsx';
import { BackIcon, CopyIcon, SendIcon } from '../components/Icons.jsx';
import QRCode from '../components/QRCode.jsx';
import { relativeTime } from '../lib/time.js';

function initials(name) {
  return (name || '?').trim().slice(0, 1).toUpperCase();
}

export default function Share() {
  const { room, identity } = useRoom();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const url = `${window.location.origin}/r/${room.slug}`;
  const shortUrl = url.replace(/^https?:\/\//, '');

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the visible link text is still selectable */
    }
  }

  async function sendLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: room.name, text: `Join our shopping list: ${room.name}`, url });
        return;
      } catch {
        // user cancelled the share sheet, or it's unsupported — fall through to copy
      }
    }
    copyLink();
  }

  return (
    <div
      className="app-page"
      style={{
        background: 'var(--brand-yellow)',
        display: 'flex',
        flexDirection: 'column',
        padding: '22px 20px 28px',
      }}
    >
      <button
        onClick={() => navigate(`/r/${room.slug}`)}
        aria-label="Back to the list"
        style={{ background: 'none', border: 'none', padding: 0, alignSelf: 'flex-start', cursor: 'pointer' }}
      >
        <BackIcon />
      </button>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 36, lineHeight: 1, color: 'var(--on-brand)' }}>
          Share the list
        </div>
        <div style={{ fontSize: 14, color: 'var(--on-brand-muted)', marginTop: 10, lineHeight: 1.45 }}>
          Anyone with this link jumps straight onto the live list. No sign-up, no app to explain.
        </div>
      </div>

      <div
        style={{
          marginTop: 22,
          background: '#fff',
          borderRadius: 20,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          boxShadow: '0 14px 30px rgba(20,23,28,0.16)',
        }}
      >
        <QRCode text={url} size={168} />
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Scan to join, or use the link</div>
        <button
          onClick={copyLink}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--field-bg)',
            border: '1px solid var(--hairline)',
            borderRadius: 10,
            padding: '11px 12px',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              flex: 1,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'left',
            }}
          >
            {copied ? 'Copied to clipboard' : shortUrl}
          </span>
          <CopyIcon />
        </button>
      </div>

      <button onClick={sendLink} className="ticket" style={{ marginTop: 18, justifyContent: 'center', width: '100%', fontSize: 17 }}>
        <SendIcon />
        Send link
      </button>

      <div style={{ marginTop: 24, flex: 1, overflow: 'hidden' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', color: 'var(--on-brand-muted)', marginBottom: 12 }}>
          ON THE LIST NOW
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {room.people.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: p.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {initials(p.name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-brand)' }}>
                  {p.id === identity?.id ? 'You' : p.name}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--on-brand-muted)' }}>
                  {p.connected ? 'Online now' : `Last seen ${relativeTime(p.lastSeen)}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
