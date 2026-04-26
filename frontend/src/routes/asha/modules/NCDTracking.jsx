import React from 'react';
import BaseModuleForm from '../../../components/BaseModuleForm';

export default function NCDTracking() {
  const fields = [
    { id: 'patientName', label: 'Patient Name', type: 'text', required: true, placeholder: 'Enter patient name' },
    { id: 'age', label: 'Age', type: 'number', required: true, placeholder: 'Age in years (30+ usually)' },
    { id: 'screeningType', label: 'Screening Type', type: 'select', required: true, options: [
      { value: 'diabetes', label: 'Diabetes (Blood Sugar)' },
      { value: 'hypertension', label: 'Hypertension (Blood Pressure)' },
      { value: 'oral_cancer', label: 'Oral Cancer Visual Check' },
      { value: 'other', label: 'Other' }
    ]},
    { id: 'systolicBP', label: 'Systolic BP (mmHg)', type: 'number', required: false, placeholder: 'Upper reading e.g. 120' },
    { id: 'diastolicBP', label: 'Diastolic BP (mmHg)', type: 'number', required: false, placeholder: 'Lower reading e.g. 80' },
    { id: 'bloodSugar', label: 'Random Blood Sugar (RBS)', type: 'number', required: false, placeholder: 'mg/dL' },
    { id: 'isReferred', label: 'Referred to PHC/MO?', type: 'checkbox', required: false },
    { id: 'notes', label: 'Counseling & Notes', type: 'textarea', required: false, placeholder: 'Lifestyle advice given...' }
  ];

  return (
    <BaseModuleForm
      title="NCD Tracking"
      moduleIcon="monitor_heart"
      collectionName="ncd_screenings"
      moduleName="ncd_tracking"
      fields={fields}
      aadhaarPersonLabel="Patient / रुग्ण"
    />
  );
}
