import { useRef, useState } from 'react';
import jsQR from 'jsqr';

/**
 * AadhaarAutofill — a standalone Aadhaar QR scanner that maps extracted fields
 * to the correct form fields based on the module type.
 *
 * Props:
 *   moduleName   — e.g. 'anc', 'child_growth', 'vaccination', 'birth_record', etc.
 *   personLabel  — e.g. "Mother / गर्भवती" — shown in the UI
 *   onAutofill   — callback({ fieldId: value, ... }) called after successful scan
 */

// ─── Field mappings per module ────────────────────────────────────────────────
// Aadhaar QR gives: { name, gender, dob (YYYY-MM-DD), aadhaar_raw }
// Map those to the field IDs used in each form's FIELDS array.
const MODULE_FIELD_MAP = {
  // ANC — pregnant mother
  anc: {
    name:        'mother_name',
    dob:         null,
    gender:      null,
    aadhaar_raw: 'aadhaar_number',
  },
  // Child Growth — child name + gender
  child_growth: {
    name:        'child_name',
    gender:      'gender',
    dob:         null,
    aadhaar_raw: 'aadhaar_number',
  },
  // Vaccination — child name + DOB
  vaccination: {
    name:        'child_name',
    gender:      null,
    dob:         null,           // vaccination form doesn't have dob field
    aadhaar_raw: null,
  },
  // Birth Record — mother (person being scanned is the mother)
  birth_record: {
    name:        'mother_name',
    gender:      null,
    dob:         null,
    aadhaar_raw: null,
  },
  // Death Record — deceased person
  death_record: {
    name:        'deceasedName',  // actual field ID in DeathRecord.jsx
    gender:      null,
    dob:         null,
    aadhaar_raw: null,
  },
  // Disease Surveillance — patient
  disease_surveillance: {
    name:        'patientName',   // actual field ID in DiseaseSurveillance.jsx
    gender:      null,
    dob:         null,
    aadhaar_raw: null,
  },
  // NCD Tracking — patient
  ncd_tracking: {
    name:        'patientName',   // actual field ID in NCDTracking.jsx
    gender:      null,
    dob:         null,
    aadhaar_raw: null,
  },
  // Elderly Care
  elderly_care: {
    name:        'elderlyName',   // actual field ID in ElderlyCare.jsx
    gender:      null,
    dob:         null,
    aadhaar_raw: null,
  },
  // Family Planning — beneficiary (woman)
  family_planning: {
    name:        'coupleName',    // actual field ID in FamilyPlanning.jsx
    gender:      null,
    dob:         null,
    aadhaar_raw: null,
  },
  // Village / Sanitation
  village_survey: {
    name:        'family_head_name',
    gender:      null,
    dob:         null,
    aadhaar_raw: null,
  },
  sanitation: {
    name:        'householdHead',  // actual field ID in Sanitation.jsx
    gender:      null,
    dob:         null,
    aadhaar_raw: null,
  },
  // Fallback
  default: {
    name:        'member_name',
    gender:      'gender',
    dob:         'date_of_birth',
    aadhaar_raw: 'aadhaar_number',
  },
  // Dynamic Surveys
  dynamic: {
    name:        null,
    gender:      null,
    dob:         null,
    aadhaar_raw: 'aadhaar_number',
  },
};

// ─── Parse Aadhaar QR string → structured fields ──────────────────────────────
function parseAadhaarQR(rawData) {
  try {
    // Format 1: XML ("Secure QR" or older)
    const parser = new DOMParser();
    const xml    = parser.parseFromString(rawData, 'text/xml');
    const root   = xml.documentElement;

    if (root && root.nodeName !== 'parsererror') {
      const uid    = root.getAttribute('uid') || '';
      const name   = root.getAttribute('name') || '';
      const dob    = root.getAttribute('dob') || '';   // DD-MM-YYYY or YYYY-MM-DD
      const gRaw   = root.getAttribute('gender') || '';

      const gender = gRaw === 'M' || gRaw === 'Male'   ? 'Male'
                   : gRaw === 'F' || gRaw === 'Female' ? 'Female'
                   : gRaw || '';

      // Normalise DOB to YYYY-MM-DD
      let formattedDob = '';
      if (dob) {
        const parts = dob.includes('-') ? dob.split('-') : [];
        if (parts.length === 3) {
          // DD-MM-YYYY → YYYY-MM-DD
          formattedDob = parts[0].length === 4
            ? dob   // already YYYY-MM-DD
            : `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      return { aadhaar_raw: uid, name, dob: formattedDob, gender };
    }
  } catch { /* fall through */ }

  // Format 2: URL params
  try {
    const params = new URLSearchParams(rawData.includes('?') ? rawData.split('?')[1] : rawData);
    return {
      aadhaar_raw: params.get('uid') || rawData,
      name:        params.get('name') || '',
      dob:         params.get('dob') || '',
      gender:      params.get('gender') === 'M' ? 'Male' : params.get('gender') === 'F' ? 'Female' : '',
    };
  } catch { /* fall through */ }

  // Format 3: raw number
  return { aadhaar_raw: rawData.replace(/\D/g, '').slice(0, 12), name: '', dob: '', gender: '' };
}

// ─── Derive age (years) from YYYY-MM-DD DOB ───────────────────────────────────
function ageFromDob(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const now   = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age > 0 && age < 150 ? age : null;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AadhaarAutofill({ moduleName = 'default', personLabel = '', onAutofill }) {
  const [mode,    setMode]    = useState('idle');    // idle | scanning | confirmed | error
  const [masked,  setMasked]  = useState('');
  const [filled,  setFilled]  = useState([]);        // field labels that were filled
  const [errMsg,  setErrMsg]  = useState('');

  const canvasRef = useRef(null);
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  const fieldMap = MODULE_FIELD_MAP[moduleName] || MODULE_FIELD_MAP.default;

  // ── Camera ──────────────────────────────────────────────────────────────────
  const startCamera = async () => {
    setErrMsg('');
    setMode('scanning');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          scanLoop(stream);
        }
      }, 100);
    } catch (e) {
      setErrMsg('Camera permission denied');
      setMode('idle');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const scanLoop = (stream) => {
    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext('2d');
    const video  = videoRef.current;
    if (!canvas || !ctx || !video) return;

    const tick = () => {
      if (!streamRef.current) return; // stopped
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code    = jsQR(imgData.data, imgData.width, imgData.height);
        if (code) {
          stopCamera();
          handleParsed(code.data);
          return;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // ── Parse & autofill ────────────────────────────────────────────────────────
  const handleParsed = (raw) => {
    const extracted = parseAadhaarQR(raw);
    const payload   = {};
    const labels    = [];

    if (extracted.name && fieldMap.name) {
      payload[fieldMap.name] = extracted.name;
      labels.push(fieldMap.name.replace(/_/g, ' '));
    }
    if (extracted.gender && fieldMap.gender) {
      payload[fieldMap.gender] = extracted.gender;
      labels.push('gender');
    }
    if (extracted.dob && fieldMap.dob) {
      payload[fieldMap.dob] = extracted.dob;
      labels.push('date of birth');
    }
    // Derive age if form has an 'age' field and we have DOB
    if (extracted.dob && Object.values(fieldMap).includes('age') === false) {
      // Check explicitly
      const age = ageFromDob(extracted.dob);
      if (age !== null) payload['age'] = String(age);
    }
    if (extracted.aadhaar_raw && fieldMap.aadhaar_raw) {
      payload[fieldMap.aadhaar_raw] = extracted.aadhaar_raw;
    }

    const last4 = extracted.aadhaar_raw?.slice(-4) || '????';
    setMasked(`XXXX-XXXX-XXXX-${last4}`);
    setFilled(labels);
    setMode('confirmed');
    if (Object.keys(payload).length > 0 || extracted.aadhaar_raw) {
      onAutofill(payload, extracted.aadhaar_raw);
    }
  };

  const handleManual = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    if (digits.length === 12) {
      handleParsed(digits);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (mode === 'confirmed') {
    return (
      <div style={{
        background: '#EAF3DE', border: '1px solid #1D9E75',
        borderRadius: '12px', padding: '12px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '16px',
      }}>
        <div>
          <p style={{ fontWeight: '700', color: '#085041', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span> Aadhaar scanned
          </p>
          <p style={{ fontSize: '11px', fontFamily: 'monospace', color: '#27500A', marginTop: '2px' }}>
            {masked}
          </p>
          {filled.length > 0 && (
            <p style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>
              Auto-filled: <strong>{filled.join(', ')}</strong>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMode('idle')}
          style={{ fontSize: '12px', color: '#1D9E75', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Rescan
        </button>
      </div>
    );
  }

  if (mode === 'scanning') {
    return (
      <div style={{ background: '#F5F4EF', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', background: '#000', aspectRatio: '4/3' }}>
          <video ref={videoRef} playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {/* Scanning overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: '60%', aspectRatio: '1',
              border: '2px solid rgba(29,158,117,0.8)',
              borderRadius: '8px',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
            }} />
          </div>
        </div>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <p style={{ fontSize: '12px', textAlign: 'center', color: '#555', margin: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>photo_camera</span> Point at the Aadhaar QR code
        </p>
        <button
          type="button"
          onClick={() => { stopCamera(); setMode('idle'); }}
          style={{ width: '100%', padding: '10px', background: '#fff', border: '1px solid #D3D1C7', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
        >
          Cancel
        </button>
      </div>
    );
  }

  // ── Idle / choose mode ────────────────────────────────────────────────────────
  return (
    <div style={{
      background: '#F5F4EF', border: '1px solid #D3D1C7',
      borderRadius: '12px', padding: '12px 14px', marginBottom: '16px',
    }}>
      <p style={{ fontSize: '12px', fontWeight: '700', color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>badge</span> Aadhaar Autofill {personLabel ? `— ${personLabel}` : ''}
      </p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={startCamera}
          style={{
            flex: 1, padding: '10px 8px',
            background: '#1D9E75', color: '#fff',
            border: 'none', borderRadius: '10px',
            fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>qr_code_scanner</span> Scan QR
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          style={{
            flex: 1, padding: '10px 8px',
            background: '#fff', color: '#555',
            border: '1px solid #D3D1C7', borderRadius: '10px',
            fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span> Enter Number
        </button>
      </div>
      {errMsg && <p style={{ fontSize: '12px', color: '#E24B4A', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span> {errMsg}</p>}

      {/* Manual entry input (shown inline) */}
      {mode === 'manual' && (
        <div style={{ marginTop: '10px' }}>
          <input
            type="tel"
            maxLength={12}
            autoFocus
            placeholder="12-digit Aadhaar number"
            onChange={e => handleManual(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px',
              border: '1px solid #D3D1C7', borderRadius: '10px',
              fontSize: '16px', textAlign: 'center', fontFamily: 'monospace',
              letterSpacing: '0.15em', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={() => setMode('idle')}
            style={{ marginTop: '6px', fontSize: '12px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
