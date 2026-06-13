// TODO: Add view mode — same pattern as FamilySurvey.jsx
import { useState, useEffect } from 'react';
import BaseModuleForm from '../../../components/BaseModuleForm';
import AadhaarLinkagePopup from '../../../components/AadhaarLinkagePopup';
import { apiFetch } from '../../../utils/api';

const FIELDS = [
  { id: 'mother_name', label: 'Pregnant Woman Name / गरोदर महिलेचे नाव', required: true, placeholder: 'Full name' },
  { id: 'husband_name', label: 'Husband Name / पतीचे नाव', required: true, placeholder: 'Full name' },
  { id: 'age', label: 'Age (years)', type: 'number', required: true },
  { id: 'lmp_date', label: 'LMP Date / शेवटची मासिक पाळी', type: 'date', required: true },
  { id: 'edd_date', label: 'Expected Delivery Date / अपेक्षित तारीख', type: 'date' },
  { id: 'registration_date', label: 'Registration Date', type: 'date', required: true },
  { id: 'gravida', label: 'Gravida (Total Pregnancies)', type: 'number', placeholder: '1' },
  { id: 'para', label: 'Para (Deliveries)', type: 'number', placeholder: '0' },
  { id: 'blood_group', label: 'Blood Group', type: 'select', options: [
    { value: 'A+', label: 'A+' }, { value: 'A-', label: 'A-' },
    { value: 'B+', label: 'B+' }, { value: 'B-', label: 'B-' },
    { value: 'O+', label: 'O+' }, { value: 'O-', label: 'O-' },
    { value: 'AB+', label: 'AB+' }, { value: 'AB-', label: 'AB-' },
    { value: 'Unknown', label: 'Unknown' }
  ]},
  { id: 'weight_kg', label: 'Weight (kg)', type: 'number', placeholder: 'e.g. 55' },
  { id: 'bp_systolic', label: 'BP Systolic', type: 'number', placeholder: 'e.g. 120' },
  { id: 'bp_diastolic', label: 'BP Diastolic', type: 'number', placeholder: 'e.g. 80' },
  { id: 'hemoglobin', label: 'Hemoglobin (g/dL)', type: 'number', placeholder: 'e.g. 11.5' },
  { id: 'high_risk_factors', label: 'High Risk Factors (if any)', type: 'textarea', placeholder: 'Previous cesarean, hypertension, anaemia, etc.' },
  { id: 'ifa_tablets_given', label: 'IFA Tablets Given', type: 'checkbox', checkboxLabel: 'IFA tablets provided' },
];

export default function ANCRegistration() {
  const [showLinkagePopup, setShowLinkagePopup] = useState(false);
  const [linkageData, setLinkageData] = useState(null);
  const [linkageConfirmedData, setLinkageConfirmedData] = useState(null);

  const [prediction, setPrediction] = useState(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);

  const handleAadhaarEntered = async (last4) => {
    try {
      const result = await apiFetch('/api/members/check-linkage', {
        method: 'POST',
        body: JSON.stringify({ aadhaar_last4: last4, module_type: 'anc' })
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
    fetchGeneticPrediction(linkageData.household_id);
  };

  const fetchGeneticPrediction = async (householdId) => {
    setLoadingPrediction(true);
    try {
      // In a real flow, you would pass the current form values in 'motherData'
      // For now, we fetch just based on household linkages
      const pred = await apiFetch('/api/anc/genetic-prediction', {
        method: 'POST',
        body: JSON.stringify({ householdId, motherData: { age: 25 } })
      });
      setPrediction(pred);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPrediction(false);
    }
  };

  const handleRejectLinkage = () => {
    setShowLinkagePopup(false);
    setLinkageConfirmedData(null);
  };

  const handleAfterSubmit = async (docId) => {
    if (linkageConfirmedData) {
      try {
        await apiFetch('/api/members/confirm-linkage', {
          method: 'POST',
          body: JSON.stringify({
            record_collection: 'pregnancies',
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

  const CustomSection = () => {
    if (loadingPrediction) {
      return <div className="mt-4 p-4 bg-[#EAF3DE] rounded-xl text-center text-[#1D9E75] font-bold animate-pulse">Analyzing Genetic Risk...</div>;
    }
    if (!prediction) return null;

    const isHigh = prediction.riskLevel === 'HIGH' || prediction.riskLevel === 'MODERATE';
    return (
      <div className={`mt-4 p-5 rounded-2xl border ${isHigh ? 'bg-[#FCEBEB] border-[#E24B4A]' : 'bg-[#EAF3DE] border-[#1D9E75]'}`}>
        <h3 className={`font-bold text-lg mb-2 flex items-center gap-2 ${isHigh ? 'text-[#791F1F]' : 'text-[#085041]'}`}>
          <span className="material-symbols-outlined">genetics</span>
          AI Genetic & Maternal Risk Prediction
        </h3>
        <p className={`text-sm font-bold mb-2 ${isHigh ? 'text-[#E24B4A]' : 'text-[#1D9E75]'}`}>Risk Level: {prediction.riskLevel}</p>
        <p className="text-sm text-gray-700 mb-4">{prediction.predictionSummary}</p>
        
        {prediction.recommendedTests && prediction.recommendedTests.length > 0 && (
          <div className="mb-3">
            <h4 className="text-xs font-bold uppercase text-gray-500">Recommended Tests</h4>
            <ul className="list-disc pl-5 text-sm text-gray-700">
              {prediction.recommendedTests.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        )}
        
        {prediction.precautions && prediction.precautions.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase text-gray-500">Precautions</h4>
            <ul className="list-disc pl-5 text-sm text-gray-700">
              {prediction.precautions.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <BaseModuleForm 
        title="ANC Registration / गरोदर नोंदणी" 
        moduleIcon="pregnant_woman" 
        collectionName="pregnancies"
        moduleName="anc"
        fields={FIELDS}
        aadhaarPersonLabel="Mother / गर्भवती"
        onAadhaarScanned={handleAadhaarEntered}
        afterSubmit={handleAfterSubmit}
        renderCustomTop={CustomSection}
      />
      <AadhaarLinkagePopup
        isOpen={showLinkagePopup}
        memberName={linkageData?.member_name}
        familyHeadName={linkageData?.family_head}
        moduleType="ANC"
        onConfirm={handleConfirmLinkage}
        onReject={handleRejectLinkage}
        onClose={handleRejectLinkage}
      />
    </>
  );
}

