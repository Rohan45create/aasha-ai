import React from 'react';
import BaseModuleForm from '../../../components/BaseModuleForm';

export default function FamilyPlanning() {
  const fields = [
    { id: 'coupleName', label: 'Beneficiary Name (Woman)', type: 'text', required: true, placeholder: 'Enter name' },
    { id: 'age', label: 'Age', type: 'number', required: true, placeholder: 'Years' },
    { id: 'childrenCount', label: 'Number of living children', type: 'number', required: true, placeholder: 'Total living children' },
    { id: 'currentMethod', label: 'Current Contraceptive Method', type: 'select', required: true, options: [
      { value: 'none', label: 'None' },
      { value: 'condom', label: 'Male/Female Condoms' },
      { value: 'ocp', label: 'Oral Contraceptive Pills (Mala-N/D)' },
      { value: 'iud', label: 'IUD (Copper-T)' },
      { value: 'injectable', label: 'Injectable (Antara)' },
      { value: 'sterilization', label: 'Permanent (Sterilization)' }
    ]},
    { id: 'stockDistributed', label: 'Materials Distributed Today', type: 'select', required: false, options: [
      { value: 'none', label: 'None' },
      { value: 'condom', label: 'Condoms' },
      { value: 'ocp', label: 'OCP Cycles' },
      { value: 'ptk', label: 'Pregnancy Test Kit' }
    ]},
    { id: 'counselingGiven', label: 'Provided Counseling?', type: 'checkbox', required: false },
    { id: 'notes', label: 'Follow up notes', type: 'textarea', required: false, placeholder: 'Side effects, questions...' }
  ];

  return (
    <BaseModuleForm
      title="Family Planning"
      moduleIcon="diversity_3"
      collectionName="family_planning"
      moduleName="family_planning"
      fields={fields}
      aadhaarPersonLabel="Beneficiary / लाभार्थी"
    />
  );
}
