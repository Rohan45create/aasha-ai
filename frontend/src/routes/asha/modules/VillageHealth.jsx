import BaseModuleForm from '../../../components/BaseModuleForm';

const FIELDS = [
  { id: 'village_name', label: 'Village Name / गावाचे नाव', required: true },
  { id: 'survey_date', label: 'Survey Date', type: 'date', required: true },
  { id: 'total_population', label: 'Total Population', type: 'number', required: true, placeholder: 'Approx population' },
  { id: 'total_households', label: 'Total Households', type: 'number', required: true },
  { id: 'anganwadi_count', label: 'Number of Anganwadis', type: 'number', placeholder: '1' },
  { id: 'phc_distance_km', label: 'Distance to Nearest PHC (km)', type: 'number', placeholder: 'e.g. 5' },
  { id: 'ambulance_available', label: 'Ambulance Service Available?', type: 'checkbox', checkboxLabel: '108/102 service accessible' },
  { id: 'main_water_source', label: 'Main Water Source', type: 'select', options: [
    { value: 'Tap', label: 'Piped Water (Jal Jeevan)' },
    { value: 'Borewell', label: 'Borewell' },
    { value: 'Well', label: 'Open Well' },
    { value: 'River', label: 'River / Canal' },
    { value: 'Tanker', label: 'Tanker' }
  ]},
  { id: 'water_testing_done', label: 'Water Quality Testing Done?', type: 'checkbox', checkboxLabel: 'Last 6 months' },
  { id: 'fluoride_affected', label: 'Fluoride / Arsenic Affected?', type: 'checkbox', checkboxLabel: 'Contamination reported' },
  { id: 'common_diseases', label: 'Common Diseases in Village', type: 'textarea', placeholder: 'Malaria, diarrhoea, dengue, TB...' },
  { id: 'health_camp_date', label: 'Last Health Camp Date', type: 'date' },
  { id: 'vhsnc_meeting_held', label: 'VHSNC Meeting Held?', type: 'checkbox', checkboxLabel: 'Village Health Sanitation & Nutrition Committee meeting this month' },
  { id: 'remarks', label: 'Remarks', type: 'textarea', placeholder: 'Road access issues, migration patterns, etc.' },
];

export default function VillageHealth() {
  return <BaseModuleForm 
    title="Village Health / ग्राम आरोग्य" 
    moduleIcon="holiday_village" 
    collectionName="village_health"
    moduleName="village_health"
    fields={FIELDS}
    showAadhaar={false}
  />;
}
