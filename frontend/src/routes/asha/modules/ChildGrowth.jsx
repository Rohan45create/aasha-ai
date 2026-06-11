// TODO: Add view mode — same pattern as FamilySurvey.jsx
import { useState, useRef } from 'react';
import BaseModuleForm from '../../../components/BaseModuleForm';
import { useAuthStore } from '../../../stores/authStore';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import AmbientToggle from '../../../components/AmbientToggle';
import AadhaarAutofill from '../../../components/AadhaarAutofill';
import { useTranslation } from 'react-i18next';
import AadhaarLinkagePopup from '../../../components/AadhaarLinkagePopup';
import { apiFetch } from '../../../utils/api';

const FIELDS = [
  { id: 'child_name', label: 'Child Name / à¤¬à¤¾à¤²à¤•à¤¾à¤šà¥‡ à¤¨à¤¾à¤µ', required: true, placeholder: 'Full name' },
  { id: 'mother_name', label: 'Mother Name', required: true },
  { id: 'age_months', label: 'Age (months)', type: 'number', required: true, placeholder: '0-60' },
  { id: 'gender', label: 'Gender', type: 'select', required: true, options: [
    { value: 'Male', label: 'Male / à¤®à¥�à¤²à¤—à¤¾' }, { value: 'Female', label: 'Female / à¤®à¥�à¤²à¤—à¥€' }
  ]},
  { id: 'weight_kg', label: 'Weight (kg)', type: 'number', required: true, placeholder: 'e.g. 8.5' },
  { id: 'height_cm', label: 'Height (cm)', type: 'number', required: true, placeholder: 'e.g. 72' },
  { id: 'muac_cm', label: 'MUAC (cm)', type: 'number', placeholder: 'e.g. 13.5' },
  { id: 'muac_color', label: 'MUAC Color Zone', type: 'select', options: [
    { value: 'GREEN', label: 'Green (â‰¥13.5cm â€” Normal)' },
    { value: 'YELLOW', label: 'Yellow (12.5-13.4cm â€” MAM)' },
    { value: 'RED', label: 'Red (<12.5cm â€” SAM)' }
  ]},
  { id: 'malnutritionGrade', label: 'AI Visual Malnutrition Grade', type: 'select', options: [
    { value: 'NORMAL', label: 'Normal' },
    { value: 'YELLOW', label: 'MAM (Yellow)' },
    { value: 'RED', label: 'SAM (Red)' }
  ]},
  { id: 'feeding_status', label: 'Feeding Status', type: 'select', options: [
    { value: 'Exclusive Breastfeeding', label: 'Exclusive Breastfeeding' },
    { value: 'Complementary Feeding', label: 'Complementary Feeding' },
    { value: 'Family Food', label: 'Family Food' },
    { value: 'Bottle Feeding', label: 'Bottle Feeding' }
  ]},
  { id: 'immunization_up_to_date', label: 'Immunization up to date?', type: 'checkbox', checkboxLabel: 'All vaccines given as per schedule' },
  { id: 'illness_signs', label: 'Illness Signs (if any)', type: 'textarea', placeholder: 'Fever, diarrhoea, cough, oedema, etc.' },
  { id: 'referred_to_nrc', label: 'Referred to NRC?', type: 'checkbox', checkboxLabel: 'Child referred to Nutrition Rehabilitation Centre' },
];

// Grade config helper
const GRADE_CONFIG = {
  NORMAL: {
    bg: '#EAF3DE', border: '#1D9E75', text: '#085041',
    icon: 'check_circle', label: 'Normal', badgeBg: '#1D9E75',
  },
  YELLOW: {
    bg: '#FFF8E1', border: '#FFCA28', text: '#7A5500',
    icon: 'warning', label: 'Moderate (MAM)', badgeBg: '#F0A500',
  },
  RED: {
    bg: '#FCEBEB', border: '#E24B4A', text: '#791F1F',
    icon: 'crisis_alert', label: 'Severe (SAM)', badgeBg: '#E24B4A',
  },
};

function ConfidenceBar({ value }) {
  const color = value >= 75 ? '#1D9E75' : value >= 50 ? '#F0A500' : '#E24B4A';
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#777', marginBottom: '4px' }}>
        <span>AI Confidence</span>
        <span style={{ fontWeight: '700', color }}>{value}%</span>
      </div>
      <div style={{ background: '#E8E7E0', borderRadius: '100px', height: '6px', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, background: color, height: '100%', borderRadius: '100px', transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

export default function ChildGrowth() {
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gradeResult, setGradeResult] = useState(null);
  const [prefillData, setPrefillData] = useState(null);
  const [referralSent, setReferralSent] = useState(false);
  const [hasParents, setHasParents] = useState(true);
  const [showLinkagePopup, setShowLinkagePopup] = useState(false);
  const [linkageData, setLinkageData] = useState(null);
  const [linkageConfirmedData, setLinkageConfirmedData] = useState(null);
  
  const fileInputRef = useRef();
  const { user } = useAuthStore();

  const handleAmbientSuggestion = (suggestion) => {
    if (suggestion?.field && suggestion?.value !== undefined) {
      setFormData(prev => ({ ...prev, [suggestion.field]: suggestion.value }));
    }
  };

  const handleAadhaarEntered = async (last4) => {
    if (!hasParents) return; // skip if orphan

    try {
      const result = await apiFetch('/api/members/check-linkage', {
        method: 'POST',
        body: JSON.stringify({ aadhaar_last4: last4, module_type: 'child_growth' })
      });
      if (result.match_found) {
        setLinkageData(result);
        setShowLinkagePopup(true);
      }
    } catch (err) {
      console.log('Linkage check skipped (offline or error)', err);
    }
  };

  const handleConfirmLinkage = () => {
    setShowLinkagePopup(false);
    setLinkageConfirmedData(linkageData);
  };

  const handleRejectLinkage = () => {
    setShowLinkagePopup(false);
    setLinkageConfirmedData(null);
  };

  const handleAfterSubmit = async (docId) => {
    if (linkageConfirmedData && hasParents) {
      try {
        await apiFetch('/api/members/confirm-linkage', {
          method: 'POST',
          body: JSON.stringify({
            record_collection: 'children',
            record_id: docId,
            household_id: linkageConfirmedData.household_id,
            member_id: linkageConfirmedData.member_id
          })
        });
      } catch (err) {
        console.error('Linkage confirmation failed', err);
      }
    }
  };

  const handleCapture = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setPreview(URL.createObjectURL(file));
      setGradeResult(null);
      setReferralSent(false);
    }
  };

  const clearPhoto = () => {
    setPhoto(null);
    setPreview(null);
    setGradeResult(null);
    setReferralSent(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGrade = async () => {
    if (!photo || !user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append('photo', photo);          // backend param name is "photo"

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/vision/muac-grade`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Analysis failed');
      }

      const data = await response.json();
      // Backend returns { status: "success", grading: { grade, confidence, ... } }
      setGradeResult(data.grading || data);
    } catch (err) {
      console.error('[MalnutritionScan] error:', err);
      setGradeResult({ error: true, grade: 'ERROR', confidence: 0, explanation: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReferral = async () => {
    if (!user) return;
    try {
      const childName = prefillData?.child_name || 'Unknown Child';
      const childId = 'scan_' + Date.now();

      await addDoc(collection(db, 'referrals'), {
        childId,
        childName,
        ashaId: user.uid,
        status: 'Pending',
        referredDate: new Date().toISOString().split('T')[0],
        nrcName: null,
        reason: `Severe Acute Malnutrition (SAM) â€” AI Visual Scan (${gradeResult?.confidence ?? '?'}% confidence)`,
        village: prefillData?.village || null,
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'pending_reviews'), {
        title: `SAM: ${childName} â€” Immediate NRC referral`,
        ashaId: user.uid,
        linkedCollection: 'children',
        linkedDocId: childId,
        reviewStatus: 'pending',
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'notifications'), {
        userId: 'head_sunita_001',
        title: `CRITICAL: ${childName}`,
        message: `SAM detected by AI visual scan (${gradeResult?.confidence ?? '?'}% confidence). NRC referral created. ASHA: ${user.displayName || 'ASHA'}`,
        type: 'critical_alert',
        isRead: false,
        createdAt: serverTimestamp(),
      });

      setReferralSent(true);
    } catch (err) {
      console.error(err);
      alert('Failed to generate referral. Please try again.');
    }
  };

  const cfg = gradeResult?.grade ? (GRADE_CONFIG[gradeResult.grade] || GRADE_CONFIG.NORMAL) : null;

  return (
    <div className="space-y-4">
      {/* â”€â”€ AI Malnutrition Scan Card â”€â”€ */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#D3D1C7] space-y-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 bg-[#FCEBEB] rounded-full flex items-center justify-center text-[#791F1F]">
            <span className="material-symbols-outlined text-xl">vital_signs</span>
          </div>
          <div>
            <h3 className="font-bold text-[#1A1A18]">AI Malnutrition Scan</h3>
            <p className="text-xs text-[#5F5E5A]">Take a photo of the child â€” Gemini will assess malnutrition risk</p>
          </div>
        </div>

        {/* â”€â”€ Result State â”€â”€ */}
        {gradeResult ? (
          <div>
            {gradeResult.error ? (
              <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '14px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#791F1F', fontWeight: '700' }}>
                  <span className="material-symbols-outlined">error</span>
                  Analysis Failed
                </div>
                <p style={{ fontSize: '13px', color: '#791F1F', marginTop: '6px' }}>{gradeResult.explanation || 'Could not analyze the photo. Please try again with a clear image.'}</p>
                <button onClick={clearPhoto} className="mt-3 text-xs underline font-medium text-[#791F1F]">Try Again</button>
              </div>
            ) : (
              <div style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}`, borderRadius: '16px', padding: '18px' }}>
                {/* Grade badge + label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ background: cfg.badgeBg, borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: '20px' }}>{cfg.icon}</span>
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: '600', color: cfg.text, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Assessment</p>
                    <h4 style={{ fontSize: '17px', fontWeight: '800', color: cfg.text }}>{gradeResult.severity_label || cfg.label}</h4>
                  </div>
                </div>

                {/* Confidence bar */}
                <ConfidenceBar value={gradeResult.confidence ?? 0} />

                {/* Explanation */}
                {gradeResult.explanation && (
                  <p style={{ fontSize: '13px', color: cfg.text, marginTop: '12px', lineHeight: '1.55' }}>
                    {gradeResult.explanation}
                  </p>
                )}

                {/* Visible Signs */}
                {gradeResult.visible_signs && gradeResult.visible_signs.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <p style={{ fontSize: '11px', fontWeight: '700', color: cfg.text, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Observed Signs</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {gradeResult.visible_signs.map((sign, i) => (
                        <span key={i} style={{ background: 'rgba(0,0,0,0.08)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', color: cfg.text, fontWeight: '500' }}>
                          {sign}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendation */}
                {gradeResult.recommendation && (
                  <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.06)', borderRadius: '10px', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: cfg.text, marginTop: '1px', flexShrink: 0 }}>medical_services</span>
                      <p style={{ fontSize: '13px', color: cfg.text, fontWeight: '500', lineHeight: '1.5' }}>{gradeResult.recommendation}</p>
                    </div>
                  </div>
                )}

                {/* Scan Again button */}
                <button onClick={clearPhoto} style={{ marginTop: '14px', fontSize: '12px', fontWeight: '600', color: cfg.text, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Scan Again
                </button>

                {/* NRC Referral button for SAM */}
                {(gradeResult.grade === 'RED' || gradeResult.needs_nrc_referral) && (
                  <div style={{ marginTop: '14px' }}>
                    {referralSent ? (
                      <div style={{ background: '#085041', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: '20px' }}>check_circle</span>
                        <p style={{ color: '#fff', fontWeight: '700', fontSize: '14px' }}>NRC Referral Sent â€” Admin Notified</p>
                      </div>
                    ) : (
                      <button
                        onClick={handleGenerateReferral}
                        style={{
                          width: '100%', padding: '14px', background: '#E24B4A', color: '#fff',
                          borderRadius: '14px', border: 'none', fontWeight: '800', fontSize: '14px',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: '8px', boxShadow: '0 4px 14px rgba(226,75,74,0.35)', transition: 'opacity 0.15s',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>local_hospital</span>
                        Generate NRC Referral
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : preview ? (
          /* â”€â”€ Preview State â”€â”€ */
          <div>
            <div style={{ position: 'relative' }}>
              <img src={preview} alt="Child" style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '14px', border: '1px solid #D3D1C7' }} />
              <button
                onClick={clearPhoto}
                style={{ position: 'absolute', top: '10px', right: '10px', background: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', cursor: 'pointer', color: '#E24B4A' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>
            <button
              onClick={handleGrade}
              disabled={loading}
              style={{
                marginTop: '12px', width: '100%', padding: '14px', background: loading ? '#7FB4AC' : '#085041',
                color: '#fff', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '8px', transition: 'background 0.2s',
              }}
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', animation: 'spin 1s linear infinite' }}>refresh</span>
                  Analyzing with AIâ€¦
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>biotech</span>
                  Analyze for Malnutrition
                </>
              )}
            </button>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          /* â”€â”€ Upload State â”€â”€ */
          <div
            onClick={() => fileInputRef.current.click()}
            style={{
              border: '2px dashed #1D9E75', borderRadius: '14px', padding: '32px 20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#EAF3DE'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#1D9E75', marginBottom: '8px' }}>add_a_photo</span>
            <p style={{ fontWeight: '700', color: '#085041', fontSize: '14px' }}>Tap to photograph the child</p>
            <p style={{ fontSize: '12px', color: '#5F5E5A', marginTop: '4px' }}>Gemini AI will assess malnutrition risk visually</p>
          </div>
        )}

        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>

      {/* â”€â”€ Orphan Toggle â”€â”€ */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#D3D1C7]">
        <label className="block text-sm font-medium mb-3 text-[#5F5E5A]">
          Does this child have parents or a guardian?
        </label>
        <div className="flex bg-gray-100 p-1 rounded-xl w-max mb-3">
          <button 
            type="button" 
            onClick={() => setHasParents(true)} 
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${hasParents ? 'bg-white shadow text-[#1A1A18]' : 'text-[#5F5E5A]'}`}>
            Yes
          </button>
          <button 
            type="button" 
            onClick={() => setHasParents(false)} 
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${!hasParents ? 'bg-white shadow text-[#1A1A18]' : 'text-[#5F5E5A]'}`}>
            No
          </button>
        </div>
        
        {!hasParents && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-blue-600 text-lg mt-0.5">info</span>
            <p className="text-sm text-blue-800 font-medium">
              This child will be registered as an independent record. No family linkage required.
            </p>
          </div>
        )}
      </div>

      {/* â”€â”€ Regular Form â”€â”€ */}
      <BaseModuleForm
        title="Child Growth / à¤¬à¤¾à¤² à¤µà¤¾à¤¢"
        moduleIcon="child_care"
        collectionName="children"
        moduleName="child_growth"
        fields={FIELDS}
        onFormChange={setPrefillData}
        showAadhaar={hasParents}
        aadhaarPersonLabel="Child / à¤¬à¤¾à¤²à¤•"
        onAadhaarScanned={handleAadhaarEntered}
        afterSubmit={handleAfterSubmit}
        extraData={{
          isOrphan: !hasParents,
          hasParents: hasParents,
          ...( !hasParents ? { familyLinkageSkipped: true } : {} )
        }}
      />

      <AadhaarLinkagePopup
        isOpen={showLinkagePopup}
        memberName={linkageData?.member_name}
        familyHeadName={linkageData?.family_head}
        moduleType="Child Growth"
        onConfirm={handleConfirmLinkage}
        onReject={handleRejectLinkage}
        onClose={handleRejectLinkage}
      />
    </div>
  );
}

