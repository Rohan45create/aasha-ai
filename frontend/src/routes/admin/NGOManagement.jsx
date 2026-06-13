import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { apiFetch } from '../../utils/api';
import { useTx } from '../../context/TranslationContext';

const statusColors = {
  scheduled: { bg: '#FAEEDA', text: '#633806', label: 'Scheduled' },
  completed: { bg: '#EAF3DE', text: '#27500A', label: 'Completed' },
  cancelled: { bg: '#FCEBEB', text: '#791F1F', label: 'Cancelled' },
};

export default function NGOManagement() {
  const [ngos, setNgos] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddNgo, setShowAddNgo] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedNgo, setSelectedNgo] = useState(null);
  
  const [newNgo, setNewNgo] = useState({ name: '', address: '', contact: '', capacity: '' });
  const [scheduleData, setScheduleData] = useState({ ashaId: '', scheduledDate: '', scheduledTime: '10:00', purpose: 'Routine child health monitoring visit' });
  
  const [expandedNgoId, setExpandedNgoId] = useState(null);
  const [ngoAppointments, setNgoAppointments] = useState({});
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  const tx = useTx();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch NGOs
      const ngoSnap = await getDocs(collection(db, 'ngos'));
      setNgos(ngoSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      // Fetch Workers for scheduling
      const workerSnap = await getDocs(query(collection(db, 'ashas')));
      setWorkers(workerSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      alert(tx('Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async (ngoId) => {
    if (ngoAppointments[ngoId]) return; // Already fetched
    setLoadingAppointments(true);
    try {
      const data = await apiFetch(`/api/ngo/${ngoId}/appointments`);
      setNgoAppointments(prev => ({...prev, [ngoId]: data.appointments}));
    } catch (err) {
      console.error(err);
      alert('Failed to load appointment history');
    } finally {
      setLoadingAppointments(false);
    }
  };

  const toggleExpand = (ngoId) => {
    if (expandedNgoId === ngoId) {
      setExpandedNgoId(null);
    } else {
      setExpandedNgoId(ngoId);
      fetchAppointments(ngoId);
    }
  };

  const handleAddNgo = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'ngos'), {
        ...newNgo,
        createdAt: new Date()
      });
      setShowAddNgo(false);
      setNewNgo({ name: '', address: '', contact: '', capacity: '' });
      fetchData();
    } catch (err) {
      alert(tx('Failed to add NGO'));
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    try {
      // Use book-appointment which sends email to NGO
      await apiFetch('/api/ngo/book-appointment', {
        method: 'POST',
        body: JSON.stringify({
          ngo_id: selectedNgo.id,
          ngo_email: selectedNgo.email || '',
          ngo_name: selectedNgo.name,
          scheduled_date: scheduleData.scheduledDate,
          scheduled_time: scheduleData.scheduledTime,
          purpose: scheduleData.purpose,
          assigned_asha_ids: scheduleData.ashaId === 'all' ? ['all'] : [scheduleData.ashaId],
          head_id: scheduleData.ashaId
        })
      });
      alert(tx('Appointment scheduled — email sent to NGO'));
      setShowSchedule(false);
      setSelectedNgo(null);
      setScheduleData({ ashaId: '', scheduledDate: '', scheduledTime: '10:00', purpose: 'Routine child health monitoring visit' });
      
      // refresh if expanded
      if (expandedNgoId === selectedNgo?.id) {
        const data = await apiFetch(`/api/ngo/${selectedNgo.id}/appointments`);
        setNgoAppointments(prev => ({...prev, [selectedNgo.id]: data.appointments}));
      }
    } catch (err) {
      console.error('Schedule error:', err);
      alert(tx('Failed to schedule appointment'));
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">{tx('NGO Management')}</h1>
        <button 
          onClick={() => setShowAddNgo(true)}
          className="bg-[#1D9E75] text-white px-4 py-2 rounded-xl font-medium"
        >
          {tx('+ Add NGO')}
        </button>
      </div>

      {loading ? (
        <div className="text-center p-12 text-gray-500">{tx('Loading...')}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#D3D1C7] overflow-hidden">
          {ngos.length === 0 && <div className="p-8 text-center text-gray-500">{tx('No NGOs registered yet.')}</div>}
          
          {ngos.length > 0 && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-[#D3D1C7]">
                  <th className="p-4 font-semibold text-[#5F5E5A]">NGO Name</th>
                  <th className="p-4 font-semibold text-[#5F5E5A]">Contact</th>
                  <th className="p-4 font-semibold text-[#5F5E5A]">Location</th>
                  <th className="p-4 font-semibold text-[#5F5E5A] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ngos.map(ngo => (
                  <React.Fragment key={ngo.id}>
                    <tr className="border-b border-[#D3D1C7] hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => toggleExpand(ngo.id)}
                            className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-500"
                          >
                            <span className="material-symbols-outlined" style={{transition: 'transform 0.2s', transform: expandedNgoId === ngo.id ? 'rotate(90deg)' : 'rotate(0deg)'}}>
                              chevron_right
                            </span>
                          </button>
                          <span className="font-bold text-[#1A1A18]">{ngo.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center text-sm text-[#5F5E5A]">
                          <span className="material-symbols-outlined text-[16px] mr-1">call</span> 
                          {ngo.contact}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center text-sm text-[#5F5E5A]">
                          <span className="material-symbols-outlined text-[16px] mr-1">location_on</span> 
                          {ngo.address}
                        </div>
                        {(ngo.gpsLat && ngo.gpsLng) && (
                          <button 
                            onClick={() => navigate('/admin/coverage-map', { state: { centerLat: ngo.gpsLat, centerLng: ngo.gpsLng, focusNgoId: ngo.id } })}
                            className="text-xs text-[#1D9E75] hover:underline flex items-center mt-1 font-medium"
                          >
                            📍 View on Map
                          </button>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => { setSelectedNgo(ngo); setShowSchedule(true); }}
                          className="bg-[#EAF3DE] text-[#27500A] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#D5E8C3] transition-colors"
                        >
                          Schedule Visit
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Sub-table for Appointments */}
                    {expandedNgoId === ngo.id && (
                      <tr className="bg-[#F8F9FA] border-b border-[#D3D1C7]">
                        <td colSpan="4" className="p-6">
                          <h4 className="font-bold text-sm text-[#5F5E5A] mb-3 uppercase tracking-wider">Appointment History</h4>
                          
                          {loadingAppointments ? (
                            <div className="text-sm text-gray-500">Loading appointments...</div>
                          ) : (ngoAppointments[ngo.id] && ngoAppointments[ngo.id].length > 0) ? (
                            <div className="border border-[#E0E0E0] rounded-xl overflow-hidden bg-white shadow-sm">
                              <table className="w-full text-sm">
                                <thead className="bg-[#F1F3F5]">
                                  <tr>
                                    <th className="p-3 font-semibold text-[#5F5E5A] text-left">Date</th>
                                    <th className="p-3 font-semibold text-[#5F5E5A] text-left">Time</th>
                                    <th className="p-3 font-semibold text-[#5F5E5A] text-left">Purpose</th>
                                    <th className="p-3 font-semibold text-[#5F5E5A] text-left">Assigned To</th>
                                    <th className="p-3 font-semibold text-[#5F5E5A] text-left">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ngoAppointments[ngo.id].map(appt => {
                                    const statusConfig = statusColors[appt.status?.toLowerCase()] || { bg: '#E0E0E0', text: '#333', label: appt.status || 'Unknown' };
                                    
                                    // Parse ISO date string safely
                                    let dateStr = appt.scheduledDate;
                                    let timeStr = appt.scheduledTime;
                                    
                                    // If scheduledDate is an ISO timestamp without a scheduledTime field (like old bulk appointments), extract it
                                    if (appt.scheduledDate && appt.scheduledDate.includes('T')) {
                                      const d = new Date(appt.scheduledDate);
                                      dateStr = d.toLocaleDateString();
                                      if (!timeStr) {
                                        timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                      }
                                    }
                                    
                                    return (
                                      <tr key={appt.id} className="border-t border-[#F1F3F5] hover:bg-gray-50">
                                        <td className="p-3 font-medium">{dateStr}</td>
                                        <td className="p-3 text-gray-600">{timeStr || '--'}</td>
                                        <td className="p-3 text-gray-600">{appt.purpose || appt.type?.replace(/_/g, ' ') || 'Visit'}</td>
                                        <td className="p-3 text-gray-600">{appt.assignedAshaNames || appt.ashaId || '--'}</td>
                                        <td className="p-3">
                                          <span style={{ backgroundColor: statusConfig.bg, color: statusConfig.text }} className="px-2 py-1 rounded-md text-xs font-bold">
                                            {statusConfig.label}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 bg-white p-4 rounded-lg border border-[#E0E0E0] text-center">
                              No appointment history found.
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add NGO Modal */}
      {showAddNgo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{tx('Register New NGO')}</h2>
            <form onSubmit={handleAddNgo} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{tx('NGO Name')}</label>
                <input required type="text" value={newNgo.name} onChange={e => setNewNgo({...newNgo, name: e.target.value})} className="w-full p-2 border rounded-lg focus:outline-none focus:border-[#1D9E75]"/>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{tx('Address')}</label>
                <input required type="text" value={newNgo.address} onChange={e => setNewNgo({...newNgo, address: e.target.value})} className="w-full p-2 border rounded-lg focus:outline-none focus:border-[#1D9E75]"/>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{tx('Contact Number')}</label>
                <input required type="text" value={newNgo.contact} onChange={e => setNewNgo({...newNgo, contact: e.target.value})} className="w-full p-2 border rounded-lg focus:outline-none focus:border-[#1D9E75]"/>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddNgo(false)} className="flex-1 py-2 text-gray-600 border rounded-xl">{tx('Cancel')}</button>
                <button type="submit" className="flex-1 py-2 bg-[#1D9E75] text-white rounded-xl font-bold">{tx('Save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-1">{tx('Schedule Visit')}</h2>
            <p className="text-sm text-[#5F5E5A] mb-4">{selectedNgo?.name}</p>
            <form onSubmit={handleSchedule} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{tx('Assign ASHA Worker')}</label>
                <select required value={scheduleData.ashaId} onChange={e => setScheduleData({...scheduleData, ashaId: e.target.value})} className="w-full p-2 border rounded-lg focus:outline-none focus:border-[#1D9E75]">
                  <option value="">{tx('Select...')}</option>
                  <option value="all">All Workers</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.name || w.id}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">{tx('Date')}</label>
                  <input required type="date" min={new Date().toISOString().split('T')[0]} value={scheduleData.scheduledDate} onChange={e => setScheduleData({...scheduleData, scheduledDate: e.target.value})} className="w-full p-2 border rounded-lg focus:outline-none focus:border-[#1D9E75]"/>
                </div>
                <div className="w-32">
                  <label className="block text-sm font-medium mb-1">{tx('Time')}</label>
                  <input required type="time" value={scheduleData.scheduledTime} onChange={e => setScheduleData({...scheduleData, scheduledTime: e.target.value})} className="w-full p-2 border rounded-lg focus:outline-none focus:border-[#1D9E75]"/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{tx('Purpose')}</label>
                <input required type="text" value={scheduleData.purpose} onChange={e => setScheduleData({...scheduleData, purpose: e.target.value})} className="w-full p-2 border rounded-lg focus:outline-none focus:border-[#1D9E75]"/>
              </div>
              <p className="text-xs text-[#5F5E5A] flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">mail</span>
                An email notification will be sent to the NGO automatically.
              </p>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSchedule(false)} className="flex-1 py-2 text-gray-600 border rounded-xl">{tx('Cancel')}</button>
                <button type="submit" className="flex-1 py-2 bg-[#1D9E75] text-white rounded-xl font-bold">{tx('Schedule & Notify')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
