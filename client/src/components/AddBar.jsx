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
export default function AddBar({ onAdd, variant = 'ticket' }) {
  const [value, setValue] = useState('');
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

  function submit(e) {
    e.preventDefault();
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue('');
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
          placeholder="Add to the list…"
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
