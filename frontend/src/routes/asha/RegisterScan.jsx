import { useState, useRef } from 'react';
import { getStorage, ref, uploadBytes } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthStore } from '../../stores/authStore';

const RegisterScan = () => {
  // step: upload | uploading | processing | review | saving | done | error
  const [step, setStep] = useState('upload');
  const [rows, setRows] = useState([]);
  const [totalFound, setTotalFound] = useState(0);
  const [registerType, setRegisterType] = useState('family_survey');
  const [storagePath, setStoragePath] = useState('');
  const [error, setError] = useState('');
  const [editingRow, setEditingRow] = useState(null);
  const fileInputRef = useRef(null);
  const auth = getAuth();
  const storage = getStorage();
  const { ashaId: storeAshaId } = useAuthStore();

  const getAshaId = () => storeAshaId || localStorage.getItem('ashaId') || auth.currentUser?.uid;

  const compressImage = (file) => new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, Math.sqrt((1024 * 1024) / file.size));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Image compression failed'));
      }, 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });

  const handleFileSelect = async (file) => {
    if (!file) return;
    setError('');
    setStep('uploading');
    console.log('[RegisterScan] Step: uploading');

    let path = '';
    try {
      // Step 1: Compress
      const compressed = await compressImage(file);
      
      // Step 2: Upload to Cloud Storage
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      path = `registers/${user.uid}/${Date.now()}.jpg`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, compressed);
      setStoragePath(path);
      console.log('[RegisterScan] Upload complete, path:', path);
    } catch (err) {
      console.error('[RegisterScan] Upload failed:', err);
      setError(`Upload failed: ${err.message}`);
      setStep('upload');
      return;
    }

    setStep('processing');
    console.log('[RegisterScan] Step: processing — calling extract API');

    try {
      const user = auth.currentUser;
      const token = await user.getIdToken();
      
      // Add 90-second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/register/extract`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: path, register_type: registerType }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      console.log('[RegisterScan] Extract API response status:', res.status);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Extraction failed (${res.status}): ${errText}`);
      }
      
      const data = await res.json();
      console.log('[RegisterScan] Extracted rows:', data.rows?.length);
      setRows(data.rows || []);
      setTotalFound(data.total_rows_found || data.rows?.length || 0);
      setStep('review');
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out after 90 seconds. The image may be too large or the server is busy.');
      } else {
        console.error('[RegisterScan] Extract API failed:', err);
        setError(`AI extraction failed: ${err.message}`);
      }
      setStep('error');
    }
  };

  const updateRowField = (rowIdx, field, value) => {
    setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, fields: { ...r.fields, [field]: value }, needs_review: false } : r));
  };

  const saveAll = async () => {
    setStep('saving');
    try {
      const ashaId = getAshaId();
      let saved = 0;
      
      for (const row of rows) {
        const payload = {
          ...row.fields,
          ashaId,
          source: 'ocr_import',
          storagePath,
          createdAt: serverTimestamp()
        };
        
        if (registerType === 'family_survey') {
          await addDoc(collection(db, 'household_members'), payload);
        } else if (registerType === 'village_survey') {
          await addDoc(collection(db, 'village_surveys'), payload);
        } else if (registerType === 'vaccination') {
          await addDoc(collection(db, 'vaccinations'), payload);
        }
        saved++;
      }
      
      setStep('done');
    } catch (err) {
      setError(err.message);
      setStep('review');
    }
  };

  const needsReviewCount = rows.filter(r => r.needs_review).length;

  // ── RENDER ──────────────────────────────────────────────────────────────
  if (step === 'upload') return (
    <div style={{padding:'20px'}}>
      <h2 style={{fontSize:'18px',fontWeight:'600',marginBottom:'8px'}}>📷 Import from Register</h2>
      <p style={{color:'#666',fontSize:'13px',marginBottom:'16px'}}>Photograph your paper ASHA register to import data automatically.</p>
      
      <select value={registerType} onChange={e => setRegisterType(e.target.value)} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'1px solid #ddd',marginBottom:'16px',fontSize:'14px'}}>
        <option value="family_survey">Family Survey Register (कुटुंब पाहणी)</option>
        <option value="village_survey">Village Health Survey (ग्राम आरोग्य)</option>
        <option value="vaccination">Vaccination Register (लसीकरण)</option>
      </select>
      
      <div onClick={() => fileInputRef.current?.click()} style={{border:'2px dashed #1D9E75',borderRadius:'12px',padding:'40px 20px',textAlign:'center',cursor:'pointer',background:'#EAF3DE'}}>
        <div style={{fontSize:'48px'}}>📷</div>
        <p style={{fontWeight:'600',color:'#1D9E75',marginTop:'8px'}}>Tap to photograph register</p>
        <p style={{color:'#666',fontSize:'12px',marginTop:'4px'}}>Photograph one page at a time for best accuracy</p>
      </div>
      
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e => handleFileSelect(e.target.files[0])} />
      
      <button onClick={() => { fileInputRef.current.removeAttribute('capture'); fileInputRef.current?.click(); }} style={{width:'100%',padding:'12px',marginTop:'12px',border:'1px solid #ddd',borderRadius:'8px',background:'white',color:'#666',cursor:'pointer'}}>
        🖼️ Choose from Gallery
      </button>
      
      {error && <p style={{color:'#E24B4A',marginTop:'12px',fontSize:'13px'}}>❌ {error}</p>}
    </div>
  );

  if (step === 'uploading') return (
    <div style={{padding:'40px',textAlign:'center'}}>
      <div style={{fontSize:'32px'}}>⬆️</div>
      <p style={{marginTop:'12px',color:'#666',fontWeight:'600'}}>Uploading photo to storage...</p>
      <p style={{color:'#999',fontSize:'12px',marginTop:'4px'}}>Please wait</p>
    </div>
  );
  
  if (step === 'processing') return (
    <div style={{padding:'40px',textAlign:'center'}}>
      <div style={{fontSize:'32px',display:'inline-block',animation:'spin 2s linear infinite'}}>🤖</div>
      <p style={{fontWeight:'600',marginTop:'12px'}}>AI is reading your register...</p>
      <p style={{color:'#666',fontSize:'13px',marginTop:'4px'}}>Extracting all rows and fields</p>
      <p style={{color:'#999',fontSize:'11px',marginTop:'8px'}}>This may take up to 60 seconds</p>
    </div>
  );

  if (step === 'error') return (
    <div style={{padding:'24px'}}>
      <div style={{background:'#FCEBEB',border:'1px solid #E24B4A',borderRadius:'12px',padding:'20px',textAlign:'center'}}>
        <div style={{fontSize:'32px'}}>❌</div>
        <p style={{fontWeight:'600',color:'#791F1F',marginTop:'8px'}}>Extraction Failed</p>
        <p style={{color:'#E24B4A',fontSize:'13px',marginTop:'8px'}}>{error}</p>
        <button onClick={() => { setError(''); setStep('upload'); }} style={{marginTop:'16px',padding:'10px 20px',background:'#1D9E75',color:'white',border:'none',borderRadius:'8px',cursor:'pointer',fontWeight:'600'}}>
          Try Again
        </button>
      </div>
    </div>
  );

  if (step === 'review') return (
    <div style={{padding:'16px'}}>
      <div style={{background:'#EAF3DE',borderRadius:'8px',padding:'12px',marginBottom:'8px'}}>
        <p style={{fontWeight:'600',color:'#27500A'}}>✓ {totalFound} records found</p>
      </div>
      {needsReviewCount > 0 && (
        <div style={{background:'#FAEEDA',borderRadius:'8px',padding:'12px',marginBottom:'12px'}}>
          <p style={{color:'#633806',fontSize:'13px'}}>⚠️ {needsReviewCount} rows need your review (shown in amber)</p>
        </div>
      )}
      
      {/* Table view */}
      <div style={{overflowX:'auto',marginBottom:'16px'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
          <thead>
            <tr style={{background:'#f5f5f5'}}>
              <th style={{padding:'8px',textAlign:'left',borderBottom:'1px solid #ddd'}}>#</th>
              <th style={{padding:'8px',textAlign:'left',borderBottom:'1px solid #ddd'}}>Name</th>
              <th style={{padding:'8px',textAlign:'left',borderBottom:'1px solid #ddd'}}>Gender</th>
              <th style={{padding:'8px',textAlign:'left',borderBottom:'1px solid #ddd'}}>DOB</th>
              <th style={{padding:'8px',textAlign:'left',borderBottom:'1px solid #ddd'}}>Mobile</th>
              <th style={{padding:'8px',borderBottom:'1px solid #ddd'}}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{background: row.needs_review ? '#FAEEDA' : 'white'}} onClick={() => setEditingRow(editingRow === i ? null : i)}>
                <td style={{padding:'8px',borderBottom:'1px solid #f0f0f0'}}>{row.row_number || i+1}</td>
                <td style={{padding:'8px',borderBottom:'1px solid #f0f0f0',fontWeight:'500'}}>{row.fields.member_name || <span style={{color:'#ccc'}}>?</span>}</td>
                <td style={{padding:'8px',borderBottom:'1px solid #f0f0f0'}}>{row.fields.gender || '?'}</td>
                <td style={{padding:'8px',borderBottom:'1px solid #f0f0f0'}}>{row.fields.date_of_birth || '?'}</td>
                <td style={{padding:'8px',borderBottom:'1px solid #f0f0f0'}}>{row.fields.mobile_number || '-'}</td>
                <td style={{padding:'8px',borderBottom:'1px solid #f0f0f0',textAlign:'center'}}>
                  {row.needs_review ? <span style={{color:'#BA7517'}}>⚠️</span> : <span style={{color:'#1D9E75'}}>✓</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inline edit for selected row */}
      {editingRow !== null && (
        <div style={{background:'white',border:'1px solid #1D9E75',borderRadius:'8px',padding:'16px',marginBottom:'16px'}}>
          <p style={{fontWeight:'600',marginBottom:'12px',fontSize:'14px'}}>Edit Row {editingRow + 1}</p>
          {Object.entries(rows[editingRow].fields).map(([field, val]) => (
            <div key={field} style={{marginBottom:'8px'}}>
              <label style={{fontSize:'11px',color:'#888',display:'block',marginBottom:'2px'}}>{field.replace(/_/g,' ').toUpperCase()}</label>
              <input value={val || ''} onChange={e => updateRowField(editingRow, field, e.target.value)} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'6px',fontSize:'13px'}} />
            </div>
          ))}
          <button onClick={() => setEditingRow(null)} style={{padding:'8px 16px',background:'#1D9E75',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'13px'}}>Save Row ✓</button>
        </div>
      )}

      <button onClick={saveAll} style={{width:'100%',padding:'14px',background:'#1D9E75',color:'white',border:'none',borderRadius:'10px',fontSize:'15px',fontWeight:'600',cursor:'pointer'}}>
        ✓ Import All {rows.length} Records
      </button>
      <button onClick={() => setStep('upload')} style={{width:'100%',padding:'12px',marginTop:'8px',background:'white',color:'#666',border:'1px solid #ddd',borderRadius:'10px',cursor:'pointer'}}>
        ← Retake Photo
      </button>
    </div>
  );

  if (step === 'saving') return <div style={{padding:'40px',textAlign:'center'}}><p>💾 Saving {rows.length} records...</p></div>;
  
  if (step === 'done') return (
    <div style={{padding:'40px',textAlign:'center'}}>
      <div style={{fontSize:'48px'}}>✅</div>
      <p style={{fontWeight:'600',fontSize:'18px',marginTop:'12px',color:'#27500A'}}>{rows.length} records imported!</p>
      <button onClick={() => setStep('upload')} style={{marginTop:'20px',padding:'12px 24px',background:'#1D9E75',color:'white',border:'none',borderRadius:'8px',cursor:'pointer'}}>Import Another Page</button>
    </div>
  );
};
export default RegisterScan;
