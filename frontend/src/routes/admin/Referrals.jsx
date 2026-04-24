import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { formatDistanceToNow } from 'date-fns';

const statusColor = {
  Pending: 'bg-amber-100 text-amber-800',
  Admitted: 'bg-blue-100 text-blue-800',
  Discharged: 'bg-green-100 text-green-800',
  'Follow-up Due': 'bg-red-100 text-red-800',
};

export default function Referrals() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const { user } = useAuthStore();
  const headId = user?.uid;

  useEffect(() => {
    if (!headId) return;

    async function loadReferrals() {
      try {
        const token = await user.getIdToken();
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/supervisor/referrals/${headId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setReferrals(data);
        }
      } catch (err) {
        console.error('Error fetching referrals:', err);
      } finally {
        setLoading(false);
      }
    }

    loadReferrals();
  }, [headId, user]);

  const filtered = filter === 'All' 
    ? referrals 
    : referrals.filter(r => r.status === filter);

  const isOverdue = (r) => {
    if (r.status === 'Admitted' && r.referredDate) {
      const referredDate = new Date(r.referredDate);
      const daysSince = Math.floor((Date.now() - referredDate) / (1000 * 60 * 60 * 24));
      return daysSince > 30;
    }
    return false;
  };

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Referrals Management</h1>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['All', 'Pending', 'Admitted', 'Discharged', 'Follow-up Due'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors ${
              filter === f
                ? 'bg-[#1D9E75] text-white'
                : 'bg-white text-[#5F5E5A] border border-[#D3D1C7] hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Referrals Table */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-200 h-16 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-2xl shadow-sm border border-[#D3D1C7] overflow-hidden">
            <thead>
              <tr className="bg-[#085041] text-white text-sm">
                <th className="text-left px-4 py-3">Child Name</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">ASHA Worker</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Village</th>
                <th className="text-center px-4 py-3">Referred Date</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-center px-4 py-3">Days Since</th>
                <th className="text-center px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-[#5F5E5A]">No referrals found.</td>
                </tr>
              )}
              {filtered.map(r => {
                const overdue = isOverdue(r);
                const daysSince = r.referredDate 
                  ? Math.floor((Date.now() - new Date(r.referredDate)) / (1000 * 60 * 60 * 24))
                  : 0;
                return (
                  <tr key={r.id} className="border-t border-[#D3D1C7] hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium">{r.childName || 'Unknown'}</td>
                    <td className="px-4 py-3 text-[#5F5E5A] hidden md:table-cell">{r.ashaWorkerName || 'N/A'}</td>
                    <td className="px-4 py-3 text-[#5F5E5A] hidden lg:table-cell">{r.village || 'N/A'}</td>
                    <td className="px-4 py-3 text-center text-sm">
                      {r.referredDate ? new Date(r.referredDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusColor[r.status] || statusColor.Pending}`}>
                          {r.status || 'Pending'}
                        </span>
                        {overdue && (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-100 text-red-800">Overdue</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-bold">{daysSince}d</td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={r.status || 'Pending'}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          // Call update API
                          fetch(`${import.meta.env.VITE_API_URL}/api/admin/supervisor/referrals/${r.id}/status?status=${newStatus}`, {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${user.getIdToken()}`
                            }
                          }).catch(err => console.error(err));
                        }}
                        className="px-2 py-1 text-xs border border-[#D3D1C7] rounded-lg focus:outline-none"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Admitted">Admitted</option>
                        <option value="Discharged">Discharged</option>
                        <option value="Follow-up Due">Follow-up Due</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
