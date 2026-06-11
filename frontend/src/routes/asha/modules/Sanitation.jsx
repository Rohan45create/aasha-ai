// TODO: Add view mode — same pattern as FamilySurvey.jsx
import React from 'react';
import BaseModuleForm from '../../../components/BaseModuleForm';

export default function Sanitation() {
  const fields = [
    { id: 'householdHead', label: 'Household Head Name', type: 'text', required: true, placeholder: 'Enter name' },
    { id: 'village', label: 'Village/Ward', type: 'text', required: true, placeholder: 'Enter village' },
    { id: 'waterSource', label: 'Primary Drinking Water Source', type: 'select', required: true, options: [
      { value: 'piped', label: 'Piped Water (Tap)' },
      { value: 'handpump', label: 'Handpump / Tube well' },
      { value: 'well', label: 'Open Well' },
      { value: 'other', label: 'Other Surface Water' }
    ]},
    { id: 'waterTreatment', label: 'Water Treatment Method', type: 'select', required: true, options: [
      { value: 'none', label: 'None' },
      { value: 'boil', label: 'Boiling' },
      { value: 'filter', label: 'Filtration' },
      { value: 'chlorine', label: 'Chlorine Tablets' }
    ]},
    { id: 'toiletType', label: 'Toilet Facility Type', type: 'select', required: true, options: [
      { value: 'flush', label: 'Flush / Pour-flush' },
      { value: 'pit', label: 'Pit Latrine' },
      { value: 'open', label: 'Open Defecation' },
      { value: 'community', label: 'Community Toilet' }
    ]},
    { id: 'wasteDisposal', label: 'Solid Waste Disposal', type: 'select', required: true, options: [
      { value: 'collected', label: 'Collected by Panchayat/Municipality' },
      { value: 'burned', label: 'Burned / Buried' },
      { value: 'open_dump', label: 'Open Dumping' }
    ]},
    { id: 'notes', label: 'Observations / Risk Factors', type: 'textarea', required: false, placeholder: 'E.g., stagnant water nearby...' }
  ];

  return (
    <BaseModuleForm
      title="WASH & Sanitation Survey"
      moduleIcon="water_drop"
      collectionName="sanitation_surveys"
      moduleName="sanitation"
      fields={fields}
      aadhaarPersonLabel="Household Head / à¤•à¥�à¤Ÿà¥�à¤‚à¤¬ à¤ªà¥�à¤°à¤®à¥�à¤–"
    />
  );
}

