import { useEffect, useRef, useState } from 'react';
import { MicIcon } from './Icons.jsx';

const SpeechRecognitionCtor =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/**
 * Pinned add field + voice button, styled as the shelf-edge ticket. The mic
 * wires to the real Web Speech API where the browser supports it; where it
 * doesn't, it renders disabled with an honest title rather than pretending
 * to transcribe.
 */
const MAX_QTY = 99;

function stepperButtonStyle(variant, disabled) {
  return {
    background: 'none',
    border: 'none',
    borderRadius: '50%',
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    lineHeight: 1,
    fontWeight: 600,
    color: variant === 'ticket' ? '#fff' : 'var(--text)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.35 : 1,
    flexShrink: 0,
  };
}

export default function AddBar({ onAdd, variant = 'ticket' }) {
  const [value, setValue] = useState('');
  const [qty, setQty] = useState(1);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!SpeechRecognitionCtor) return undefined;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-GB';
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) setValue((v) => (v ? `${v} ${transcript}` : transcript));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, []);

  function toggleMic() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    }
  }

  function addCurrentValue() {
    if (!value.trim()) return;
    onAdd(value.trim(), qty);
    setValue('');
    setQty(1);
  }

  function submit(e) {
    e.preventDefault();
    addCurrentValue();
  }

  // Belt and braces alongside the form's onSubmit: with no type="submit"
  // button in this form (the mic and stepper buttons are all type="button"
  // so they don't accidentally trigger a submit), some mobile keyboards'
  // Go/Done/tick key are inconsistent about firing native implicit form
  // submission. Handling Enter directly on the field works everywhere.
  function onInputKeyDown(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    addCurrentValue();
  }

  function stepQty(delta) {
    setQty((q) => Math.min(MAX_QTY, Math.max(1, q + delta)));
  }

  const ticketStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'var(--ticket-pink)',
    borderRadius: '0 8px 8px 0',
    padding: '13px 18px 13px 24px',
    clipPath: 'var(--shelf-notch)',
  };
  const plainStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'var(--field-bg)',
    border: '1px solid var(--hairline)',
    borderRadius: 24,
    padding: '13px 18px',
  };

  return (
    <form
      onSubmit={submit}
      style={{ flexShrink: 0, padding: '12px 16px 16px', background: '#fff', borderTop: '1px solid var(--hairline)' }}
    >
      <div style={variant === 'ticket' ? ticketStyle : plainStyle}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="Add to the list…"
          enterKeyHint="done"
          maxLength={120}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            fontSize: 15,
            fontWeight: 500,
            fontFamily: 'var(--font-body)',
            color: variant === 'ticket' ? '#fff' : 'var(--text)',
          }}
        />
        {value.trim() && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexShrink: 0,
              background: variant === 'ticket' ? 'rgba(255,255,255,0.18)' : 'var(--field-bg)',
              borderRadius: 16,
              padding: 2,
            }}
          >
            <button
              type="button"
              onClick={() => stepQty(-1)}
              disabled={qty <= 1}
              aria-label="Decrease quantity"
              style={stepperButtonStyle(variant, qty <= 1)}
            >
              −
            </button>
            <span
              style={{
                minWidth: 20,
                textAlign: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 600,
                color: variant === 'ticket' ? '#fff' : 'var(--text)',
              }}
            >
              {qty}
            </span>
            <button
              type="button"
              onClick={() => stepQty(1)}
              disabled={qty >= MAX_QTY}
              aria-label="Increase quantity"
              style={stepperButtonStyle(variant, qty >= MAX_QTY)}
            >
              +
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={toggleMic}
          disabled={!SpeechRecognitionCtor}
          title={
            SpeechRecognitionCtor
              ? listening
                ? 'Stop listening'
                : 'Add by voice'
              : "Voice input isn't supported in this browser"
          }
          style={{
            background: listening ? 'rgba(255,255,255,0.25)' : 'none',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: SpeechRecognitionCtor ? 'pointer' : 'not-allowed',
            opacity: SpeechRecognitionCtor ? 1 : 0.4,
            flexShrink: 0,
          }}
        >
          <MicIcon color={variant === 'ticket' ? '#fff' : '#5C646E'} />
        </button>
      </div>
    </form>
  );
}
