import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useTx } from '../context/TranslationContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuthStore } from '../stores/authStore';

const SURVEY_CONFIGS = {
  'households': {
    title: 'Village Health Survey Register',
    headers: ['Sr No', 'House No', 'Family No', 'Head Name & Contact', 'Age', 'Religion', 'Caste', 'BPL/APL', 'Total Mems', 'Boys', 'Girls', 'Women', 'Men', '<5 Yrs', '<30 Yrs'],
    mapRow: (d, i) => [String(i + 1), String(d.houseNumber || d.house_number || '-'), String(d.id.slice(-6).toUpperCase()), String(d.familyHeadName || '-'), '-', '-', '-', String(d.bplStatus !== undefined ? (d.bplStatus ? 'BPL' : 'APL') : '-'), String(d.totalMembers || '-'), '-', '-', '-', '-', '-', '-']
  },
  'household_members': {
    title: 'Family Member Survey Register',
    headers: ['Sr No', 'House No', 'Member Name', 'Gender', 'DOB', 'Age', 'Relation', 'Marital', 'Aadhaar', 'Mobile', 'ABHA ID', 'EC No', 'Reason'],
    mapRow: (m, i) => [String(i + 1), String(m.house_number || '-'), String(m.member_name || '-'), String(m.gender || '-'), String(m.date_of_birth || '-'), String(m.age || '-'), String(m.relationship_to_head || '-'), String(m.marital_status || '-'), String(m.aadhaar_raw || '-'), String(m.mobile_number || '-'), String(m.abha_id || '-'), String(m.birth_register_serial || '-'), String(m.reason_removed_from_register || '-')]
  },
  'children': {
    title: 'Child Growth & Registrations',
    headers: ['Sr No', 'Child Name', 'Gender', 'DOB', 'Birth Weight', 'Curr Weight', 'Height', 'MUAC', 'Nutrition', 'Mother Name'],
    mapRow: (c, i) => [String(i + 1), String(c.name || c.childName || '-'), String(c.gender || '-'), String(c.dob || '-'), String(c.birthWeight || '-'), String(c.currentWeight || '-'), String(c.height || '-'), String(c.muac || '-'), String(c.nutritionStatus || '-'), String(c.motherName || '-')]
  },
  'pregnancies': {
    title: 'ANC Registrations',
    headers: ['Sr No', 'Mother Name', 'Age', 'LMP', 'EDD', 'Gravida', 'Parity', 'High Risk', 'Blood Grp', 'Husband Name'],
    mapRow: (p, i) => [String(i + 1), String(p.motherName || '-'), String(p.age || '-'), String(p.lmp || '-'), String(p.edd || '-'), String(p.gravida || '-'), String(p.parity || '-'), String(p.isHighRisk ? 'Yes' : 'No'), String(p.bloodGroup || '-'), String(p.husbandName || '-')]
  },
  'vaccinations': {
    title: 'Vaccination Records',
    headers: ['Sr No', 'Child Name', 'Vaccine', 'Dose', 'Given Date', 'Due Date', 'Status', 'Site'],
    mapRow: (v, i) => [String(i + 1), String(v.childName || '-'), String(v.vaccineName || '-'), String(v.dose || '-'), String(v.givenDate || '-'), String(v.dueDate || '-'), String(v.status || '-'), String(v.site || '-')]
  },
  'disease_surveillance': {
    title: 'Disease Surveillance',
    headers: ['Sr No', 'Patient Name', 'Disease', 'Symptoms', 'Date of Onset', 'Status', 'Referred To'],
    mapRow: (d, i) => [String(i + 1), String(d.patientName || '-'), String(d.disease || '-'), String(d.symptoms || '-'), String(d.dateOfOnset || '-'), String(d.status || '-'), String(d.referredTo || '-')]
  },
  'ncd_tracking': {
    title: 'NCD Tracking',
    headers: ['Sr No', 'Patient Name', 'Age', 'BP', 'Blood Sugar', 'Height', 'Weight', 'BMI', 'Risk Level'],
    mapRow: (n, i) => [String(i + 1), String(n.patientName || '-'), String(n.age || '-'), String(n.bloodPressure || '-'), String(n.bloodSugar || '-'), String(n.height || '-'), String(n.weight || '-'), String(n.bmi || '-'), String(n.riskLevel || '-')]
  },
  'death_records': {
    title: 'Death Records',
    headers: ['Sr No', 'Deceased Name', 'Age', 'Gender', 'Date of Death', 'Place', 'Cause'],
    mapRow: (d, i) => [String(i + 1), String(d.deceasedName || '-'), String(d.age || '-'), String(d.gender || '-'), String(d.dateOfDeath || '-'), String(d.placeOfDeath || '-'), String(d.causeOfDeath || '-')]
  },
  'referrals': {
    title: 'Referrals',
    headers: ['Sr No', 'Patient Name', 'Reason', 'Referred To', 'Date', 'Status', 'Follow-up'],
    mapRow: (r, i) => [String(i + 1), String(r.patientName || '-'), String(r.reason || '-'), String(r.referredTo || '-'), String(r.date || '-'), String(r.status || '-'), String(r.followUpDate || '-')]
  },
  'visits': {
    title: 'Routine Visits',
    headers: ['Sr No', 'Family/Patient', 'Purpose', 'Date', 'Notes', 'Follow-up'],
    mapRow: (v, i) => [String(i + 1), String(v.headName || v.patientName || '-'), String(v.purpose || '-'), String(v.date || '-'), String(v.notes || '-'), String(v.followUpDate || '-')]
  }
};

export default function DailyReportModal({ isOpen, onClose, ashaId }) {
  const tx = useTx();
  const { user } = useAuthStore();
  const [rangeType, setRangeType] = useState('custom');
  const [selectedSurvey, setSelectedSurvey] = useState('households');
  
  // Default to last 180 days to ensure dummy data is captured
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 180);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      let start = new Date();
      start.setHours(0, 0, 0, 0);
      let end = new Date();
      end.setHours(23, 59, 59, 999);

      if (rangeType === 'custom') {
        if (!startDate || !endDate) {
          alert(tx('Please select both start and end dates'));
          setIsGenerating(false);
          return;
        }
        start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
      }

      const surveyConfig = SURVEY_CONFIGS[selectedSurvey];
      if (!surveyConfig) {
        throw new Error('Invalid survey configuration');
      }

      // Query the selected collection
      const surveyQuery = query(
        collection(db, selectedSurvey),
        where('ashaId', '==', ashaId)
      );
      
      const docSnap = await getDocs(surveyQuery);

      // Filter by date client-side to avoid Firestore composite index errors
      const filterByDate = (dSnap) => {
        const data = dSnap.data();
        if (!data.createdAt) return false;
        const createdAt = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        return createdAt >= start && createdAt <= end;
      };

      const surveyData = docSnap.docs
        .filter(filterByDate)
        .map(d => ({ id: d.id, ...d.data() }));

      // Generate PDF
      const doc = new jsPDF({ orientation: 'landscape' });
      
      doc.setFontSize(18);
      doc.setTextColor(8, 80, 65);
      doc.text(tx("AshaAI - " + surveyConfig.title), 14, 22);
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`ASHA Worker: ${user?.displayName || ashaId}`, 14, 30);
      doc.text(`Report Period: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`, 14, 36);
      doc.text(`Generated On: ${new Date().toLocaleString()}`, 14, 42);

      let startY = 50;

      if (surveyData.length === 0) {
        doc.setFontSize(12);
        doc.text("No survey records found for the selected period.", 14, startY);
      } else {
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(`Total Records: ${surveyData.length}`, 14, startY);
        
        const tableData = surveyData.map((d, index) => surveyConfig.mapRow(d, index));
        
        autoTable(doc, {
          startY: startY + 5,
          head: [surveyConfig.headers],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [29, 158, 117], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14, right: 14 }
        });
      }

      // Save PDF
      doc.save(`AshaAI_${selectedSurvey}_${start.toISOString().split('T')[0]}.pdf`);
      
      onClose();
    } catch (error) {
      console.error("PDF Generation failed", error);
      alert(`Failed to generate report: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-fade-in">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-bold text-[#1A1A18]">{tx('Download Survey Registers')}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 text-gray-500">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-[#5F5E5A] mb-1">{tx('Select Survey')}</label>
            <select 
              value={selectedSurvey} 
              onChange={e => setSelectedSurvey(e.target.value)}
              className="w-full border border-[#D3D1C7] rounded-xl p-3 bg-[#F1EFE8] text-[#1A1A18] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
            >
              {Object.entries(SURVEY_CONFIGS).map(([key, config]) => (
                <option key={key} value={key}>{tx(config.title)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5F5E5A] mb-1">{tx('Select Range')}</label>
            <select 
              value={rangeType} 
              onChange={e => setRangeType(e.target.value)}
              className="w-full border border-[#D3D1C7] rounded-xl p-3 bg-[#F1EFE8] text-[#1A1A18] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
            >
              <option value="today">{tx('Today')}</option>
              <option value="custom">{tx('Custom Date Range')}</option>
            </select>
          </div>

          {rangeType === 'custom' && (
            <div className="flex space-x-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#5F5E5A] mb-1">{tx('Start Date')}</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full border border-[#D3D1C7] rounded-xl p-2 bg-[#F1EFE8] text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#5F5E5A] mb-1">{tx('End Date')}</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full border border-[#D3D1C7] rounded-xl p-2 bg-[#F1EFE8] text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                />
              </div>
            </div>
          )}
        </div>

        <button 
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full py-3 bg-[#1D9E75] text-white rounded-xl font-medium flex items-center justify-center space-x-2 shadow-md disabled:opacity-70 disabled:cursor-not-allowed transition-all"
        >
          {isGenerating ? (
            <>
              <span className="material-symbols-outlined animate-spin">refresh</span>
              <span>{tx('Generating...')}</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">download</span>
              <span>{tx('Download Report')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
