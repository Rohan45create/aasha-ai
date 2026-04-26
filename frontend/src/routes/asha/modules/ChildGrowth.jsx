import { useState, useRef } from 'react';
import BaseModuleForm from '../../../components/BaseModuleForm';
import { useAuthStore } from '../../../stores/authStore';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';

const FIELDS = [
  { id: 'child_name', label: 'Child Name / बालकाचे नाव', required: true, placeholder: 'Full name' },
  { id: 'mother_name', label: 'Mother Name', required: true },
  { id: 'age_months', label: 'Age (months)', type: 'number', required: true, placeholder: '0-60' },
  { id: 'gender', label: 'Gender', type: 'select', required: true, options: [
    { value: 'Male', label: 'Male / मुलगा' }, { value: 'Female', label: 'Female / मुलगी' }
  ]},
  { id: 'weight_kg', label: 'Weight (kg)', type: 'number', required: true, placeholder: 'e.g. 8.5' },
  { id: 'height_cm', label: 'Height (cm)', type: 'number', required: true, placeholder: 'e.g. 72' },
  { id: 'muac_cm', label: 'MUAC (cm)', type: 'number', placeholder: 'e.g. 13.5' },
  { id: 'muac_color', label: 'MUAC Color Zone', type: 'select', options: [
    { value: 'GREEN', label: '🟢 Green (≥13.5cm — Normal)' },
    { value: 'YELLOW', label: '🟡 Yellow (12.5-13.4cm — MAM)' },
    { value: 'RED', label: '🔴 Red (<12.5cm — SAM)' }
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

export default function ChildGrowth() {
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gradeResult, setGradeResult] = useState(null);
  const [prefillData, setPrefillData] = useState(null);
  const fileInputRef = useRef();
  const { user } = useAuthStore();

  const handleCapture = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setPreview(URL.createObjectURL(file));
      setGradeResult(null);
    }
  };

  const clearPhoto = () => {
    setPhoto(null);
    setPreview(null);
    setGradeResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const handleGrade = async () => {
    if (!photo || !user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append("file", photo);
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/vision/muac-grade`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });
      
      if (!response.ok) throw new Error("Grading failed");
      
      const data = await response.json();
      setGradeResult(data);
      
      // Auto-prefill the "malnutritionGrade" field using the suggested structure logic
      // Note: BaseModuleForm will overwrite if we provide `initialData` or we can just 
      // let the user see it and pick it manually, or we could lift the state up.
      // Since it's a simple integration, we'll just display it above.
    } catch (err) {
      console.error(err);
      setGradeResult({ error: true, grade: 'ERROR', confidence: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReferral = async () => {
    if (!user) return;
    try {
      const childId = 'temp_' + Date.now();
      const childName = prefillData?.child_name || 'Unknown Child';

      // Auto-create referral
      await addDoc(collection(db, 'referrals'), {
        childId, 
        childName,
        ashaId: user.uid,
        status: 'Pending',
        referredDate: new Date().toISOString().split('T')[0],
        nrcName: 'District Hospital Beed NRC',
        reason: 'Severe Acute Malnutrition — MUAC < 115mm',
        createdAt: serverTimestamp()
      });

      // Create pending_review for head
      await addDoc(collection(db, 'pending_reviews'), {
        title: `SAM: ${childName} — Immediate NRC referral`,
        ashaId: user.uid, 
        linkedCollection: 'children', 
        linkedDocId: childId,
        reviewStatus: 'pending', 
        createdAt: serverTimestamp()
      });

      // Notification for head
      await addDoc(collection(db, 'notifications'), {
        userId: 'head_sunita_001',
        title: `🚨 CRITICAL: ${childName}`,
        message: `SAM detected. NRC referral created. ASHA: ${user.displayName || 'ASHA'}`,
        type: 'critical_alert', 
        isRead: false, 
        createdAt: serverTimestamp()
      });

      alert("Referral generated successfully! Notifications sent to Medical Officer.");
    } catch (err) {
      console.error(err);
      alert("Failed to generate referral.");
    }
  };

  return (
    <div className="space-y-4">
      {/* AI Grading Module */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#D3D1C7] space-y-4">
        <div className="flex items-center space-x-3 mb-2">
           <div className="w-10 h-10 bg-[#FCEBEB] rounded-full flex items-center justify-center text-[#791F1F]">
             <span className="material-symbols-outlined text-xl">vital_signs</span>
           </div>
           <div>
             <h3 className="font-bold text-[#1A1A18]">AI Malnutrition Scan</h3>
             <p className="text-xs text-[#5F5E5A]">Optional: Take a photo to estimate wasting status</p>
           </div>
        </div>

        {gradeResult ? (
          <div className={`p-4 rounded-xl border ${gradeResult.grade === 'RED' ? 'bg-[#FCEBEB] border-[#E24B4A] text-[#791F1F]' : gradeResult.grade === 'YELLOW' ? 'bg-[#FFF8E1] border-[#FFCA28] text-[#BA7517]' : 'bg-[#EAF3DE] border-[#1D9E75] text-[#085041]'}`}>
            <h4 className="font-bold flex items-center gap-2">
              <span className="material-symbols-outlined">analytics</span>
              Estimated Grade: {gradeResult.grade}
            </h4>
            <p className="text-sm mt-1">Confidence: {gradeResult.confidence}%</p>
            {gradeResult.error && <p className="text-xs mt-1 text-red-500">Failed to analyze image.</p>}
            <button onClick={clearPhoto} className="mt-3 text-xs underline font-medium">Scan Again</button>
            
            {(gradeResult.grade === 'SAM' || gradeResult.grade === 'RED') && (
              <button 
                onClick={handleGenerateReferral}
                className="mt-4 w-full py-3 bg-[#E24B4A] text-white rounded-xl shadow-md font-bold text-sm flex justify-center items-center gap-2 active:scale-[0.98] transition-transform"
              >
                Generate NRC Referral &rarr;
              </button>
            )}
          </div>
        ) : preview ? (
          <div className="relative">
             <img src={preview} alt="Child" className="w-full h-48 object-cover rounded-xl border" />
             <button onClick={clearPhoto} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md text-red-500 hover:bg-gray-100">
                <span className="material-symbols-outlined">close</span>
             </button>
             <button onClick={handleGrade} disabled={loading} className="mt-3 w-full py-2 bg-[#085041] text-white rounded-xl shadow-md font-medium text-sm flex justify-center items-center">
                {loading ? <span className="material-symbols-outlined animate-spin text-lg">refresh</span> : 'Analyze Photo'}
             </button>
          </div>
        ) : (
          <div 
             onClick={() => fileInputRef.current.click()}
             className="border-2 border-dashed border-[#1D9E75] rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#EAF3DE] transition-colors"
          >
             <span className="material-symbols-outlined text-3xl text-[#1D9E75] mb-2">add_a_photo</span>
             <p className="text-sm font-medium text-[#1D9E75]">Tap to photograph child</p>
          </div>
        )}
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
      </div>

      <BaseModuleForm 
        title="Child Growth / बाल वाढ" 
        moduleIcon="child_care" 
        collectionName="children"
        moduleName="child_growth"
        fields={FIELDS}
        onFormChange={setPrefillData}
      />
    </div>
  );
}
