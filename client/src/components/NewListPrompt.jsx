import { useState } from 'react';

/**
 * Asks for a name before creating a list. Two rooms both silently called
 * "Shopping list" is what made a stray room indistinguishable from the real
 * one (see MyLists, Home and NavMenu's "start your own list" entries) — so
 * every entry point that creates a room routes through this instead of
 * defaulting one in behind the scenes.
 */
export default function NewListPrompt({ placeholder, busy, onCreate, onClose }) {
  const [name, setName] = useState('');

  function submit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(20,23,28,0.4)',
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '16px 16px 0 0',
          padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>
          Name this list
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          maxLength={80}
          style={{
            background: 'var(--field-bg)',
            border: '1px solid var(--hairline-strong)',
            borderRadius: 10,
            padding: '14px 16px',
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--text)',
            fontFamily: 'var(--font-body)',
          }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              background: 'none',
              border: '1px solid var(--hairline-strong)',
              borderRadius: 10,
              padding: '12px',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="ticket"
            style={{ flex: 1, justifyContent: 'center', fontSize: 14 }}
          >
            {busy ? 'Starting…' : 'Start the list'}
          </button>
        </div>
      </form>
    </div>
  );
}
