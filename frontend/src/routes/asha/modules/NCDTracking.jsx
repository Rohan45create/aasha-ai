// TODO: Add view mode — same pattern as FamilySurvey.jsx
import React from 'react';
import BaseModuleForm from '../../../components/BaseModuleForm';
import { apiFetch } from '../../../utils/api';

export default function NCDTracking() {
  const fields = [
    { id: 'patientName', label: 'Patient Name', type: 'text', required: true, placeholder: 'Enter patient name' },
    { id: 'age', label: 'Age', type: 'number', required: true, placeholder: 'Age in years (30+ usually)' },
    { id: 'screeningType', label: 'Screening Type', type: 'select', required: true, options: [
      { value: 'diabetes', label: 'Diabetes (Blood Sugar)' },
      { value: 'hypertension', label: 'Hypertension (Blood Pressure)' },
      { value: 'oral_cancer', label: 'Oral Cancer Visual Check' },
      { value: 'mental_health', label: 'Mental Health Screening' },
      { value: 'other', label: 'Other' }
    ]},
    { id: 'systolicBP', label: 'Systolic BP (mmHg)', type: 'number', required: false, placeholder: 'Upper reading e.g. 120' },
    { id: 'diastolicBP', label: 'Diastolic BP (mmHg)', type: 'number', required: false, placeholder: 'Lower reading e.g. 80' },
    { id: 'bloodSugar', label: 'Random Blood Sugar (RBS)', type: 'number', required: false, placeholder: 'mg/dL' },
    
    // Mental Health section
    { id: 'mentalHealthFlag', label: 'Mental Health Concerns Identified?', type: 'checkbox', required: false },
    { id: 'mentalHealthCondition', label: 'Mental Health Condition/Symptoms', type: 'textarea', required: false, placeholder: 'Depression, severe anxiety, trauma etc.' },
    { id: 'ngoReferralNeeded', label: 'Needs NGO/Specialist Support?', type: 'checkbox', required: false },
    
    { id: 'isReferred', label: 'Referred to PHC/MO?', type: 'checkbox', required: false },
    { id: 'notes', label: 'Counseling & Notes', type: 'textarea', required: false, placeholder: 'Lifestyle advice given...' }
  ];

  const handleAfterSubmit = async (docId, rawData) => {
    if (rawData.ngoReferralNeeded) {
      // Send a custom request to generate a pending review for NGO connect
      try {
        await apiFetch('/api/admin/pending-reviews', {
          method: 'POST',
          body: JSON.stringify({
            collectionName: 'ncd_screenings',
            docId: docId,
            type: 'mental_health_ngo_referral',
            title: `Mental Health NGO Referral: ${rawData.patientName}`
          })
        });
      } catch (err) {
        console.error('Failed to flag NGO referral', err);
      }
    }
  };

  return (
    <BaseModuleForm
      title="NCD & Mental Health Tracking"
      moduleIcon="monitor_heart"
      collectionName="ncd_screenings"
      moduleName="ncd_tracking"
      fields={fields}
      aadhaarPersonLabel="Patient / रुग्ण"
      afterSubmit={handleAfterSubmit}
    />
  );
}
