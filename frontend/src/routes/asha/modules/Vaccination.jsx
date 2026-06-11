// TODO: Add view mode � same pattern as FamilySurvey.jsx
import BaseModuleForm from '../../../components/BaseModuleForm';

const VACCINE_OPTIONS = [
  { value: 'BCG', label: 'BCG' },
  { value: 'OPV-0', label: 'OPV-0' },
  { value: 'OPV-1', label: 'OPV-1' },
  { value: 'OPV-2', label: 'OPV-2' },
  { value: 'OPV-3', label: 'OPV-3' },
  { value: 'Pentavalent-1', label: 'Pentavalent-1' },
  { value: 'Pentavalent-2', label: 'Pentavalent-2' },
  { value: 'Pentavalent-3', label: 'Pentavalent-3' },
  { value: 'IPV', label: 'IPV' },
  { value: 'Rotavirus-1', label: 'Rotavirus-1' },
  { value: 'Rotavirus-2', label: 'Rotavirus-2' },
  { value: 'Rotavirus-3', label: 'Rotavirus-3' },
  { value: 'Measles-1', label: 'Measles/MR-1' },
  { value: 'Measles-2', label: 'Measles/MR-2' },
  { value: 'JE-1', label: 'JE-1' },
  { value: 'JE-2', label: 'JE-2' },
  { value: 'DPT-Booster-1', label: 'DPT Booster-1' },
  { value: 'DPT-Booster-2', label: 'DPT Booster-2' },
  { value: 'Vitamin-A', label: 'Vitamin A' },
  { value: 'TT-10', label: 'TT-10 years' },
  { value: 'TT-16', label: 'TT-16 years' },
];

const FIELDS = [
  { id: 'child_name', label: 'Child Name', required: true, placeholder: 'Full name' },
  { id: 'mother_name', label: 'Mother Name', required: true },
  { id: 'age_months', label: 'Age (months)', type: 'number', placeholder: '0-60' },
  { id: 'vaccine_name', label: 'Vaccine', type: 'select', required: true, options: VACCINE_OPTIONS },
  { id: 'dose_number', label: 'Dose Number', type: 'number', placeholder: '1' },
  { id: 'date_given', label: 'Date Given', type: 'date', required: true },
  { id: 'batch_number', label: 'Batch / Lot Number', placeholder: 'From vial label' },
  { id: 'next_due_date', label: 'Next Due Date', type: 'date' },
  { id: 'side_effects', label: 'Side Effects (if any)', type: 'textarea', placeholder: 'Fever, swelling, none' },
];

export default function Vaccination() {
  return <BaseModuleForm 
    title="Vaccination / लसीकरण" 
    moduleIcon="vaccines" 
    collectionName="vaccinations"
    moduleName="vaccination"
    fields={FIELDS}
    aadhaarPersonLabel="Child / बालक"
  />;
}

