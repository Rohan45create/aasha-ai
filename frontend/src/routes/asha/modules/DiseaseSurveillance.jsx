// TODO: Add view mode — same pattern as FamilySurvey.jsx
import React, { useState } from 'react';
import BaseModuleForm from '../../../components/BaseModuleForm';
import { apiFetch } from '../../../utils/api';
import ReactMarkdown from 'react-markdown';

export default function DiseaseSurveillance() {
  const [searchQuery, setSearchQuery] = useState('');
  const [researchData, setResearchData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/disease/research?query=${encodeURIComponent(searchQuery)}`);
      setResearchData(data);
    } catch (err) {
      setError('Failed to fetch research. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const ResearchSection = () => (
    <div className="mt-6 bg-[#E3F2FD] rounded-2xl p-5 border border-[#1565C0] shadow-sm">
      <h3 className="text-lg font-bold text-[#01579B] flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined">search</span>
        Disease Research & Guidelines
      </h3>
      <p className="text-sm text-[#0288D1] mb-4">
        Ask AshaAI to search official government guidelines or recent studies regarding symptoms or outbreaks.
      </p>
      
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="e.g., Latest guidelines for Malaria outbreak..."
          className="flex-1 p-3 rounded-xl border border-[#B3E5FC] focus:outline-none focus:border-[#0288D1]"
        />
        <button 
          type="submit" 
          disabled={loading}
          className="bg-[#0288D1] text-white px-5 rounded-xl font-bold flex items-center justify-center min-w-[100px] disabled:opacity-70 active:scale-95 transition-all"
        >
          {loading ? <span className="material-symbols-outlined animate-spin">refresh</span> : 'Search'}
        </button>
      </form>
      
      {error && <p className="text-[#D32F2F] text-sm font-bold mb-3">{error}</p>}
      
      {researchData && (
        <div className="bg-white p-4 rounded-xl border border-[#B3E5FC]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Results</span>
            <span className="bg-[#EAF3DE] text-[#1D9E75] text-[10px] font-bold px-2 py-1 rounded border border-[#1D9E75]">
              {researchData.source}
            </span>
          </div>
          <div className="prose prose-sm prose-blue max-w-none text-gray-800">
            <ReactMarkdown>{researchData.research_summary}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <BaseModuleForm
        title="Disease Surveillance (IDSP)"
        moduleIcon="coronavirus"
        collectionName="disease_alerts"
        moduleName="disease_surveillance"
        fields={fields}
        aadhaarPersonLabel="Patient / रुग्ण"
      />
      <ResearchSection />
    </>
  );
}
