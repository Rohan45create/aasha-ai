import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { useTx } from '../context/TranslationContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const METRIC_TO_SURVEY = {
  'Families Surveyed': 'households',
  'ANC Registrations': 'pregnancies',
  'Children Measured': 'children',
  'Vaccinations Recorded': 'vaccinations',
  'Critical Cases (Total)': 'children', // special filter later
  'NRC Referrals': 'referrals'
};

const SURVEY_CONFIGS = {
  'households': {
    title: 'Village Health Survey Register',
    headers: ['Sr No', 'ASHA Name', 'House No', 'Family No', 'Head Name & Contact', 'BPL/APL', 'Total Mems'],
    mapRow: (d, i, ashaName) => [String(i + 1), ashaName, String(d.houseNumber || d.house_number || '-'), String(d.id.slice(-6).toUpperCase()), String(d.familyHeadName || '-'), String(d.bplStatus !== undefined ? (d.bplStatus ? 'BPL' : 'APL') : '-'), String(d.totalMembers || '-')]
  },
  'pregnancies': {
    title: 'ANC Registrations',
    headers: ['Sr No', 'ASHA Name', 'Mother Name', 'Age', 'LMP', 'EDD', 'Gravida', 'Parity', 'High Risk', 'Blood Grp', 'Husband'],
    mapRow: (p, i, ashaName) => [String(i + 1), ashaName, String(p.motherName || '-'), String(p.age || '-'), String(p.lmp || '-'), String(p.edd || '-'), String(p.gravida || '-'), String(p.parity || '-'), String(p.isHighRisk ? 'Yes' : 'No'), String(p.bloodGroup || '-'), String(p.husbandName || '-')]
  },
  'children': {
    title: 'Child Growth & Registrations',
    headers: ['Sr No', 'ASHA Name', 'Child Name', 'Gender', 'DOB', 'Birth Wt', 'Curr Wt', 'Height', 'MUAC', 'Nutrition', 'Mother Name'],
    mapRow: (c, i, ashaName) => [String(i + 1), ashaName, String(c.name || c.childName || '-'), String(c.gender || '-'), String(c.dob || '-'), String(c.birthWeight || '-'), String(c.currentWeight || '-'), String(c.height || '-'), String(c.muac || '-'), String(c.nutritionStatus || '-'), String(c.motherName || '-')]
  },
  'vaccinations': {
    title: 'Vaccination Records',
    headers: ['Sr No', 'ASHA Name', 'Child Name', 'Vaccine', 'Dose', 'Given Date', 'Due Date', 'Status', 'Site'],
    mapRow: (v, i, ashaName) => [String(i + 1), ashaName, String(v.childName || '-'), String(v.vaccineName || '-'), String(v.dose || '-'), String(v.givenDate || '-'), String(v.dueDate || '-'), String(v.status || '-'), String(v.site || '-')]
  },
  'referrals': {
    title: 'Referrals',
    headers: ['Sr No', 'ASHA Name', 'Patient Name', 'Reason', 'Referred To', 'Date', 'Status', 'Follow-up'],
    mapRow: (r, i, ashaName) => [String(i + 1), ashaName, String(r.patientName || '-'), String(r.reason || '-'), String(r.referredTo || '-'), String(r.date || '-'), String(r.status || '-'), String(r.followUpDate || '-')]
  }
};

export default function AdminReportModal({ isOpen, onClose, metricName, ashaIds }) {
  const tx = useTx();
  const [rangeType, setRangeType] = useState('custom');
  
  // Default to last 180 days to capture dummy data
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 180);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen || !metricName) return null;

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

      const selectedSurvey = METRIC_TO_SURVEY[metricName];
      const surveyConfig = SURVEY_CONFIGS[selectedSurvey];
      
      if (!selectedSurvey || !surveyConfig) {
        throw new Error('Survey configuration not found for ' + metricName);
      }

      // Fetch Asha names
      const ashaNames = {};
      for (const aid of ashaIds) {
        try {
          const wDoc = await getDoc(doc(db, 'ashas', aid));
          if (wDoc.exists() && wDoc.data().name) {
            ashaNames[aid] = wDoc.data().name;
          } else {
            ashaNames[aid] = aid; // fallback
          }
        } catch(e) {
          ashaNames[aid] = aid;
        }
      }

      let allData = [];

      // Query across all Asha workers
      for (const aid of ashaIds) {
        try {
          // Add filters if it's "Critical Cases"
          const constraints = [where('ashaId', '==', aid)];
          if (metricName === 'Critical Cases (Total)') {
            constraints.push(where('riskLevel', '==', 'CRITICAL'));
          }

          const surveyQuery = query(collection(db, selectedSurvey), ...constraints);
          const docSnap = await getDocs(surveyQuery);

          // Client-side date filter
          const filterByDate = (dSnap) => {
            const data = dSnap.data();
            if (!data.createdAt) return metricName === 'Critical Cases (Total)'; // If critical case missing date, allow it or filter out? Usually allow if no date.
            const createdAt = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
            return createdAt >= start && createdAt <= end;
          };

          const surveyData = docSnap.docs
            .filter(filterByDate)
            .map(d => ({ id: d.id, ...d.data(), ashaName: ashaNames[aid] }));
            
          allData = allData.concat(surveyData);
        } catch(e) {
          console.error(`Failed querying for ${aid}`, e);
        }
      }

      // Generate PDF
      const docPdf = new jsPDF({ orientation: 'landscape' });
      
      docPdf.setFontSize(18);
      docPdf.setTextColor(8, 80, 65);
      docPdf.text(tx("AshaAI - " + metricName + " Report"), 14, 22);
      
      docPdf.setFontSize(11);
      docPdf.setTextColor(100);
      docPdf.text(`Report Period: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`, 14, 30);
      docPdf.text(`Generated On: ${new Date().toLocaleString()}`, 14, 36);

      let startY = 44;

      if (allData.length === 0) {
        docPdf.setFontSize(12);
        docPdf.text("No records found for the selected period.", 14, startY);
      } else {
        docPdf.setFontSize(14);
        docPdf.setTextColor(0);
        docPdf.text(`Total Records: ${allData.length}`, 14, startY);
        
        const tableData = allData.map((d, index) => surveyConfig.mapRow(d, index, d.ashaName));
        
        autoTable(docPdf, {
          startY: startY + 5,
          head: [surveyConfig.headers],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [29, 158, 117], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14, right: 14 }
        });
      }

      docPdf.save(`AshaAI_Admin_${selectedSurvey}_${start.toISOString().split('T')[0]}.pdf`);
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
          <h2 className="text-xl font-bold text-[#1A1A18]">{tx('Download ' + metricName)}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 text-gray-500">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <p className="text-sm text-[#5F5E5A] mb-6">
          {tx('This will export records from all ASHA workers for this metric.')}
        </p>

        <div className="space-y-4 mb-6">
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
              <span>{tx('Download PDF')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
