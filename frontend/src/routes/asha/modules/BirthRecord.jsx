// TODO: Add view mode — same pattern as FamilySurvey.jsx
import BaseModuleForm from '../../../components/BaseModuleForm';

const FIELDS = [
  { id: 'mother_name', label: 'Mother Name / à¤†à¤ˆà¤šà¥‡ à¤¨à¤¾à¤µ', required: true },
  { id: 'father_name', label: 'Father Name / à¤µà¤¡à¤¿à¤²à¤¾à¤‚à¤šà¥‡ à¤¨à¤¾à¤µ', required: true },
  { id: 'baby_name', label: 'Baby Name (if named)', placeholder: 'Leave blank if not yet named' },
  { id: 'baby_gender', label: 'Baby Gender', type: 'select', required: true, options: [
    { value: 'Male', label: 'Male / à¤®à¥�à¤²à¤—à¤¾' }, { value: 'Female', label: 'Female / à¤®à¥�à¤²à¤—à¥€' }
  ]},
  { id: 'birth_date', label: 'Date of Birth', type: 'date', required: true },
  { id: 'birth_time', label: 'Time of Birth', type: 'time' },
  { id: 'birth_weight_kg', label: 'Birth Weight (kg)', type: 'number', required: true, placeholder: 'e.g. 2.8' },
  { id: 'delivery_type', label: 'Delivery Type', type: 'select', required: true, options: [
    { value: 'Normal', label: 'Normal / à¤¸à¤¾à¤®à¤¾à¤¨à¥�à¤¯' },
    { value: 'Cesarean', label: 'Cesarean / à¤¶à¤¸à¥�à¤¤à¥�à¤°à¤•à¥�à¤°à¤¿à¤¯à¤¾' },
    { value: 'Assisted', label: 'Assisted / à¤¸à¤¹à¤¾à¤¯à¥�à¤¯à¤¿à¤¤' }
  ]},
  { id: 'delivery_place', label: 'Place of Delivery', type: 'select', required: true, options: [
    { value: 'Home', label: 'Home / à¤˜à¤°à¥€' },
    { value: 'PHC', label: 'PHC / à¤ªà¥�à¤°à¤¾à¤¥à¤®à¤¿à¤• à¤†à¤°à¥‹à¤—à¥�à¤¯ à¤•à¥‡à¤‚à¤¦à¥�à¤°' },
    { value: 'District Hospital', label: 'District Hospital' },
    { value: 'Private Hospital', label: 'Private Hospital' }
  ]},
  { id: 'delivery_attendant', label: 'Delivery Attendant', type: 'select', options: [
    { value: 'Doctor', label: 'Doctor' }, { value: 'Nurse', label: 'Nurse/ANM' },
    { value: 'TBA', label: 'Traditional Birth Attendant' }, { value: 'ASHA', label: 'ASHA Worker' },
    { value: 'None', label: 'No trained attendant' }
  ]},
  { id: 'complications', label: 'Complications (if any)', type: 'textarea', placeholder: 'PPH, cord prolapse, etc.' },
  { id: 'jsy_benefit', label: 'JSY Benefit Availed?', type: 'checkbox', checkboxLabel: 'Janani Suraksha Yojana benefit taken' },
];

export default function BirthRecord() {
  return <BaseModuleForm 
    title="Birth Record / à¤œà¤¨à¥�à¤® à¤¨à¥‹à¤‚à¤¦" 
    moduleIcon="cake" 
    collectionName="birth_records"
    moduleName="birth_record"
    fields={FIELDS}
    aadhaarPersonLabel="Mother / à¤†à¤ˆ"
  />;
}

