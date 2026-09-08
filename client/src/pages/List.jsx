import { useRef, useState } from 'react';
import { useRoom } from '../RoomContext.jsx';
import PresenceAvatars from '../components/PresenceAvatars.jsx';
import NavMenu from '../components/NavMenu.jsx';
import NameGate from '../components/NameGate.jsx';
import OfferBanner from '../components/OfferBanner.jsx';
import AddBar from '../components/AddBar.jsx';
import ItemRow from '../components/ItemRow.jsx';
import Toast from '../components/Toast.jsx';
import BadgePrompt from '../components/BadgePrompt.jsx';
import { AISLE_BY_KEY } from '../lib/aisles.js';
import { livePresenceText } from '../lib/presence.js';
import { categorize, parseNameAndQty } from '../lib/categorize.js';
import { useNavigate, Link } from '../router.jsx';

export default function List() {
  const { slug, room, connected, roomGone, identity, setName, send, activeLayout, toasts, dismissToast, shoppingNotice, dismissShoppingNotice } = useRoom();
  const navigate = useNavigate();
  const addBarRef = useRef(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  // The room's link stopped working outright — either this device was
  // removed (see Share.jsx), or it's a stale link that moved while this
  // device wasn't connected to hear about it directly. Retrying can't ever
  // succeed, so say so instead of "Reconnecting…" forever.
  if (roomGone) {
    return (
      <div
        className="app-page"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          paddingTop: 32,
          paddingLeft: 24,
          paddingRight: 24,
          // Longhand — see Share.jsx for why: `padding` shorthand would
          // set padding-bottom too and clobber .app-page's own reserved
          // space for the fixed BottomNav rendered below this page.
          paddingBottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 32px)',
        }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>
          This list isn't here any more
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 10, maxWidth: 320, lineHeight: 1.5 }}>
          The link you used no longer works. If someone shares this list with you, ask them for the
          current link — or if you'd attached an email to it before, you can recover it that way.
        </div>
        <Link to="/recover" style={{ marginTop: 20, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          Recover by email
        </Link>
        {/* Not "/" — the launcher there redirects to the most-recently-visited
            room, which is this same dead one, bouncing straight back here. */}
        <Link to="/home" style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
          Back to Posh List
        </Link>
      </div>
    );
  }

  if (!room) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading the list…</div>
    );
  }

  const order = activeLayout?.order || [];
  const groups = order
    .map((aisleKey) => ({
      aisleKey,
      items: room.items.filter((i) => i.aisleKey === aisleKey),
    }))
    .filter((g) => g.items.length > 0);

  const totalItems = room.items.length;
  const aisleCount = groups.length;
  const doneCount = room.items.filter((i) => i.done).length;

  const regulars = room.regulars || [];
  const usualsToAdd = regulars.filter((r) => !r.onList).length;

  function handleAddUsuals() {
    send({
      type: 'add_usuals',
      addedBy: identity?.id,
      addedColor: identity?.color,
      addedByName: identity?.name,
    });
  }

  function handleAdd(raw, stepperQty) {
    const { name, qty: typedQty } = parseNameAndQty(raw);
    if (!name) return;
    // The quantity stepper on the add bar wins once it's touched; typing
    // "milk x2" still works as a shortcut if the stepper is left at 1.
    const qty = stepperQty && stepperQty > 1 ? stepperQty : typedQty;
    send({
      type: 'add_item',
      name,
      qty,
      aisleKey: categorize(name),
      addedBy: identity?.id,
      addedColor: identity?.color,
      addedByName: identity?.name,
    });
  }

  function handleToggle(item) {
    send({ type: 'toggle_item', itemId: item.id, done: !item.done, doneBy: identity?.id });
  }

  function handleDelete(item) {
    send({ type: 'delete_item', itemId: item.id });
  }

  function handleSetNote(item, note) {
    send({ type: 'set_item_note', itemId: item.id, note });
  }

  // Re-categorizing on rename is deliberate: correcting a name across
  // aisles (e.g. "juice" -> "orange juice") should move the item into its
  // new aisle group, same as it would if typed that way from scratch.
  function handleRename(item, newName) {
    send({ type: 'rename_item', itemId: item.id, name: newName, aisleKey: categorize(newName) });
  }

  function handleClearDone() {
    send({ type: 'clear_done' });
    setConfirmingClear(false);
  }

  function startEditingName() {
    setNameDraft(room.name);
    setEditingName(true);
  }

  function saveName(e) {
    e.preventDefault();
    const name = nameDraft.trim();
    if (name && name !== room.name) send({ type: 'rename_room', name });
    setEditingName(false);
  }

  return (
    <div className="app-page" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onClose={() => dismissToast(t.id)} />
      ))}
      <div style={{ background: 'var(--brand-yellow)', flexShrink: 0, padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.16em',
              color: 'var(--on-brand)',
            }}
          >
            POSH LIST
          </div>
          <NavMenu slug={slug} />
        </div>

        {identity ? (
          <button
            onClick={() => navigate(`/r/${slug}/share`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <PresenceAvatars people={room.people} />
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--aisle-fruit-veg)', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--on-brand)' }}>
              {livePresenceText(room.people, identity.id, room.shopping)}
            </span>
          </button>
        ) : (
          <NameGate onSubmit={setName} />
        )}
      </div>

      <div style={{ padding: '18px 20px 4px', flexShrink: 0 }}>
        {editingName ? (
          <form onSubmit={saveName} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={80}
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 22,
                color: 'var(--text)',
                border: '1px solid var(--hairline-strong)',
                borderRadius: 8,
                padding: '6px 10px',
                background: 'var(--field-bg)',
              }}
            />
            <button
              type="submit"
              style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)', cursor: 'pointer', flexShrink: 0 }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingName(false)}
              style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={startEditingName}
            aria-label="Rename this list"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              maxWidth: '100%',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 27,
                lineHeight: 1,
                color: 'var(--text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {room.name}
            </span>
            <span style={{ fontSize: 14, color: 'var(--icon-muted)', flexShrink: 0 }}>✎</span>
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, minHeight: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {aisleCount} {aisleCount === 1 ? 'aisle' : 'aisles'} &middot; {totalItems} {totalItems === 1 ? 'item' : 'items'}
            {' '}&middot;{' '}
            <Link
              to={`/r/${slug}/loyalty-cards`}
              style={{ font: 'inherit', color: 'var(--text)', fontWeight: 700, textDecoration: 'none' }}
            >
              Loyalty cards
            </Link>
          </div>
          {doneCount > 0 &&
            (confirmingClear ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Clear {doneCount} ticked {doneCount === 1 ? 'item' : 'items'}?
                </span>
                <button
                  type="button"
                  onClick={handleClearDone}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: 'var(--text)', cursor: 'pointer' }}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingClear(false)}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                Clear ticked ({doneCount})
              </button>
            ))}
        </div>
      </div>

      <BadgePrompt />

      {!connected && (
        <div
          style={{
            padding: '8px 20px',
            fontSize: 12,
            fontWeight: 600,
            textAlign: 'center',
            color: 'var(--text-muted)',
            background: 'var(--field-bg)',
            borderBottom: '1px solid var(--hairline)',
          }}
        >
          Reconnecting… changes will send once you're back online
        </div>
      )}

      <OfferBanner />

      {shoppingNotice && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '11px 20px',
            background: 'var(--brand-yellow)',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            flexShrink: 0,
          }}
        >
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--on-brand)' }}>
            {shoppingNotice.name}&rsquo;s at the shop — anything to add?
          </span>
          <button
            type="button"
            onClick={() => {
              addBarRef.current?.focus();
              dismissShoppingNotice();
            }}
            style={{ background: 'var(--on-brand)', color: 'var(--brand-yellow)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
          >
            Add something
          </button>
          <button
            type="button"
            onClick={dismissShoppingNotice}
            aria-label="Dismiss"
            style={{ background: 'none', border: 'none', padding: '4px 2px', fontSize: 15, color: 'var(--on-brand)', cursor: 'pointer', flexShrink: 0 }}
          >
            ×
          </button>
        </div>
      )}

      {totalItems > 0 && usualsToAdd > 0 && (
        <div style={{ padding: '10px 20px 2px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleAddUsuals}
            className="ticket"
            style={{ fontSize: 13, padding: '9px 16px 9px 22px' }}
          >
            + Add the usuals ({usualsToAdd})
          </button>
        </div>
      )}

      <div style={{ flex: 1 }}>
        {totalItems === 0 ? (
          <div style={{ padding: '44px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            {usualsToAdd > 0 ? (
              <>
                <div style={{ marginBottom: 16 }}>Fresh list. Want to start from your usuals?</div>
                <button
                  type="button"
                  onClick={handleAddUsuals}
                  className="ticket"
                  style={{ margin: '0 auto', fontSize: 15 }}
                >
                  Start with your usuals ({usualsToAdd})
                </button>
              </>
            ) : (
              'Nothing on the list yet — add the first thing'
            )}
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.aisleKey}>
              <div
                style={{
                  padding: '16px 20px 6px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: '0.11em',
                  color: AISLE_BY_KEY[group.aisleKey]?.color,
                }}
              >
                {AISLE_BY_KEY[group.aisleKey]?.label.toUpperCase()}
              </div>
              {group.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onSetNote={handleSetNote}
                  onRename={handleRename}
                />
              ))}
            </div>
          ))
        )}
      </div>

      <AddBar ref={addBarRef} onAdd={handleAdd} variant="ticket" />
    </div>
  );
}
