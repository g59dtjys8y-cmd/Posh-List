import { useState } from 'react';
import { useRoom } from '../RoomContext.jsx';
import { useNavigate } from '../router.jsx';
import { BackIcon, CrossIcon } from '../components/Icons.jsx';
import { parseIngredientsFromText } from '../lib/parseRecipeText.js';
import { categorize } from '../lib/categorize.js';
import { aisleColor } from '../lib/aisles.js';

let nextRowId = 1;
function makeRow(name) {
  return { id: nextRowId++, name, checked: true };
}

/**
 * Paste a recipe (or just its ingredients) from anywhere — a blog, a note,
 * a text someone sent — and get an editable, checkable list of what it
 * found, before anything touches the real shopping list.
 */
export default function PasteRecipe() {
  const { slug, identity, send } = useRoom();
  const navigate = useNavigate();
  const [step, setStep] = useState('paste'); // 'paste' | 'review'
  const [text, setText] = useState('');
  const [rows, setRows] = useState([]);

  function handleFindIngredients() {
    const found = parseIngredientsFromText(text);
    setRows(found.length ? found.map(makeRow) : [makeRow('')]);
    setStep('review');
  }

  function updateRow(id, patch) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  function addBlankRow() {
    setRows((rs) => [...rs, makeRow('')]);
  }

  function toggleSelectAll() {
    const allChecked = rows.every((r) => !r.name.trim() || r.checked);
    setRows((rs) => rs.map((r) => ({ ...r, checked: !allChecked })));
  }

  const checkedRows = rows.filter((r) => r.checked && r.name.trim());
  const checkedCount = checkedRows.length;
  const allSelected = rows.length > 0 && rows.every((r) => !r.name.trim() || r.checked);

  function handleSubmit() {
    if (checkedCount === 0) return;
    send({
      type: 'add_items',
      items: checkedRows.map((r) => ({ name: r.name.trim(), aisleKey: categorize(r.name) })),
      addedBy: identity?.id,
      addedColor: identity?.color,
      addedByName: identity?.name,
    });
    navigate(`/r/${slug}`);
  }

  return (
    <div className="app-page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--brand-yellow)', flexShrink: 0, padding: '20px 20px 16px' }}>
        <button
          onClick={() => (step === 'review' ? setStep('paste') : navigate(`/r/${slug}`))}
          aria-label="Back"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <BackIcon />
        </button>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 27, lineHeight: 1, color: 'var(--text)', marginTop: 12 }}>
          Add from a recipe
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.45 }}>
          {step === 'paste'
            ? 'Paste the recipe text — a blog post, a note, anything with an ingredients list in it.'
            : `Found ${rows.length} ${rows.length === 1 ? 'line' : 'lines'} — review before adding.`}
        </div>
      </div>

      {step === 'paste' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '18px 20px', gap: 14 }}>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Ingredients\n2 cups flour\n1 cup milk\n2 eggs\n\nInstructions\n1. Preheat oven to...'}
            style={{
              flex: 1,
              minHeight: 220,
              resize: 'vertical',
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid var(--hairline)',
              background: 'var(--field-bg)',
              fontSize: 14,
              lineHeight: 1.5,
              color: 'var(--text)',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={handleFindIngredients}
            disabled={!text.trim()}
            className="ticket"
            style={{ justifyContent: 'center', fontSize: 15 }}
          >
            Find ingredients
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 20px',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {checkedCount} selected
            </span>
            <button
              type="button"
              onClick={toggleSelectAll}
              style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)', cursor: 'pointer' }}
            >
              {allSelected ? 'Select none' : 'Select all'}
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
            {rows.map((row) => (
              <div
                key={row.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: '1px solid var(--hairline)',
                }}
              >
                <input
                  type="checkbox"
                  checked={row.checked}
                  onChange={(e) => updateRow(row.id, { checked: e.target.checked })}
                  style={{ width: 20, height: 20, flexShrink: 0, accentColor: 'var(--ticket-pink)' }}
                />
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: row.name.trim() ? aisleColor(categorize(row.name)) : 'var(--hairline-strong)',
                    flexShrink: 0,
                  }}
                />
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => updateRow(row.id, { name: e.target.value })}
                  placeholder="Ingredient"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    background: 'none',
                    fontSize: 15,
                    color: 'var(--text)',
                    padding: '4px 0',
                  }}
                />
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  aria-label="Remove line"
                  style={{
                    background: 'var(--hairline-strong)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <CrossIcon color="#fff" size={10} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addBlankRow}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                padding: '12px 0',
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              + Add a line
            </button>
          </div>

          <div style={{ padding: '12px 20px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={checkedCount === 0}
              className="ticket"
              style={{ width: '100%', justifyContent: 'center', fontSize: 16 }}
            >
              Add {checkedCount || ''} to list
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
