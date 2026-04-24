import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

const LoadingSkeleton = () => (
  <div className="space-y-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="bg-gray-200 h-16 rounded-xl animate-pulse" />
    ))}
  </div>
);

export default React.memo(function WorkerManagement() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', village: '', district: '' });
  const [submitting, setSubmitting] = useState(false);
  
  const [selectedActivityWorker, setSelectedActivityWorker] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const { user } = useAuthStore();
  const navigate = useNavigate();
  const headId = user?.uid;

  useEffect(() => {
    if (!selectedActivityWorker || !showTimeline) return;
    setTimelineLoading(true);
    const q = query(
      collection(db, 'module_submissions'),
      where('ashaId', '==', selectedActivityWorker.id),
      orderBy('submittedAt', 'desc'),
      limit(20)
    );
    getDocs(q).then(snap => {
      setTimelineEvents(snap.docs.map(d => d.data()));
      setTimelineLoading(false);
    }).catch(e => {
      console.error(e);
      setTimelineLoading(false);
    });
  }, [selectedActivityWorker, showTimeline]);

  useEffect(() => {
    if (!headId) return;

    async function loadWorkers() {
      try {
        const token = await user.getIdToken();
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/supervisor/workers/${headId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setWorkers(data);
        }
      } catch (err) {
        console.error('Error fetching workers:', err);
      } finally {
        setLoading(false);
      }
    }

    loadWorkers();
  }, [headId, user]);

  const handleAddWorker = async () => {
    if (!formData.name || !formData.phone || !formData.village || !formData.district) {
      alert('Please fill all fields');
      return;
    }

    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams(formData);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/supervisor/workers/add?${params}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('✓ Worker added successfully');
        setFormData({ name: '', phone: '', village: '', district: '' });
        setShowAddPanel(false);
        // Reload workers
        const token2 = await user.getIdToken();
        const newResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/supervisor/workers/${headId}`, {
          headers: {
            'Authorization': `Bearer ${token2}`
          }
        });
        if (newResponse.ok) {
          const newData = await newResponse.json();
          setWorkers(newData);
        }
      } else {
        alert('Failed to add worker');
      }
    } catch (err) {
      console.error('Error adding worker:', err);
      alert('Failed to add worker');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Worker Management</h1>
          <button disabled className="bg-gray-300 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 self-start">
            <span className="material-symbols-outlined text-lg">person_add</span> Add Worker
          </button>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#D3D1C7]">
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Worker Management</h1>
        <button
          onClick={() => setShowAddPanel(true)}
          className="bg-[#1D9E75] text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 self-start hover:bg-[#085041] transition-colors"
        >
          <span className="material-symbols-outlined text-lg">person_add</span> Add Worker
        </button>
      </div>

      {/* Add Worker Slide-in Panel */}
      {showAddPanel && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddPanel(false)} />
          <div className="absolute right-0 top-0 h-full w-full sm:w-96 bg-white shadow-2xl transform transition-transform">
            <div className="p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Add Worker</h2>
                <button
                  onClick={() => setShowAddPanel(false)}
                  className="text-[#5F5E5A] hover:bg-gray-100 p-2 rounded-lg"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium mb-2">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3 border border-[#D3D1C7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    placeholder="ASHA Worker Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Phone (+91) *</label>
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-[#5F5E5A] mr-2">+91</span>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      className="flex-1 p-3 border border-[#D3D1C7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                      placeholder="9876543210"
                      maxLength="10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Village *</label>
                  <input
                    type="text"
                    value={formData.village}
                    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                    className="w-full p-3 border border-[#D3D1C7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    placeholder="Village Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">District *</label>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="w-full p-3 border border-[#D3D1C7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  >
                    <option value="">Select District</option>
                    <option value="Beed">Beed</option>
                    <option value="Parbhani">Parbhani</option>
                    <option value="Aurangabad">Aurangabad</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleAddWorker}
                disabled={submitting}
                className="w-full mt-6 bg-[#1D9E75] text-white py-3 rounded-xl font-medium hover:bg-[#085041] transition-colors disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workers Table */}
      <div className="overflow-x-auto">
        <table className="w-full bg-white rounded-2xl shadow-sm border border-[#D3D1C7] overflow-hidden">
          <thead>
            <tr className="bg-[#085041] text-white text-sm">
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Village</th>
              <th className="text-left px-4 py-3 hidden lg:table-cell">Phone</th>
              <th className="text-center px-4 py-3">Status</th>
              <th className="text-center px-4 py-3 hidden lg:table-cell">Last Active</th>
              <th className="text-center px-4 py-3">Surveys/Mo</th>
              <th className="text-center px-4 py-3 hidden lg:table-cell">Coverage %</th>
              <th className="text-center px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {workers.length === 0 && (
              <tr>
                <td colSpan="8" className="px-4 py-8 text-center text-[#5F5E5A]">No workers assigned.</td>
              </tr>
            )}
            {workers.map(w => (
              <tr key={w.id} className="border-t border-[#D3D1C7] hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(`/admin/worker/${w.id}`)}>
                <td className="px-4 py-3 font-medium">{w.name}</td>
                <td className="px-4 py-3 text-[#5F5E5A] hidden md:table-cell">{w.village}</td>
                <td className="px-4 py-3 text-[#5F5E5A] hidden lg:table-cell">{w.phone}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${w.isActive ? 'bg-[#EAF3DE] text-[#085041]' : 'bg-gray-100 text-gray-500'}`}>
                    {w.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-sm text-[#5F5E5A] hidden lg:table-cell">
                  {w.last_active ? formatDistanceToNow(new Date(w.last_active), { addSuffix: true }) : 'Never'}
                </td>
                <td className="px-4 py-3 text-center font-bold">{w.submissions_this_month}</td>
                <td className="px-4 py-3 text-center hidden lg:table-cell">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#1D9E75] rounded-full" style={{width: `${w.coverage_percent}%`}} />
                    </div>
                    <span className="text-xs font-medium">{w.coverage_percent}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setSelectedActivityWorker(w); setShowTimeline(true); }} className="text-[#1D9E75] hover:bg-[#EAF3DE] p-2 rounded-lg" title="View Activity">
                      <span className="material-symbols-outlined text-lg">history</span>
                    </button>
                    <button className="text-[#E24B4A] hover:bg-[#FCEBEB] p-2 rounded-lg" title="Deactivate">
                      <span className="material-symbols-outlined text-lg">block</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Activity Timeline Modal */}
      {showTimeline && selectedActivityWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowTimeline(false)}>
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#D3D1C7] flex justify-between items-center bg-[#F8F9FA]">
              <h2 className="text-xl font-bold">Activity: {selectedActivityWorker.name}</h2>
              <button onClick={() => setShowTimeline(false)} className="text-[#5F5E5A] hover:bg-gray-200 p-2 rounded-lg"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {timelineLoading ? (
                <div className="text-center py-8"><span className="material-symbols-outlined animate-spin text-4xl text-[#1D9E75]">refresh</span></div>
              ) : timelineEvents.length === 0 ? (
                <p className="text-center text-[#5F5E5A]">No recent activity found.</p>
              ) : (
                <div className="relative border-l-2 border-[#EAF3DE] ml-4 space-y-6">
                  {timelineEvents.map((evt, idx) => (
                    <div key={idx} className="relative pl-6">
                      <span className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-[#1D9E75] border-4 border-white flex items-center justify-center shadow-sm"></span>
                      <div className="bg-gray-50 rounded-xl p-4 shadow-sm border border-[#D3D1C7]">
                        <p className="font-bold text-[#1A1A18] capitalize">{evt.moduleType.replace('_', ' ')}</p>
                        <p className="text-xs text-[#5F5E5A] mb-2">{format(evt.submittedAt?.toDate() || new Date(), 'PPpp')}</p>
                        {evt.notes && <p className="text-sm text-[#085041] bg-[#EAF3DE] p-2 rounded italic">"{evt.notes}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
});
