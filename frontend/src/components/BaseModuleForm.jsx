import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { useAuthStore } from '../stores/authStore';
import { useNavigate, useLocation } from 'react-router-dom';
import VoiceOverlay from './VoiceOverlay';
import AmbientToggle from './AmbientToggle';
import AadhaarAutofill from './AadhaarAutofill';
import { useTx } from '../context/TranslationContext';

export default function BaseModuleForm({ title, moduleIcon, collectionName, fields, moduleName, onSubmit, onFormChange, showAadhaar = true, aadhaarPersonLabel = '', extraData = {}, onAadhaarScanned, afterSubmit }) {
  const { user, ashaId: storeAshaId } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const viewState = location.state;
  const isViewMode = viewState?.mode === 'view';
  const tx = useTx();
  
  const [formData, setFormData] = useState(() => {
    if (isViewMode && viewState?.submissionData) {
      return viewState.submissionData;
    }
    return {};
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (isViewMode && viewState?.submissionId) {
      const fetchFullRecord = async () => {
        setIsLoading(true);
        try {
          const recordId = viewState.submissionData?.recordId || viewState.submissionData?.originalId || viewState.submissionData?.documentId || viewState.submissionId;
          const docSnap = await getDoc(doc(db, collectionName, recordId));
          
          if (docSnap.exists()) {
            setFormData(docSnap.data());
          } else {
            // Fallback 1: Try to find the record by ASHA ID and proximity in time without using orderBy (which requires an index)
            const ashaIdToUse = viewState.submissionData?.ashaId || storeAshaId || localStorage.getItem('ashaId') || user?.uid;
            if (ashaIdToUse) {
              const q = query(
                collection(db, collectionName), 
                where('ashaId', '==', ashaIdToUse)
              );
              const fallbackSnaps = await getDocs(q);
              
              if (!fallbackSnaps.empty) {
                let closestDoc = null;
                
                // Try to find the original submittedAt. It might be in submissionData or we might not have it.
                const submittedAt = viewState.submissionData?.submittedAt || viewState.rawSubmission?.submittedAt;
                if (submittedAt) {
                  const targetTime = submittedAt?.toMillis ? submittedAt.toMillis() : Date.parse(submittedAt);
                  let minDiff = Infinity;
                  
                  fallbackSnaps.forEach(d => {
                    const dData = d.data();
                    if (dData.createdAt) {
                      const docTime = dData.createdAt?.toMillis ? dData.createdAt.toMillis() : Date.parse(dData.createdAt);
                      const diff = Math.abs(docTime - targetTime);
                      if (diff < minDiff) {
                        minDiff = diff;
                        closestDoc = dData;
                      }
                    }
                  });
                  
                  if (closestDoc && minDiff < 1000 * 60 * 5) { // within 5 minutes
                    setFormData(closestDoc);
                    return;
                  }
                }
                
                // If we couldn't match time exactly or it fell outside 5 minutes, find the newest one manually
                let newestDoc = null;
                let maxTime = -1;
                fallbackSnaps.forEach(d => {
                  const dData = d.data();
                  const docTime = dData.createdAt?.toMillis ? dData.createdAt.toMillis() : (Date.parse(dData.createdAt) || 0);
                  if (docTime > maxTime) {
                    maxTime = docTime;
                    newestDoc = dData;
                  }
                });
                
                setFormData(newestDoc || fallbackSnaps.docs[0].data());
                return;
              }
            }
            
            // Fallback 2: The payload might be right there in the state
            if (viewState.submissionData?.formData) {
              setFormData(viewState.submissionData.formData);
            } else {
              setFormData(viewState.submissionData || {});
            }
          }
        } catch (err) {
          console.error("Error fetching full record:", err);
          setFormData(viewState.submissionData?.formData || viewState.submissionData || {});
        } finally {
          setIsLoading(false);
        }
      };
      fetchFullRecord();
    }
  }, [isViewMode, viewState, collectionName]);

  // Voice integration
  const voiceModule = moduleName || collectionName || 'family_survey';
  const [showVoice, setShowVoice] = useState(false);
  const [voiceFilledFields, setVoiceFilledFields] = useState([]);
  const [aadhaarFilledFields, setAadhaarFilledFields] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleVoiceFilled = (structuredData) => {
    if (structuredData && typeof structuredData === 'object') {
      const newFilledFields = [];
      setFormData(prev => {
        const merged = { ...prev };
        Object.entries(structuredData).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            merged[key] = value;
            newFilledFields.push(key);
          }
        });
        return merged;
      });
      setVoiceFilledFields(prev => [...new Set([...prev, ...newFilledFields])]);
      showToast(tx('Voice data applied to form'), 'success');
    }
  };

  // Aadhaar autofill handler
  const handleAadhaarAutofill = (payload, rawAadhaar) => {
    if (onAadhaarScanned && rawAadhaar) {
      onAadhaarScanned(rawAadhaar.slice(-4));
    }
    if (!payload || typeof payload !== 'object') return;
    const filledKeys = [];
    setFormData(prev => {
      const merged = { ...prev };
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          merged[key] = String(value);
          filledKeys.push(key);
        }
      });
      if (onFormChange) onFormChange(merged);
      return merged;
    });
    setAadhaarFilledFields(prev => [...new Set([...prev, ...filledKeys])]);
    const count = Object.keys(payload).length;
    showToast(`${tx('Aadhaar scanned')} — ${count} ${tx('field(s) autofilled')}`, 'success');
  };

  const validate = () => {
    const newErrors = {};
    fields.forEach(f => {
      if (f.required && (!formData[f.id] || String(formData[f.id]).trim() === '')) {
        newErrors[f.id] = `${f.label} is required`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!validate()) {
      showToast(tx('Please fill all required fields'), 'error');
      return;
    }
    const resolvedAshaId = storeAshaId || localStorage.getItem('ashaId') || user?.uid;
    setIsLoading(true);
    try {
      if (onSubmit) {
        await onSubmit(formData);
      } else {
        const docRef = await addDoc(collection(db, collectionName), {
          ...formData,
          ...extraData,
          ashaId: resolvedAshaId,
          source: 'manual',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        // Audit trail
        await addDoc(collection(db, 'edit_history'), {
          collection: collectionName,
          documentId: docRef.id,
          action: 'create',
          data: JSON.stringify(formData),
          ashaId: resolvedAshaId,
          timestamp: serverTimestamp(),
        });
        
        // Log the module submission for Activity stats
        await addDoc(collection(db, 'module_submissions'), {
          ashaId: resolvedAshaId,
          moduleType: moduleName || collectionName,
          submittedAt: serverTimestamp(),
          source: 'manual',
          recordId: docRef.id,
          householdId: formData.householdId || null,
        });

        if (afterSubmit) {
          await afterSubmit(docRef.id, formData);
        }
      }
      showToast(tx('Record saved successfully!', 'record_saved'), 'success');
      setTimeout(() => navigate(-1), 800);
    } catch (err) {
      console.error(err);
      showToast(tx('Error saving data. Will sync when online.'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e, fieldId) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData(prev => {
      const next = { ...prev, [fieldId]: value };
      if (onFormChange) onFormChange(next);
      return next;
    });
    // Clear error on change
    if (errors[fieldId]) {
      setErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n; });
    }
  };

  const handleAmbientSuggestion = (suggestion) => {
    if (suggestion?.field && suggestion?.value !== undefined) {
      setFormData(prev => ({ ...prev, [suggestion.field]: suggestion.value }));
      showToast(`Applied: ${suggestion.chip_label || suggestion.field}`, 'success');
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#D3D1C7] relative">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-lg text-sm font-medium flex items-center space-x-2 animate-slide-down ${
          toast.type === 'success' ? 'bg-[#EAF3DE] text-[#085041] border border-[#1D9E75]' :
          toast.type === 'error' ? 'bg-[#FCEBEB] text-[#791F1F] border border-[#E24B4A]' :
          'bg-white text-[#1A1A18] border border-[#D3D1C7]'
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-[#EAF3DE] rounded-full flex items-center justify-center text-[#1D9E75]">
            <span className="material-symbols-outlined text-2xl">{moduleIcon}</span>
          </div>
          <h2 className="text-xl font-bold text-[#1A1A18]">{title}</h2>
        </div>
        {/* Ambient AI toggle */}
        <AmbientToggle module={voiceModule} onAcceptSuggestion={handleAmbientSuggestion} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isViewMode && (
          <div style={{background:'#EAF3DE', padding:'10px 16px', borderRadius:8, marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <span style={{fontSize:13, color:'#27500A', fontWeight:500}}>{tx('Viewing submitted record')}</span>
          </div>
        )}
        <fieldset disabled={isViewMode} className="space-y-4 border-none p-0 m-0">
        
        {/* Aadhaar Autofill — shown at top of every form */}
        {showAadhaar && !isViewMode && (
          <AadhaarAutofill
            moduleName={moduleName || 'default'}
            personLabel={aadhaarPersonLabel}
            onAutofill={handleAadhaarAutofill}
          />
        )}

        {fields.map(field => (
          <div key={field.id}>
            <label className="block text-sm font-medium mb-1 text-[#5F5E5A]">
              {tx(field.label)}
              {field.required && <span className="text-[#E24B4A] ml-1">*</span>}
              {voiceFilledFields.includes(field.id) && <span className="ml-2 text-xs text-[#1D9E75] font-bold px-2 py-0.5 bg-[#EAF3DE] rounded border border-[#1D9E75] inline-flex items-center"><span className="material-symbols-outlined text-[14px] mr-1">mic</span>{tx('Voice filled')}</span>}
              {aadhaarFilledFields.includes(field.id) && !voiceFilledFields.includes(field.id) && <span className="ml-2 text-xs text-blue-600 font-bold px-2 py-0.5 bg-blue-50 rounded border border-blue-300 inline-flex items-center"><span className="material-symbols-outlined text-[14px] mr-1">badge</span>{tx('Aadhaar filled')}</span>}
            </label>
            {field.type === 'select' ? (
              <select
                required={field.required}
                value={formData[field.id] || ''}
                onChange={(e) => handleChange(e, field.id)}
                className={`w-full p-3 border rounded-xl outline-none focus:border-[#1D9E75] bg-white transition-colors ${
                  errors[field.id] ? 'border-[#E24B4A]' : 'border-[#D3D1C7]'
                }`}
              >
                <option value="">{tx('Select...')}</option>
                {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : field.type === 'checkbox' ? (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData[field.id] || false}
                  onChange={(e) => handleChange(e, field.id)}
                  className="w-5 h-5 accent-[#1D9E75]"
                />
                <span className="text-sm">{tx(field.checkboxLabel || field.label)}</span>
              </div>
            ) : field.type === 'textarea' ? (
              <textarea
                required={field.required}
                value={formData[field.id] || ''}
                onChange={(e) => handleChange(e, field.id)}
                placeholder={field.placeholder}
                rows={3}
                className={`w-full p-3 border rounded-xl outline-none focus:border-[#1D9E75] transition-colors resize-none ${
                  errors[field.id] ? 'border-[#E24B4A]' : 'border-[#D3D1C7]'
                }`}
              />
            ) : (
              <input
                type={field.type || 'text'}
                required={field.required}
                value={formData[field.id] || ''}
                onChange={(e) => handleChange(e, field.id)}
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                className={`w-full p-3 border rounded-xl outline-none focus:border-[#1D9E75] transition-colors ${
                  errors[field.id] ? 'border-[#E24B4A]' : 'border-[#D3D1C7]'
                }`}
              />
            )}
            {errors[field.id] && (
              <p className="text-xs text-[#E24B4A] mt-1">{errors[field.id]}</p>
            )}
          </div>
        ))}

        {/* Action buttons */}
        {!isViewMode && (
          <div className="pt-4 space-y-3">
            {/* Submit + Cancel */}
            <div className="flex space-x-3">
              <button type="button" onClick={() => navigate(-1)} className="flex-1 py-3 border border-[#D3D1C7] text-[#5F5E5A] rounded-xl font-medium text-center hover:bg-gray-50 flex justify-center items-center">
                {tx('Cancel', 'cancel')}
              </button>
              <button type="submit" disabled={isLoading} className="flex-1 py-3 bg-[#1D9E75] text-white rounded-xl font-medium text-center shadow-md active:scale-[0.98] flex justify-center items-center">
                {isLoading ? <span className="material-symbols-outlined animate-spin">refresh</span> : tx('Save Record', 'save_record')}
              </button>
            </div>
          </div>
        )}
        </fieldset>
      </form>

      {/* Floating Voice Mic Button */}
      {!isViewMode && (
        <button
          type="button"
          onClick={() => setShowVoice(true)}
          style={{ position: 'fixed', bottom: '80px', right: '20px' }}
          className="w-[72px] h-[72px] bg-[#1D9E75] text-white rounded-full flex items-center justify-center shadow-lg z-40 hover:scale-105 transition-transform"
        >
          <span className="material-symbols-outlined text-4xl">mic</span>
        </button>
      )}

      {showVoice && !isViewMode && (
        <VoiceOverlay 
          moduleType={voiceModule} 
          formFields={fields}
          onFieldsFilled={handleVoiceFilled} 
          onClose={() => setShowVoice(false)} 
        />
      )}

    </div>
  );
}
