import { useVoiceRecorder } from '../hooks/useVoiceRecorder';

/**
 * Full-screen voice overlay with waveform animation and status feedback.
 * Props:
 *   moduleType   — one of the VOICE_PROMPTS keys (e.g. 'family_survey')
 *   formFields   — array of {id, label, type} matching the parent form's FIELDS definition
 *                  When provided, Gemini builds its prompt dynamically from these,
 *                  guaranteeing output keys match form field IDs exactly.
 *   onFieldsFilled(fields) — callback with extracted field object
 *   onClose()    — dismiss overlay
 */
const VoiceOverlay = ({ moduleType = 'family_survey', formFields = [], onFieldsFilled, onClose }) => {
  const {
    state, transcript, detectedCount, errorMsg,
    startRecording, stopRecording, reset,
  } = useVoiceRecorder(moduleType, (fields) => {
    if (typeof onFieldsFilled === 'function') onFieldsFilled(fields);
  }, formFields);


  const BAR_COUNT = 12;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.88)',
      zIndex: 2000,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Waveform bars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '80px', marginBottom: '28px' }}>
        {[...Array(BAR_COUNT)].map((_, i) => (
          <div
            key={i}
            style={{
              width: '6px',
              borderRadius: '3px',
              background: state === 'recording' ? '#1D9E75' : state === 'processing' ? '#BA7517' : '#444',
              height: state === 'recording' ? `${18 + Math.sin(i * 0.8) * 35 + Math.random() * 20}px` : '18px',
              transition: 'height 0.15s ease-in-out, background 0.3s',
              animation: state === 'recording' ? `voiceBar ${0.35 + i * 0.07}s ease-in-out infinite alternate` : 'none',
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes voiceBar {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1.2); }
        }
      `}</style>

      {/* Status text */}
      <p style={{ color: 'white', fontSize: '17px', fontWeight: '600', marginBottom: '8px', textAlign: 'center', maxWidth: '300px' }}>
        {state === 'idle'       && '🎙️ Tap the mic to start speaking'}
        {state === 'recording'  && '🎤 Listening… speak in Marathi or Hindi'}
        {state === 'processing' && '⏳ Processing your voice…'}
        {state === 'done'       && `✅ ${detectedCount} field${detectedCount !== 1 ? 's' : ''} filled from your voice`}
        {state === 'error'      && `❌ ${errorMsg}`}
      </p>

      {/* Transcript preview */}
      {transcript ? (
        <div style={{
          background: 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '12px',
          padding: '12px 16px',
          maxWidth: '320px', width: '100%',
          marginBottom: '20px',
          textAlign: 'center',
        }}>
          <p style={{ color: '#aaa', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Heard:</p>
          <p style={{ color: 'white', fontSize: '14px', lineHeight: '1.6' }}>{transcript}</p>
        </div>
      ) : (
        <div style={{ height: '20px', marginBottom: '20px' }} />
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        {state === 'idle' && (
          <button
            id="voice-start-btn"
            onClick={startRecording}
            style={{
              width: '76px', height: '76px', borderRadius: '50%',
              background: '#1D9E75', border: '4px solid rgba(255,255,255,0.3)',
              color: 'white', fontSize: '30px', cursor: 'pointer',
              boxShadow: '0 0 0 8px rgba(29,158,117,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            🎤
          </button>
        )}

        {state === 'recording' && (
          <button
            id="voice-stop-btn"
            onClick={stopRecording}
            style={{
              width: '76px', height: '76px', borderRadius: '50%',
              background: '#E24B4A', border: '4px solid rgba(255,255,255,0.3)',
              color: 'white', fontSize: '28px', cursor: 'pointer',
              boxShadow: '0 0 0 8px rgba(226,75,74,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pulse 1.2s ease-in-out infinite',
            }}
          >
            ⏹
          </button>
        )}

        {state === 'processing' && (
          <div style={{
            width: '76px', height: '76px', borderRadius: '50%',
            background: '#1a1a1a', border: '4px solid #BA7517',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px',
          }}>
            ⏳
          </div>
        )}

        {(state === 'done' || state === 'error') && (
          <>
            <button
              onClick={reset}
              style={{
                padding: '12px 22px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '500',
              }}
            >
              🔄 Try Again
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '12px 22px', borderRadius: '10px',
                background: state === 'done' ? '#1D9E75' : '#444',
                border: 'none',
                color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
              }}
            >
              {state === 'done' ? 'Review Form ✓' : 'Close'}
            </button>
          </>
        )}
      </div>

      {/* Cancel link */}
      {(state === 'idle' || state === 'done' || state === 'error') && (
        <button
          onClick={onClose}
          style={{
            marginTop: '28px', background: 'none', border: 'none',
            color: '#777', cursor: 'pointer', fontSize: '13px',
          }}
        >
          Cancel
        </button>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 8px rgba(226,75,74,0.15); }
          50%       { box-shadow: 0 0 0 16px rgba(226,75,74,0.05); }
        }
      `}</style>
    </div>
  );
};

export default VoiceOverlay;
