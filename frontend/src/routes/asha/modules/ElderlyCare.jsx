// TODO: Add view mode � same pattern as FamilySurvey.jsx
import React from 'react';
import BaseModuleForm from '../../../components/BaseModuleForm';

export default function ElderlyCare() {
  const fields = [
    { id: 'elderlyName', label: 'Elderly Person Name', type: 'text', required: true, placeholder: 'Enter name' },
    { id: 'age', label: 'Age', type: 'number', required: true, placeholder: 'Age (60+)' },
    { id: 'livingArrangement', label: 'Living Arrangement', type: 'select', required: true, options: [
      { value: 'with_family', label: 'With Family/Spouse' },
      { value: 'alone', label: 'Living Alone' },
      { value: 'other', label: 'Other' }
    ]},
    { id: 'mobilityStatus', label: 'Mobility Status', type: 'select', required: true, options: [
      { value: 'independent', label: 'Independent' },
      { value: 'assisted', label: 'Needs Assistance (Cane/Walker)' },
      { value: 'bedridden', label: 'Bedridden' }
    ]},
    { id: 'needsMedicationRefill', label: 'Needs Chronic Medication Refill?', type: 'checkbox', required: false },
    { id: 'recentFall', label: 'Any recent fall or injury?', type: 'checkbox', required: false },
    { id: 'notes', label: 'Care Notes', type: 'textarea', required: false, placeholder: 'Describe any urgent needs or symptoms...' }
  ];

  return (
    <BaseModuleForm
      title="Elderly Care & Support"
      moduleIcon="elderly"
      collectionName="elderly_care"
      moduleName="elderly_care"
      fields={fields}
      aadhaarPersonLabel="Elderly Person / वृद्ध"
    />
  );
}

