import { useState } from 'react';
import { getQuickAddItems, saveQuickAddItems } from '../lib/quickAdd.js';
import { CrossIcon, PencilIcon, PlusIcon } from './Icons.jsx';

/**
 * One-tap "add this to the list" shortcuts on the list page — a device-
 * level editable shortlist (not tied to any room). Purely presentational:
 * tapping a chip just calls `onAdd(name)` and the caller's own add path
 * (the same one AddBar uses) takes it from there, so a quick-added item
 * behaves identically to a typed one — same optimistic update, same
 * categorisation, same attribution.
 */
export default function QuickAdd({ onAdd }) {
  const [items, setItems] = useState(getQuickAddItems);
  const [editing, setEditing] = useState(false);
  const [newText, setNewText] = useState('');

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

  return (
    <div style={{ padding: '12px 0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 20px' }}>
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
            style={{ flexShrink: 0, background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)', cursor: 'pointer' }}
          >
            Done
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edit quick add"
            style={{ flexShrink: 0, background: 'none', border: 'none', padding: 0, display: 'flex', cursor: 'pointer' }}
          >
            <PencilIcon color="var(--text-muted)" size={14} />
          </button>
        )}
      </div>

      <div
        className={editing ? undefined : 'no-scrollbar'}
        style={
          editing
            ? { display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 20px' }
            : {
                display: 'flex',
                flexWrap: 'nowrap',
                gap: 8,
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                padding: '0 20px',
                // Right-edge padding wide enough that when the row overflows,
                // the next chip sits half-cut-off rather than flush with the
                // edge — that partial chip is what reads as "scroll me"
                // instead of "that's the whole list".
                paddingRight: 48,
              }
        }
      >
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
              onClick={() => onAdd(name)}
              style={{
                flexShrink: 0,
                padding: '10px 16px',
                borderRadius: 20,
                background: 'var(--field-bg)',
                border: '1px solid var(--hairline-strong)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
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
    </div>
  );
}
