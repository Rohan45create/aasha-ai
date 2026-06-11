// TODO: Add view mode � same pattern as FamilySurvey.jsx
import { useState } from 'react';
import BaseModuleForm from '../../../components/BaseModuleForm';
import AadhaarLinkagePopup from '../../../components/AadhaarLinkagePopup';
import { apiFetch } from '../../../utils/api';

const FIELDS = [
  { id: 'mother_name', label: 'Pregnant Woman Name / गर्भवती नाव', required: true, placeholder: 'Full name' },
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

  return (
    <>
      <BaseModuleForm 
        title="ANC Registration / गर्भवती नोंदणी" 
        moduleIcon="pregnant_woman" 
        collectionName="pregnancies"
        moduleName="anc"
        fields={FIELDS}
        aadhaarPersonLabel="Mother / गर्भवती"
        onAadhaarScanned={handleAadhaarEntered}
        afterSubmit={handleAfterSubmit}
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

