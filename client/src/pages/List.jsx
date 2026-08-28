import { useState } from 'react';
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
import { presenceText } from '../lib/presence.js';
import { categorize, parseNameAndQty } from '../lib/categorize.js';
import { createRoom } from '../lib/api.js';
import { didCreateRoom } from '../lib/identity.js';
import { useNavigate } from '../router.jsx';

const SEED_SEEN_KEY = (slug) => `posh-list:seed-prompt-seen:${slug}`;

export default function List() {
  const { slug, room, connected, identity, setName, send, activeLayout, toasts, dismissToast } = useRoom();
  const navigate = useNavigate();
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [seedDismissed, setSeedDismissed] = useState(() => {
    try {
      return localStorage.getItem(SEED_SEEN_KEY(slug)) === '1';
    } catch {
      return false;
    }
  });
  const [startingList, setStartingList] = useState(false);

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

  function handleClearDone() {
    send({ type: 'clear_done' });
    setConfirmingClear(false);
  }

  // Show the "start your own list" nudge to someone who joined via a share
  // link (didn't create this room) once they've actually used it — ticked
  // at least one thing off — and haven't dismissed it here before.
  const isGuest = !didCreateRoom(slug);
  const hasTickedSomething = room.items.some((i) => i.done && i.doneBy === identity?.id);
  const showSeedPrompt = identity && isGuest && hasTickedSomething && !seedDismissed;

  function dismissSeedPrompt() {
    setSeedDismissed(true);
    try {
      localStorage.setItem(SEED_SEEN_KEY(slug), '1');
    } catch {
      /* ignore */
    }
  }

  async function startOwnList() {
    setStartingList(true);
    try {
      const { slug: newSlug } = await createRoom('Shopping list', {
        layoutOrder: activeLayout?.order,
        from: slug,
      });
      dismissSeedPrompt();
      navigate(`/r/${newSlug}`);
    } catch {
      setStartingList(false);
    }
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
              {presenceText(room.people, identity.id)}
            </span>
          </button>
        ) : (
          <NameGate onSubmit={setName} />
        )}
      </div>

      <div style={{ padding: '18px 20px 4px', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 27, lineHeight: 1, color: 'var(--text)' }}>
          {room.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, minHeight: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {aisleCount} {aisleCount === 1 ? 'aisle' : 'aisles'} &middot; {totalItems} {totalItems === 1 ? 'item' : 'items'}
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

      <OfferBanner slug={slug} />

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
                <ItemRow key={item.id} item={item} onToggle={handleToggle} onDelete={handleDelete} />
              ))}
            </div>
          ))
        )}
      </div>

      {showSeedPrompt && (
        <div style={{ flexShrink: 0, padding: '12px 16px 0' }}>
          <div
            style={{
              background: 'var(--field-bg)',
              border: '1px solid var(--hairline)',
              borderRadius: 14,
              padding: '14px 16px',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              Like this? Start your own house's list
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.45 }}>
              A fresh list just for your household — keeps this shop's aisle order so you're not
              setting it up from scratch.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
              <button
                type="button"
                onClick={startOwnList}
                disabled={startingList}
                className="ticket"
                style={{ fontSize: 13, padding: '9px 16px 9px 22px' }}
              >
                {startingList ? 'Starting…' : 'Start my list'}
              </button>
              <button
                type="button"
                onClick={dismissSeedPrompt}
                style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      <AddBar onAdd={handleAdd} variant="ticket" />
    </div>
  );
}
