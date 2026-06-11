import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { apiFetch, showToast } from '../../utils/api';

export default function AppointmentsList() {
  const navigate = useNavigate();
  const { docId } = useAuthStore();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!docId) return;
    let isUnmounted = false;
    
    const loadVisits = async () => {
      try {
        const data = await apiFetch(`/api/appointments/upcoming/${docId}`);
        if (!isUnmounted) {
          setVisits(data);
          setLoading(false);
        }
      } catch (err) {
        if (!isUnmounted) setLoading(false);
      }
    };
    
    loadVisits();
    return () => { isUnmounted = true; };
  }, [docId]);

  const handleCompleteVisit = async (id) => {
    try {
      await apiFetch(`/api/appointments/${id}/complete`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: 'Completed from appointments list' })
      });
      setVisits(prev => prev.filter(v => v.id !== id));
      showToast('Visit marked as complete ✓', 'success');
    } catch (err) {
      showToast('Failed to complete visit', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#F1EFE8] pb-24">
      {/* Header */}
      <div className="bg-white px-4 py-4 sticky top-0 z-30 shadow-sm border-b border-[#D3D1C7] flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 active:scale-95 transition-all">
          <span className="material-symbols-outlined text-gray-700">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold text-[#1A1A18] flex items-center gap-2">
          <span className="material-symbols-outlined text-[#1D9E75]">calendar_month</span>
          All Scheduled Visits
        </h1>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <span className="material-symbols-outlined animate-spin text-3xl text-[#1D9E75]">refresh</span>
          </div>
        ) : visits.length === 0 ? (
          <div className="p-6 bg-white rounded-2xl border border-[#D3D1C7] text-center shadow-sm">
            <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">event_available</span>
            <h3 className="font-bold text-[#1A1A18] mb-1">No Upcoming Visits</h3>
            <p className="text-sm text-[#5F5E5A]">You don't have any visits scheduled for the future.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visits.map(visit => {
              const dateObj = new Date(visit.scheduledDate);
              const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
              
              return (
                <div key={visit.id} className="bg-white p-4 rounded-2xl shadow-sm border border-[#D3D1C7]">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-[#1D9E75] bg-[#EAF3DE] px-3 py-1 rounded-lg">
                      📅 {dateStr} at {visit.scheduledTime || 'TBD'}
                    </p>
                    <button 
                      onClick={() => handleCompleteVisit(visit.id)}
                      className="px-4 py-2 bg-[#1D9E75] text-white rounded-xl text-sm font-bold shadow-sm active:scale-95 hover:bg-[#16815e] transition-colors"
                    >
                      Done ✓
                    </button>
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1A1A18] text-lg mb-1">{visit.targetName}</h3>
                    <p className="text-sm text-[#5F5E5A] bg-gray-50 p-2 rounded-lg border border-gray-100">{visit.purpose || 'General checkup'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
