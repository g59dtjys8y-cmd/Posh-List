import { useEffect, useRef, useState } from 'react';
import { quickAddItem } from '../lib/api.js';
import { getIdentity } from '../lib/identity.js';
import { getQuickAddItems, saveQuickAddItems } from '../lib/quickAdd.js';
import { CrossIcon, PencilIcon, PlusIcon } from './Icons.jsx';

const FEEDBACK_TIMEOUT_MS = 2200;

/**
 * One-tap "add this to today's list" shortcuts on Home — a device-level
 * editable shortlist (not tied to any room), always adding to whichever
 * list is most recently visited. That's the same "current list" every
 * other Home-level control (NavMenu, BottomNav) already assumes, so a
 * single device with several lists doesn't need to pick one here too.
 */
export default function QuickAdd({ slug, roomName, onAdded }) {
  const [items, setItems] = useState(getQuickAddItems);
  const [editing, setEditing] = useState(false);
  const [newText, setNewText] = useState('');
  const [pending, setPending] = useState(null); // item name currently being added
  const [feedback, setFeedback] = useState(null);
  const feedbackTimer = useRef(null);

  useEffect(() => () => clearTimeout(feedbackTimer.current), []);

  function showFeedback(text) {
    clearTimeout(feedbackTimer.current);
    setFeedback(text);
    feedbackTimer.current = setTimeout(() => setFeedback(null), FEEDBACK_TIMEOUT_MS);
  }

  async function handleAdd(name) {
    if (pending) return;
    setPending(name);
    try {
      // Attribute to this device's known name for that room when there is
      // one, so the toast anyone else sees reads like a person added it
      // rather than a generic source label.
      const source = getIdentity(slug)?.name || 'Quick add';
      const result = await quickAddItem(slug, name, source);
      showFeedback(
        result.incremented
          ? `${name} is now ×${result.qty} on ${roomName || 'the list'}`
          : `Added ${name} to ${roomName || 'the list'}`
      );
      onAdded?.();
    } catch {
      showFeedback(`Couldn't add ${name} — try again`);
    } finally {
      setPending(null);
    }
  }

  function removeItem(name) {
    const next = items.filter((i) => i !== name);
    setItems(next);
    saveQuickAddItems(next);
  }

  function addNewItem(e) {
    e.preventDefault();
    const name = newText.trim().slice(0, 30);
    if (!name || items.some((i) => i.toLowerCase() === name.toLowerCase())) {
      setNewText('');
      return;
    }
    const next = [...items, name].slice(0, 12);
    setItems(next);
    saveQuickAddItems(next);
    setNewText('');
  }

  if (!slug) return null;

  return (
    <div style={{ padding: '20px 20px 4px', borderTop: '1px solid var(--hairline)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.11em',
            color: 'var(--text-muted)',
          }}
        >
          QUICK ADD
        </div>
        {editing ? (
          <button
            type="button"
            onClick={() => setEditing(false)}
            style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)', cursor: 'pointer' }}
          >
            Done
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edit quick add"
            style={{ background: 'none', border: 'none', padding: 0, display: 'flex', cursor: 'pointer' }}
          >
            <PencilIcon color="var(--text-muted)" size={14} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {items.map((name) =>
          editing ? (
            <span
              key={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 8px 8px 14px',
                borderRadius: 20,
                background: 'var(--field-bg)',
                border: '1px solid var(--hairline-strong)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text)',
              }}
            >
              {name}
              <button
                type="button"
                onClick={() => removeItem(name)}
                aria-label={`Remove ${name} from quick add`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  background: 'var(--hairline-strong)',
                  border: 'none',
                  borderRadius: '50%',
                  cursor: 'pointer',
                }}
              >
                <CrossIcon color="var(--text-muted)" size={9} />
              </button>
            </span>
          ) : (
            <button
              key={name}
              type="button"
              onClick={() => handleAdd(name)}
              disabled={pending === name}
              style={{
                padding: '10px 16px',
                borderRadius: 20,
                background: 'var(--field-bg)',
                border: '1px solid var(--hairline-strong)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text)',
                cursor: 'pointer',
                opacity: pending === name ? 0.55 : 1,
              }}
            >
              + {name}
            </button>
          )
        )}

        {editing && (
          <form onSubmit={addNewItem} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Add item"
              maxLength={30}
              style={{
                width: 110,
                padding: '9px 12px',
                borderRadius: 20,
                border: '1px solid var(--hairline-strong)',
                background: '#fff',
                fontSize: 14,
                fontFamily: 'var(--font-body)',
                color: 'var(--text)',
              }}
            />
            <button
              type="submit"
              aria-label="Add quick-add item"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'var(--text)',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <PlusIcon color="#fff" size={16} />
            </button>
          </form>
        )}
      </div>

      {feedback && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>{feedback}</div>}
    </div>
  );
}
