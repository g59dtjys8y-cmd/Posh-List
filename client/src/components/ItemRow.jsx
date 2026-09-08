import { useRef, useState } from 'react';
import { AISLE_BY_KEY } from '../lib/aisles.js';
import { CheckIcon } from './Icons.jsx';

/**
 * One row on the list: coloured aisle rail, tick circle, name, quantity
 * (Space Mono), a dot in the colour of whoever added it, and — when
 * `onDelete` is passed — a small delete control. `big` gives the bigger,
 * one-handed-friendly tap targets used on the In-shop screen.
 *
 * The tick area, the name, the delete button and the note are four
 * separate, sibling controls sharing one row (never nested inside each
 * other, which is both invalid HTML and what makes clicks unreliable).
 * The tick circle is the primary action and stays unambiguous; the name
 * is a distinct tap target only once `onRename` is passed. Without it
 * (In-the-shop mode — no room for one more thing to tap by mistake) the
 * name sits back inside the tick button exactly as before, read-only.
 *
 * `onSetNote`, when passed, makes the note editable (used on the main
 * list); without it, an existing note still shows but read-only (used in
 * the shop, where there's no room for one more thing to tap by mistake).
 */
export default function ItemRow({ item, onToggle, onDelete, onSetNote, onRename, big = false }) {
  const aisle = AISLE_BY_KEY[item.aisleKey];
  const circle = big ? 30 : 22;
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  // Escape closes the editor without saving — but removing a focused
  // input from the DOM also fires its own blur, which would otherwise
  // commit the (stale) draft a second time. This flag tells the blur
  // handler to stand down for that one close.
  const skipBlurCommit = useRef(false);

  function startEditingNote() {
    setNoteDraft(item.note || '');
    setEditingNote(true);
  }

  function saveNote(e) {
    e.preventDefault();
    onSetNote(item, noteDraft.trim());
    setEditingNote(false);
  }

  function startEditingName() {
    // Defensive: an Escape from a *previous* edit sets this to stand down
    // the unmount-triggered blur that follows it. That blur doesn't always
    // fire before the row is tapped again, so without this reset the flag
    // can still be armed here and would wrongly swallow this session's own
    // eventual commit.
    skipBlurCommit.current = false;
    setNameDraft(item.name);
    setEditingName(true);
  }

  function commitName() {
    setEditingName(false);
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === item.name) return; // empty or unchanged: close, send nothing
    onRename(item, trimmed);
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur(); // commits via onBlur below
    } else if (e.key === 'Escape') {
      e.preventDefault();
      skipBlurCommit.current = true;
      setEditingName(false);
    }
  }

  function handleNameBlur() {
    if (skipBlurCommit.current) {
      skipBlurCommit.current = false;
      return;
    }
    commitName();
  }

  const showNoteRow = editingNote || !!item.note;

  const nameTextStyle = {
    fontSize: big ? 17 : 15,
    fontWeight: 500,
    color: item.done ? 'var(--text-muted)' : 'var(--text)',
    textDecoration: item.done ? 'line-through' : 'none',
  };

  const qtyAndDot = (
    <>
      {item.qty > 1 && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: big ? 13 : 12,
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          x{item.qty}
        </span>
      )}
      {!big && (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: item.addedColor || 'var(--text-muted)',
            flexShrink: 0,
          }}
        />
      )}
    </>
  );

  return (
    <div style={{ borderBottom: '1px solid var(--hairline)' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: big ? 5 : 4,
            background: aisle?.color,
            opacity: item.done ? 0.4 : 1,
          }}
        />
        <button
          onClick={() => onToggle(item)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: big ? 14 : 12,
            padding: onRename
              ? big
                ? '14px 6px 14px 18px'
                : '11px 4px 11px 16px'
              : big
                ? '14px 12px 14px 18px'
                : '11px 10px 11px 16px',
            flex: onRename ? 'none' : 1,
            minWidth: 0,
            minHeight: big ? 64 : undefined,
            background: 'none',
            border: 'none',
            textAlign: 'left',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span
            style={{
              width: circle,
              height: circle,
              borderRadius: '50%',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: item.done ? 'none' : `2px solid var(--hairline-strong)`,
              background: item.done ? aisle?.color : 'transparent',
            }}
          >
            {item.done && <CheckIcon size={big ? 16 : 12} />}
          </span>
          {!onRename && (
            <>
              <span
                style={{
                  ...nameTextStyle,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.name}
              </span>
              {qtyAndDot}
            </>
          )}
        </button>

        {onRename && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: big ? 14 : 12,
              flex: 1,
              minWidth: 0,
              padding: big ? '14px 12px 14px 0' : '11px 10px 11px 0',
            }}
          >
            {editingName ? (
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={handleNameKeyDown}
                maxLength={120}
                style={{
                  ...nameTextStyle,
                  flex: 1,
                  minWidth: 0,
                  border: '1px solid var(--hairline-strong)',
                  borderRadius: 6,
                  padding: '2px 6px',
                  background: 'var(--field-bg)',
                  fontFamily: 'var(--font-body)',
                }}
              />
            ) : (
              <button
                type="button"
                onClick={startEditingName}
                aria-label={`Rename ${item.name}`}
                style={{
                  ...nameTextStyle,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {item.name}
              </button>
            )}
            {!editingName && qtyAndDot}
          </div>
        )}

        {onSetNote && !editingNote && (
          <button
            type="button"
            onClick={startEditingNote}
            aria-label={item.note ? `Edit note for ${item.name}` : `Add a note to ${item.name}`}
            style={{
              flexShrink: 0,
              width: big ? 40 : 32,
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: big ? 16 : 14,
              color: 'var(--icon-muted)',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            ✎
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(item)}
            aria-label={`Delete ${item.name}`}
            style={{
              flexShrink: 0,
              width: big ? 48 : 40,
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: big ? 20 : 17,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            ×
          </button>
        )}
      </div>

      {showNoteRow && (
        <div style={{ padding: big ? '0 18px 12px 62px' : '0 16px 10px 50px' }}>
          {editingNote ? (
            <form onSubmit={saveNote} style={{ display: 'flex', gap: 6 }}>
              <input
                autoFocus
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Add a note — e.g. no substitutions"
                maxLength={80}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: '1px solid var(--hairline-strong)',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 12,
                  background: 'var(--field-bg)',
                  color: 'var(--text)',
                }}
              />
              <button
                type="submit"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0 4px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Save
              </button>
            </form>
          ) : (
            item.note && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {item.note}
              </span>
            )
          )}
        </div>
      )}
    </div>
  );
}
