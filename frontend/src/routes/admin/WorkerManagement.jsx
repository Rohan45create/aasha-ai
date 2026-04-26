import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import {
  collection, query, where, orderBy, limit,
  getDocs, getDoc, doc
} from 'firebase/firestore';
import { auth, db } from '../../firebase';

const FALLBACK_ASHA_IDS = [
  'asha_lata_001','asha_priya_002','asha_kavita_003','asha_meena_004','asha_anita_005'
];
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

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
  const [formData, setFormData] = useState({ name: '', phone: '', village: '', district: 'Beed' });
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  const [selectedActivityWorker, setSelectedActivityWorker] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const { user, headId: storeHeadId } = useAuthStore();
  const navigate = useNavigate();
  const headId = storeHeadId || localStorage.getItem('headId') || 'head_sunita_001';

  // ── Load timeline events ──────────────────────────────────────────────────
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

  // ── Load workers from Firestore ───────────────────────────────────────────
  const loadWorkers = useCallback(async () => {
    if (!headId) return;
    setLoading(true);
    try {
      // Resolve ashaIds from head document
      const headDoc = await getDoc(doc(db, 'asha_heads', headId));
      const ashaIds = headDoc.exists()
        ? (headDoc.data()?.ashaIds || FALLBACK_ASHA_IDS)
        : FALLBACK_ASHA_IDS;

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const results = await Promise.all(
        ashaIds.map(async (aid) => {
          const workerDoc = await getDoc(doc(db, 'ashas', aid));
          if (!workerDoc.exists()) return null;

          const data = workerDoc.data();

          // Submissions this month
          let submissionsThisMonth = 0;
          try {
            const subsSnap = await getDocs(query(
              collection(db, 'module_submissions'),
              where('ashaId', '==', aid),
              where('submittedAt', '>=', monthStart)
            ));
            submissionsThisMonth = subsSnap.size;
          } catch (_) { /* composite index may not exist yet */ }

          // Critical children
          let criticalCases = 0;
          try {
            const critsSnap = await getDocs(query(
              collection(db, 'children'),
              where('ashaId', '==', aid),
              where('riskLevel', '==', 'CRITICAL')
            ));
            criticalCases = critsSnap.size;
          } catch (_) { /* composite index may not exist yet */ }

          // Last active submission
          let lastActive = null;
          try {
            const lastSnap = await getDocs(query(
              collection(db, 'module_submissions'),
              where('ashaId', '==', aid),
              orderBy('submittedAt', 'desc'),
              limit(1)
            ));
            if (!lastSnap.empty) {
              const ts = lastSnap.docs[0].data().submittedAt;
              lastActive = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
            }
          } catch (_) { /* index may be missing */ }

          return {
            id: aid,
            name: data.name || aid,
            village: data.village || '—',
            phone: data.phone || '—',
            district: data.district || 'Beed',
            isActive: data.isActive !== false,
            coveragePercent: data.coveragePercent || 0,
            totalFamilies: data.totalFamilies || 0,
            submissionsThisMonth,
            criticalCases,
            lastActive,
          };
        })
      );

      setWorkers(results.filter(Boolean));
    } catch (err) {
      console.error('Error loading workers from Firestore:', err);
    } finally {
      setLoading(false);
    }
  }, [headId]);

  useEffect(() => { loadWorkers(); }, [loadWorkers]);

  // ── Add worker via backend API ────────────────────────────────────────────
  const handleAddWorker = async () => {
    if (!formData.name || !formData.phone || !formData.village || !formData.district) {
      setAddError('Please fill all fields');
      return;
    }
    setSubmitting(true);
    setAddError('');
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not logged in');
      const token = await currentUser.getIdToken(true);

      const res = await fetch(`${BACKEND_URL}/api/admin/supervisor/workers/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          village: formData.village.trim(),
          district: formData.district.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add worker');

      alert(`✓ ${data.name} added successfully`);
      setFormData({ name: '', phone: '', village: '', district: 'Beed' });
      setShowAddPanel(false);
      loadWorkers(); // Refresh from Firestore
    } catch (err) {
      console.error('Error adding worker:', err);
      setAddError(err.message);
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
          onClick={() => { setShowAddPanel(true); setAddError(''); }}
          className="bg-[#1D9E75] text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 self-start hover:bg-[#085041] transition-colors"
        >
          <span className="material-symbols-outlined text-lg">person_add</span> Add Worker
        </button>
      </div>

      {/* Add Worker Slide-in Panel */}
      {showAddPanel && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddPanel(false)} />
          <div className="absolute right-0 top-0 h-full w-full sm:w-96 bg-white shadow-2xl">
            <div className="p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Add ASHA Worker</h2>
                <button onClick={() => setShowAddPanel(false)} className="text-[#5F5E5A] hover:bg-gray-100 p-2 rounded-lg">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto">
                {addError && (
                  <div className="bg-[#FCEBEB] text-[#791F1F] p-3 rounded-xl border border-[#E24B4A] text-sm">
                    {addError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-2">Full Name *</label>
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#5F5E5A]">+91</span>
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
                    <option value="Beed">Beed</option>
                    <option value="Parbhani">Parbhani</option>
                    <option value="Aurangabad">Aurangabad</option>
                    <option value="Latur">Latur</option>
                    <option value="Nanded">Nanded</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleAddWorker}
                disabled={submitting}
                className="w-full mt-6 bg-[#1D9E75] text-white py-3 rounded-xl font-medium hover:bg-[#085041] transition-colors disabled:opacity-50"
              >
                {submitting ? 'Creating Account...' : 'Create Account'}
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
                <td colSpan="8" className="px-4 py-8 text-center text-[#5F5E5A]">No workers found for this head account.</td>
              </tr>
            )}
            {workers.map(w => (
              <tr
                key={w.id}
                className="border-t border-[#D3D1C7] hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/admin/worker/${w.id}`)}
              >
                <td className="px-4 py-3 font-medium">
                  <div>{w.name}</div>
                  {w.criticalCases > 0 && (
                    <span className="text-[10px] bg-[#FCEBEB] text-[#E24B4A] px-1 rounded font-bold">
                      {w.criticalCases} critical
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#5F5E5A] hidden md:table-cell">{w.village}</td>
                <td className="px-4 py-3 text-[#5F5E5A] hidden lg:table-cell">{w.phone}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${w.isActive ? 'bg-[#EAF3DE] text-[#085041]' : 'bg-gray-100 text-gray-500'}`}>
                    {w.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-sm text-[#5F5E5A] hidden lg:table-cell">
                  {w.lastActive ? formatDistanceToNow(w.lastActive, { addSuffix: true }) : 'Never'}
                </td>
                <td className="px-4 py-3 text-center font-bold">{w.submissionsThisMonth}</td>
                <td className="px-4 py-3 text-center hidden lg:table-cell">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#1D9E75] rounded-full" style={{width: `${w.coveragePercent}%`}} />
                    </div>
                    <span className="text-xs font-medium">{w.coveragePercent}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { setSelectedActivityWorker(w); setShowTimeline(true); }}
                      className="text-[#1D9E75] hover:bg-[#EAF3DE] p-2 rounded-lg"
                      title="View Activity"
                    >
                      <span className="material-symbols-outlined text-lg">history</span>
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
              <button onClick={() => setShowTimeline(false)} className="text-[#5F5E5A] hover:bg-gray-200 p-2 rounded-lg">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {timelineLoading ? (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined animate-spin text-4xl text-[#1D9E75]">refresh</span>
                </div>
              ) : timelineEvents.length === 0 ? (
                <p className="text-center text-[#5F5E5A]">No recent activity found.</p>
              ) : (
                <div className="relative border-l-2 border-[#EAF3DE] ml-4 space-y-6">
                  {timelineEvents.map((evt, idx) => (
                    <div key={idx} className="relative pl-6">
                      <span className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-[#1D9E75] border-4 border-white shadow-sm"></span>
                      <div className="bg-gray-50 rounded-xl p-4 shadow-sm border border-[#D3D1C7]">
                        <p className="font-bold text-[#1A1A18] capitalize">{(evt.moduleType || '').replace('_', ' ')}</p>
                        <p className="text-xs text-[#5F5E5A] mb-2">
                          {evt.submittedAt?.toDate ? format(evt.submittedAt.toDate(), 'PPpp') : '—'}
                        </p>
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
