import { useState, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthStore } from '../../stores/authStore';

// ─── Register type config ─────────────────────────────────────────────────────
const REGISTER_TYPES = [
  { value: 'family_survey',  label: 'Family Survey Register (कुटुंब पाहणी)',    collection: 'household_members' },
  { value: 'village_survey', label: 'Village Health Survey (ग्राम आरोग्य)',      collection: 'village_surveys' },
  { value: 'vaccination',    label: 'Vaccination Register (लसीकरण)',             collection: 'vaccinations' },
  { value: 'anc',            label: 'ANC Register (गर्भवती)',                    collection: 'anc' },
  { value: 'child_growth',   label: 'Child Growth Register (बालवृद्धी)',          collection: 'children' },
  { value: 'birth_record',   label: 'Birth Record Register (जन्म नोंद)',          collection: 'birth_records' },
  { value: 'death_record',   label: 'Death Record Register (मृत्यू नोंद)',        collection: 'death_records' },
];

const RegisterScan = () => {
  // step: upload | processing | review | saving | done | error
  const [step, setStep]               = useState('upload');
  const [rows, setRows]               = useState([]);
  const [totalFound, setTotalFound]   = useState(0);
  const [targetCollection, setTargetCollection] = useState('household_members');
  const [registerType, setRegisterType] = useState('family_survey');
  const [error, setError]             = useState('');
  const [editingRow, setEditingRow]   = useState(null);
  const [previewUrl, setPreviewUrl]   = useState(null);
  const [savedCount, setSavedCount]   = useState(0);

  const fileInputRef  = useRef(null);
  const galleryRef    = useRef(null);
  const auth          = getAuth();
  const { ashaId: storeAshaId } = useAuthStore();

  const getAshaId = () => storeAshaId || localStorage.getItem('ashaId') || auth.currentUser?.uid;

  // ─── Compress image before sending ───────────────────────────────────────
  const compressImage = (file) => new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const img    = new Image();
    img.onload = () => {
      // Target max 1600px on the long edge, ~85% quality
      const MAX = 1600;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Compression failed'));
      }, 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });

  // ─── Main handler: compress → send directly to backend ───────────────────
  const handleFileSelect = async (file) => {
    if (!file) return;
    setError('');
    setStep('processing');

    // Show a preview of the selected image
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      const token = await user.getIdToken();

      // Compress first
      let imageBlob;
      try {
        imageBlob = await compressImage(file);
      } catch (_) {
        imageBlob = file; // use original if compression fails
      }

      // Send directly as multipart form — no Firebase Storage needed
      const formData = new FormData();
      formData.append('image', imageBlob, 'register.jpg');
      formData.append('register_type', registerType);

      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 120_000); // 2 min timeout

      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/register/extract`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Extraction failed (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const extractedRows = data.rows || [];

      if (extractedRows.length === 0) {
        throw new Error('No rows could be extracted from the image. Make sure the register page is well-lit and clearly visible.');
      }

      setRows(extractedRows);
      setTotalFound(data.total_rows_found || extractedRows.length);
      // Use collection from backend response (authoritative) or fall back to local config
      setTargetCollection(data.target_collection || REGISTER_TYPES.find(r => r.value === registerType)?.collection || 'household_members');
      setStep('review');

    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out. The image may be too large or the server is busy. Please try again.');
      } else {
        setError(err.message || 'AI extraction failed');
      }
      setStep('error');
    }
  };

  // ─── Update a single field in a row ──────────────────────────────────────
  const updateRowField = (rowIdx, field, value) => {
    setRows(prev => prev.map((r, i) =>
      i === rowIdx
        ? { ...r, fields: { ...r.fields, [field]: value }, needs_review: false }
        : r
    ));
  };

  // ─── Delete a row from review list ───────────────────────────────────────
  const deleteRow = (rowIdx) => {
    setRows(prev => prev.filter((_, i) => i !== rowIdx));
    if (editingRow === rowIdx) setEditingRow(null);
  };

  // ─── Save all reviewed rows to Firestore ─────────────────────────────────
  const saveAll = async () => {
    setStep('saving');
    setSavedCount(0);
    try {
      const ashaId = getAshaId();
      let saved = 0;
      for (const row of rows) {
        // Filter out null / empty values but keep everything else
        const cleanFields = Object.fromEntries(
          Object.entries(row.fields).filter(([, v]) => v !== null && v !== '' && v !== undefined)
        );
        const payload = {
          ...cleanFields,
          ashaId,
          source:          'ocr_import',
          registerType,
          importedAt:      serverTimestamp(),
        };
        await addDoc(collection(db, targetCollection), payload);
        saved++;
        setSavedCount(saved);
      }
      setStep('done');
    } catch (err) {
      setError(err.message);
      setStep('review');
    }
  };

  const needsReviewCount = rows.filter(r => r.needs_review).length;
  const currentRegister  = REGISTER_TYPES.find(r => r.value === registerType);

  // ─── Styles ───────────────────────────────────────────────────────────────
  const S = {
    page:    { padding: '16px', fontFamily: 'inherit' },
    card:    { background: '#fff', borderRadius: '14px', border: '1px solid #E8E6DF', padding: '16px', marginBottom: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
    label:   { fontSize: '11px', fontWeight: '700', color: '#777', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' },
    input:   { width: '100%', padding: '8px 10px', border: '1px solid #D3D1C7', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
    btn:     (bg, color='#fff') => ({ width: '100%', padding: '14px', background: bg, color, border: bg === '#fff' ? '1px solid #D3D1C7' : 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }),
    badge:   (bg, color) => ({ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', background: bg, color }),
  };

  // ═══ UPLOAD STEP ═════════════════════════════════════════════════════════
  if (step === 'upload') return (
    <div style={S.page}>
      <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px', color: '#1A1A18', display: 'flex', alignItems: 'center', gap: '8px' }}><span className="material-symbols-outlined text-[24px]">photo_camera</span> Import from Register</h2>
      <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>
        Photograph your paper ASHA register to automatically extract data.
      </p>

      {/* Register type selector */}
      <label style={S.label}>Register Type</label>
      <select
        value={registerType}
        onChange={e => setRegisterType(e.target.value)}
        style={{ ...S.input, marginBottom: '20px', padding: '12px' }}
      >
        {REGISTER_TYPES.map(r => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      {/* Target collection info */}
      <div style={{ background: '#EAF3DE', borderRadius: '10px', padding: '10px 14px', marginBottom: '20px', fontSize: '12px', color: '#27500A' }}>
        <span className="material-symbols-outlined text-[16px] align-middle mr-1">folder_open</span> Records will be saved to: <strong>{currentRegister?.collection || 'household_members'}</strong>
      </div>

      {/* Camera button */}
      <div
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed #1D9E75', borderRadius: '16px',
          padding: '48px 20px', textAlign: 'center', cursor: 'pointer',
          background: '#EAF3DE', marginBottom: '12px',
          transition: 'all 0.15s',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '52px', marginBottom: '8px' }}>photo_camera</span>
        <p style={{ fontWeight: '700', color: '#1D9E75', fontSize: '16px' }}>Take Photo of Register</p>
        <p style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
          Ensure good lighting · One page at a time
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => handleFileSelect(e.target.files[0])}
      />

      {/* Gallery button */}
      <button
        onClick={() => { galleryRef.current?.click(); }}
        style={{ ...S.btn('#fff', '#555'), marginBottom: '8px' }}
      >
        <span className="material-symbols-outlined text-[18px] align-middle mr-2">collections</span> Choose from Gallery
      </button>
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => handleFileSelect(e.target.files[0])}
      />

      {error && (
        <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '10px', padding: '12px', marginTop: '12px', color: '#E24B4A', fontSize: '13px' }}>
          <span className="material-symbols-outlined text-[16px] align-middle mr-1">error</span> {error}
        </div>
      )}
    </div>
  );

  // ═══ PROCESSING STEP ═════════════════════════════════════════════════════
  if (step === 'processing') return (
    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
      {previewUrl && (
        <img src={previewUrl} alt="Register" style={{ width: '100%', maxWidth: '300px', borderRadius: '12px', marginBottom: '20px', opacity: 0.7 }} />
      )}
      <span className="material-symbols-outlined" style={{ fontSize: '40px', display: 'inline-block', animation: 'spin 2s linear infinite' }}>smart_toy</span>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      <p style={{ fontWeight: '700', fontSize: '16px', marginTop: '16px', color: '#1A1A18' }}>AI is reading the register…</p>
      <p style={{ color: '#666', fontSize: '13px', marginTop: '4px' }}>Vision OCR + Gemini extraction in progress</p>
      <p style={{ color: '#999', fontSize: '11px', marginTop: '8px' }}>This may take 30–60 seconds</p>
    </div>
  );

  // ═══ ERROR STEP ══════════════════════════════════════════════════════════
  if (step === 'error') return (
    <div style={{ padding: '24px' }}>
      <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '14px', padding: '24px', textAlign: 'center' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#E24B4A' }}>cancel</span>
        <p style={{ fontWeight: '700', color: '#791F1F', marginTop: '12px', fontSize: '16px' }}>Extraction Failed</p>
        <p style={{ color: '#E24B4A', fontSize: '13px', marginTop: '8px' }}>{error}</p>
        <button
          onClick={() => { setError(''); setPreviewUrl(null); setStep('upload'); }}
          style={{ marginTop: '20px', padding: '12px 24px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
        >
          ← Try Again
        </button>
      </div>
    </div>
  );

  // ═══ REVIEW STEP ═════════════════════════════════════════════════════════
  if (step === 'review') return (
    <div style={S.page}>
      {/* Summary banner */}
      <div style={{ background: '#EAF3DE', borderRadius: '10px', padding: '12px 16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontWeight: '700', color: '#27500A', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '4px' }}><span className="material-symbols-outlined text-[18px]">check_circle</span> {totalFound} records extracted</p>
          <p style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>Saving to: <strong>{targetCollection}</strong></p>
        </div>
        {needsReviewCount > 0 && (
          <span style={{ ...S.badge('#FAEEDA', '#BA7517'), display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span className="material-symbols-outlined text-[14px]">warning</span> {needsReviewCount} need review</span>
        )}
      </div>

      {/* Row cards */}
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            ...S.card,
            borderLeft: `4px solid ${row.needs_review ? '#BA7517' : '#1D9E75'}`,
            background: row.needs_review ? '#FFFBF4' : '#fff',
          }}
        >
          {/* Row header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: '700', color: '#1A1A18', fontSize: '14px' }}>
                Row {row.row_number || i + 1}
              </span>
              {row.needs_review
                ? <span style={{ ...S.badge('#FAEEDA', '#BA7517'), display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span className="material-symbols-outlined text-[14px]">warning</span> Review needed</span>
                : <span style={{ ...S.badge('#EAF3DE', '#27500A'), display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span className="material-symbols-outlined text-[14px]">check_circle</span> Ready</span>
              }
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setEditingRow(editingRow === i ? null : i)}
                style={{ padding: '4px 10px', fontSize: '12px', background: '#F5F4EF', border: '1px solid #D3D1C7', borderRadius: '6px', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined text-[14px] align-middle mr-1">{editingRow === i ? 'check' : 'edit'}</span> {editingRow === i ? 'Done' : 'Edit'}
              </button>
              <button
                onClick={() => deleteRow(i)}
                style={{ padding: '4px 8px', fontSize: '12px', background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '6px', cursor: 'pointer', color: '#E24B4A' }}
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          </div>

          {/* Collapsed preview — first 3 non-null fields */}
          {editingRow !== i && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.entries(row.fields)
                .filter(([, v]) => v !== null && v !== '')
                .slice(0, 4)
                .map(([k, v]) => (
                  <span key={k} style={{ fontSize: '12px', background: '#F5F4EF', borderRadius: '6px', padding: '2px 8px', color: '#555' }}>
                    <strong>{k.replace(/_/g, ' ')}:</strong> {String(v)}
                  </span>
                ))}
              {Object.values(row.fields).filter(v => v !== null && v !== '').length > 4 && (
                <span style={{ fontSize: '12px', color: '#999' }}>+{Object.values(row.fields).filter(v => v !== null && v !== '').length - 4} more</span>
              )}
            </div>
          )}

          {/* Expanded edit form */}
          {editingRow === i && (
            <div>
              {Object.entries(row.fields).map(([field, val]) => (
                <div key={field} style={{ marginBottom: '10px' }}>
                  <label style={S.label}>{field.replace(/_/g, ' ')}</label>
                  <input
                    value={val ?? ''}
                    onChange={e => updateRowField(i, field, e.target.value)}
                    style={{
                      ...S.input,
                      borderColor: (row.unreadable_fields || []).includes(field) ? '#E24B4A' : '#D3D1C7',
                    }}
                    placeholder={`Enter ${field.replace(/_/g, ' ')}…`}
                  />
                  {(row.unreadable_fields || []).includes(field) && (
                    <p style={{ fontSize: '11px', color: '#E24B4A', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}><span className="material-symbols-outlined text-[14px]">warning</span> Could not be read clearly</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {rows.length === 0 && (
        <p style={{ textAlign: 'center', color: '#888', padding: '20px' }}>All rows deleted. ← Go back to retake.</p>
      )}

      {/* Action buttons */}
      <button
        onClick={saveAll}
        disabled={rows.length === 0}
        style={{ ...S.btn(rows.length === 0 ? '#ccc' : '#1D9E75'), marginBottom: '10px' }}
      >
        <span className="material-symbols-outlined text-[18px] align-middle mr-2">save</span> Import All {rows.length} Records &rarr; {targetCollection}
      </button>
      <button
        onClick={() => { setPreviewUrl(null); setStep('upload'); }}
        style={S.btn('#fff', '#666')}
      >
        ← Retake Photo
      </button>
    </div>
  );

  // ═══ SAVING STEP ═════════════════════════════════════════════════════════
  if (step === 'saving') return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <span className="material-symbols-outlined" style={{ fontSize: '40px' }}>save</span>
      <p style={{ fontWeight: '700', fontSize: '16px', marginTop: '16px' }}>Saving records…</p>
      <p style={{ color: '#666', fontSize: '13px', marginTop: '4px' }}>{savedCount} of {rows.length} saved</p>
      <div style={{ background: '#E8E6DF', borderRadius: '6px', height: '8px', margin: '16px 0', overflow: 'hidden' }}>
        <div style={{ width: `${(savedCount / rows.length) * 100}%`, height: '100%', background: '#1D9E75', transition: 'width 0.3s' }} />
      </div>
    </div>
  );

  // ═══ DONE STEP ═══════════════════════════════════════════════════════════
  if (step === 'done') return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <span className="material-symbols-outlined" style={{ fontSize: '56px', color: '#27500A' }}>check_circle</span>
      <p style={{ fontWeight: '700', fontSize: '20px', marginTop: '16px', color: '#27500A' }}>
        {rows.length} records imported!
      </p>
      <p style={{ color: '#666', fontSize: '13px', marginTop: '4px' }}>
        Saved to <strong>{targetCollection}</strong>
      </p>
      <button
        onClick={() => { setStep('upload'); setRows([]); setPreviewUrl(null); setError(''); setSavedCount(0); }}
        style={{ marginTop: '24px', padding: '14px 28px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '15px' }}
      >
        <span className="material-symbols-outlined text-[18px] align-middle mr-2">add_a_photo</span> Import Another Page
      </button>
    </div>
  );
};

export default RegisterScan;
