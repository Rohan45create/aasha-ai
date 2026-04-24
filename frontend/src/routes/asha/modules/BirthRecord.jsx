import BaseModuleForm from '../../../components/BaseModuleForm';

const FIELDS = [
  { id: 'mother_name', label: 'Mother Name / आईचे नाव', required: true },
  { id: 'father_name', label: 'Father Name / वडिलांचे नाव', required: true },
  { id: 'baby_name', label: 'Baby Name (if named)', placeholder: 'Leave blank if not yet named' },
  { id: 'baby_gender', label: 'Baby Gender', type: 'select', required: true, options: [
    { value: 'Male', label: 'Male / मुलगा' }, { value: 'Female', label: 'Female / मुलगी' }
  ]},
  { id: 'birth_date', label: 'Date of Birth', type: 'date', required: true },
  { id: 'birth_time', label: 'Time of Birth', type: 'time' },
  { id: 'birth_weight_kg', label: 'Birth Weight (kg)', type: 'number', required: true, placeholder: 'e.g. 2.8' },
  { id: 'delivery_type', label: 'Delivery Type', type: 'select', required: true, options: [
    { value: 'Normal', label: 'Normal / सामान्य' },
    { value: 'Cesarean', label: 'Cesarean / शस्त्रक्रिया' },
    { value: 'Assisted', label: 'Assisted / सहाय्यित' }
  ]},
  { id: 'delivery_place', label: 'Place of Delivery', type: 'select', required: true, options: [
    { value: 'Home', label: 'Home / घरी' },
    { value: 'PHC', label: 'PHC / प्राथमिक आरोग्य केंद्र' },
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
    title="Birth Record / जन्म नोंद" 
    moduleIcon="cake" 
    collectionName="birth_records"
    moduleName="birth_record"
    fields={FIELDS}
  />;
}
