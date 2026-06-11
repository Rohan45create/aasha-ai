// TODO: Add view mode — same pattern as FamilySurvey.jsx
import React from 'react';
import BaseModuleForm from '../../../components/BaseModuleForm';

export default function DeathRecord() {
  const fields = [
    { id: 'deceasedName', label: 'Deceased Person Name', type: 'text', required: true, placeholder: 'Enter full name' },
    { id: 'ageAtDeath', label: 'Age at Death (Years)', type: 'number', required: true, placeholder: 'Enter age' },
    { id: 'dateOfDeath', label: 'Date of Death', type: 'date', required: true },
    { id: 'placeOfDeath', label: 'Place of Death', type: 'select', required: true, options: [
      { value: 'Home', label: 'Home' },
      { value: 'Hospital', label: 'Hospital/Health Center' },
      { value: 'Transit', label: 'In Transit' },
      { value: 'Other', label: 'Other/Unknown' }
    ]},
    { id: 'causeOfDeath', label: 'Suspected Cause of Death', type: 'textarea', required: true, placeholder: 'Brief explanation of cause' },
    { id: 'headAcknowledgement', label: 'Head of Family Acknowledged', type: 'checkbox', required: true }
  ];

  return (
    <BaseModuleForm
      title="Death Record"
      moduleIcon="demography"
      collectionName="death_records"
      moduleName="death_record"
      fields={fields}
      aadhaarPersonLabel="Deceased / à¤®à¥ƒà¤¤ à¤µà¥�à¤¯à¤•à¥�à¤¤à¥€"
    />
  );
}

