import { useState } from 'react';

/**
 * One inline field, not a modal wall: asks a first-time visitor what to
 * call them before they can add to or tick off the list. The list itself
 * is already visible behind/around this (rooms render read-only without an
 * identity), so this never blocks anyone from seeing what's on it.
 */
export default function NameGate({ onSubmit }) {
  const [name, setName] = useState('');

  function submit(e) {
    e.preventDefault();
    if (name.trim()) onSubmit(name.trim());
  }

  return (
    <form
      onSubmit={submit}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 20px 16px',
        flexShrink: 0,
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="What should we call you?"
        maxLength={40}
        style={{
          flex: 1,
          background: 'rgba(20,23,28,0.08)',
          border: 'none',
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 15,
          fontWeight: 500,
          color: 'var(--on-brand)',
          fontFamily: 'var(--font-body)',
        }}
      />
      <button
        type="submit"
        disabled={!name.trim()}
        className="ticket"
        style={{ padding: '11px 16px 11px 20px', fontSize: 13 }}
      >
        Join the list
      </button>
    </form>
  );
}
