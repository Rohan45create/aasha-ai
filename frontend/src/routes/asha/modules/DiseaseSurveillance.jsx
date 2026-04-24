import React from 'react';
import BaseModuleForm from '../../../components/BaseModuleForm';

export default function DiseaseSurveillance() {
  const fields = [
    { id: 'patientName', label: 'Patient Name', type: 'text', required: true, placeholder: 'Enter affected person name' },
    { id: 'village', label: 'Village', type: 'text', required: true, placeholder: 'Enter village' },
    { id: 'symptoms', label: 'Key Symptoms', type: 'select', required: true, options: [
      { value: 'fever_rash', label: 'Fever with Rash (Measles/Dengue)' },
      { value: 'fever_chills', label: 'Fever with Chills (Malaria)' },
      { value: 'diarrhea', label: 'Acute Watery Diarrhea (Cholera)' },
      { value: 'cough', label: 'Prolonged Cough (TB)' },
      { value: 'jaundice', label: 'Jaundice/Yellowing (Hepatitis)' },
      { value: 'other', label: 'Other Severe Symptoms' }
    ]},
    { id: 'dateOnset', label: 'Date of Symptom Onset', type: 'date', required: true },
    { id: 'durationDays', label: 'Duration (Days)', type: 'number', required: true, placeholder: 'How many days ago?' },
    { id: 'hasTraveled', label: 'Recent Travel Outside Village?', type: 'checkbox', required: false },
    { id: 'additionalNotes', label: 'Observation Notes', type: 'textarea', required: false, placeholder: 'Describe severity, specific complaints...' }
  ];

  return (
    <BaseModuleForm
      title="Disease Surveillance (IDSP)"
      moduleIcon="coronavirus"
      collectionName="disease_alerts"
      moduleName="disease_surveillance"
      fields={fields}
    />
  );
}
