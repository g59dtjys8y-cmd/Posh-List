import { AISLE_BY_KEY } from '../lib/aisles.js';
import { CheckIcon } from './Icons.jsx';

/**
 * One row on the list: coloured aisle rail, tick circle, name, quantity
 * (Space Mono), and a dot in the colour of whoever added it. `big` gives
 * the bigger, one-handed-friendly tap targets used on the In-shop screen.
 */
export default function ItemRow({ item, onToggle, big = false }) {
  const aisle = AISLE_BY_KEY[item.aisleKey];
  const circle = big ? 30 : 22;

  return (
    <button
      onClick={() => onToggle(item)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: big ? 14 : 12,
        padding: big ? '14px 20px 14px 18px' : '11px 20px 11px 16px',
        borderBottom: '1px solid var(--hairline)',
        position: 'relative',
        width: '100%',
        minHeight: big ? 64 : undefined,
        background: 'none',
        border: 'none',
        borderBottomWidth: 1,
        borderBottomStyle: 'solid',
        borderBottomColor: 'var(--hairline)',
        textAlign: 'left',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
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
      <span
        style={{
          flex: 1,
          fontSize: big ? 17 : 15,
          fontWeight: 500,
          color: item.done ? 'var(--text-muted)' : 'var(--text)',
          textDecoration: item.done ? 'line-through' : 'none',
        }}
      >
        {item.name}
      </span>
      {item.qty > 1 && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: big ? 13 : 12,
            color: 'var(--text-muted)',
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
    </button>
  );
}
