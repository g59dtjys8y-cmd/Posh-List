import { useState } from 'react';
import { useRoom } from '../RoomContext.jsx';
import { useNavigate } from '../router.jsx';
import { BackIcon, PencilIcon, CrossIcon, PlusIcon } from '../components/Icons.jsx';
import QRCode from '../components/QRCode.jsx';
import { compressImageFile } from '../lib/imageResize.js';

/**
 * A household's loyalty/membership cards. A typed membership number renders
 * as a real QR code (works for schemes whose scanner app accepts a QR
 * encoding of the plain number — Tesco Clubcard, Co-op); a photo of the
 * actual card is the fallback for schemes that don't (several use a linear
 * barcode a generic QR can't reproduce — Nectar, Waitrose/Stocard). Either
 * field alone is enough to save a card; both is fine too.
 */
export default function LoyaltyCards() {
  const { slug, room, send } = useRoom();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null); // null = not editing, 'new' = adding
  const [label, setLabel] = useState('');
  const [codeValue, setCodeValue] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState(undefined); // undefined = unchanged, null = cleared, string = new photo
  const [photoPreviouslySet, setPhotoPreviouslySet] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!room) return null;
  const cards = room.loyaltyCards || [];

  function startAdd() {
    setEditingId('new');
    setOpenId(null);
    setLabel('');
    setCodeValue('');
    setPhotoDataUrl(undefined);
    setPhotoPreviouslySet(false);
    setPhotoError(null);
  }

  function startEdit(card) {
    setEditingId(card.id);
    setOpenId(null);
    setLabel(card.label);
    setCodeValue(card.codeValue || '');
    setPhotoDataUrl(undefined);
    setPhotoPreviouslySet(card.hasPhoto);
    setPhotoError(null);
  }

  function cancelForm() {
    setEditingId(null);
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError(null);
    try {
      const dataUrl = await compressImageFile(file);
      setPhotoDataUrl(dataUrl);
    } catch {
      setPhotoError("Couldn't use that photo — try another.");
    }
  }

  function removePhoto() {
    setPhotoDataUrl(null);
    setPhotoPreviouslySet(false);
  }

  function saveForm(e) {
    e.preventDefault();
    const trimmedLabel = label.trim().slice(0, 40);
    if (!trimmedLabel) return;
    setSaving(true);
    if (editingId === 'new') {
      send({ type: 'add_loyalty_card', label: trimmedLabel, codeValue: codeValue.trim(), photoDataUrl });
    } else {
      send({
        type: 'update_loyalty_card',
        cardId: editingId,
        label: trimmedLabel,
        codeValue: codeValue.trim(),
        photoDataUrl: photoDataUrl || undefined,
        clearPhoto: photoDataUrl === null,
      });
    }
    setEditingId(null);
    setSaving(false);
  }

  function removeCard(card) {
    send({ type: 'delete_loyalty_card', cardId: card.id });
    if (openId === card.id) setOpenId(null);
  }

  const showingPhotoPreview = photoDataUrl || (photoDataUrl === undefined && photoPreviouslySet);

  return (
    <div className="app-page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--brand-yellow)', flexShrink: 0, padding: '20px 20px 16px' }}>
        <button
          onClick={() => navigate(`/r/${slug}`)}
          aria-label="Back to the list"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <BackIcon />
        </button>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 27, lineHeight: 1, color: 'var(--text)', marginTop: 12 }}>
          Loyalty cards
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
          {cards.length === 0
            ? 'Add a card and everyone in the house can show it at the till'
            : `${cards.length} ${cards.length === 1 ? 'card' : 'cards'} saved`}
        </div>
      </div>

      <div style={{ flex: 1, padding: '6px 0' }}>
        {cards.length === 0 && editingId === null && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            No cards yet. Type a membership number for a scannable QR, add a photo of the card, or both.
          </div>
        )}

        {cards.map((card) => (
          <div key={card.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setOpenId((id) => (id === card.id ? null : card.id))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '13px 20px',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'var(--field-bg)',
                  flexShrink: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {card.hasPhoto ? (
                  <img
                    src={`/api/rooms/${slug}/loyalty-cards/${card.id}/photo`}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : card.codeValue ? (
                  <QRCode text={card.codeValue} size={26} />
                ) : (
                  <span style={{ fontSize: 15 }}>💳</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                {card.label}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(card);
                }}
                aria-label={`Edit ${card.label}`}
                style={{ background: 'none', border: 'none', padding: 6, margin: -6, cursor: 'pointer', flexShrink: 0 }}
              >
                <PencilIcon size={15} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeCard(card);
                }}
                aria-label={`Delete ${card.label}`}
                style={{ background: 'none', border: 'none', padding: 6, margin: -6, cursor: 'pointer', flexShrink: 0 }}
              >
                <CrossIcon color="var(--icon-muted)" size={13} />
              </button>
            </div>

            {openId === card.id && (
              <div
                style={{
                  padding: '4px 20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                {card.hasPhoto && (
                  <img
                    src={`/api/rooms/${slug}/loyalty-cards/${card.id}/photo`}
                    alt={card.label}
                    style={{ width: '100%', maxWidth: 320, borderRadius: 14, boxShadow: '0 8px 22px rgba(20,23,28,0.16)' }}
                  />
                )}
                {card.codeValue && (
                  <div
                    style={{
                      background: '#fff',
                      border: '1px solid var(--hairline)',
                      borderRadius: 16,
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <QRCode text={card.codeValue} size={180} />
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
                      {card.codeValue}
                    </div>
                  </div>
                )}
                {!card.hasPhoto && !card.codeValue && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    No number or photo saved for this card yet.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {editingId !== null ? (
        <form
          onSubmit={saveForm}
          style={{
            flexShrink: 0,
            padding: '16px 20px',
            background: '#fff',
            borderTop: '1px solid var(--hairline)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Card name — e.g. Tesco Clubcard"
            maxLength={40}
            style={{
              background: 'var(--field-bg)',
              border: '1px solid var(--hairline-strong)',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--text)',
              fontFamily: 'var(--font-body)',
            }}
          />
          <input
            value={codeValue}
            onChange={(e) => setCodeValue(e.target.value)}
            placeholder="Membership number (optional — shown as a QR code)"
            maxLength={40}
            style={{
              background: 'var(--field-bg)',
              border: '1px solid var(--hairline-strong)',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 15,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text)',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {showingPhotoPreview ? (
              <>
                <img
                  src={photoDataUrl || `/api/rooms/${slug}/loyalty-cards/${editingId}/photo`}
                  alt=""
                  style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-muted)', flex: 1 }}>Photo added</span>
                <button
                  type="button"
                  onClick={removePhoto}
                  style={{ background: 'none', border: 'none', padding: '6px 4px', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  Remove
                </button>
              </>
            ) : (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  padding: '10px 12px',
                  border: '1px dashed var(--hairline-strong)',
                  borderRadius: 10,
                  flex: 1,
                }}
              >
                <PlusIcon size={16} />
                Add a photo of the card (optional fallback)
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} style={{ display: 'none' }} />
              </label>
            )}
          </div>
          {photoError && <div style={{ fontSize: 12, color: 'var(--ticket-pink)' }}>{photoError}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={cancelForm}
              style={{
                flex: 1,
                background: 'var(--field-bg)',
                border: 'none',
                borderRadius: 10,
                padding: '12px 0',
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
              disabled={saving || !label.trim()}
              className="ticket"
              style={{ flex: 2, justifyContent: 'center', fontSize: 15 }}
            >
              {editingId === 'new' ? 'Add card' : 'Save changes'}
            </button>
          </div>
        </form>
      ) : (
        <div style={{ flexShrink: 0, padding: '12px 16px 16px', background: '#fff', borderTop: '1px solid var(--hairline)' }}>
          <button type="button" onClick={startAdd} className="ticket" style={{ justifyContent: 'center', fontSize: 16, width: '100%' }}>
            + Add a card
          </button>
        </div>
      )}
    </div>
  );
}
