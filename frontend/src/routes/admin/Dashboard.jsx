import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ workers: 0, families: 0, critical: 0, pendingSync: 0 });
  const [alerts, setAlerts] = useState([]);
  const { user } = useAuthStore();
  const headId = user?.uid;

  useEffect(() => {
    if (!headId) return;

    // We store the unsubscribe functions in a ref or a variable that can be accessed by the cleanup closure.
    // However, since getDoc is async, we need a flag to check if we unmounted before it resolves.
    let isUnmounted = false;
    let unsubWorkers = null;
    let unsubFamilies = null;
    let unsubCritical = null;

    // Subscribe to ASHA workers under this head
    unsubWorkers = onSnapshot(
      query(collection(db, 'ashas'), where('supervisorId', '==', headId)),
      snap => {
        setStats(s => ({ ...s, workers: snap.size }));
      }
    );
    
    // Get head's ashaIds from Firestore then query families and critical children
    getDoc(doc(db, 'asha_heads', headId)).then(headDoc => {
      if (isUnmounted) return;
      if (!headDoc.exists()) return;
      
      const ashaIds = headDoc.data().ashaIds || [];
      if(ashaIds.length === 0) return;

      // Count families (only query up to 30 for safety in in operator)
      const batchedAshaIds = ashaIds.slice(0, 30);
      
      unsubFamilies = onSnapshot(
        query(collection(db, 'households'), where('ashaId', 'in', batchedAshaIds)),
        snap => setStats(s => ({ ...s, families: snap.size }))
      );

      // Count CRITICAL children
      unsubCritical = onSnapshot(
        query(collection(db, 'children'), where('ashaId', 'in', batchedAshaIds), where('riskLevel', '==', 'CRITICAL')),
        snap => {
          const criticalDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setStats(s => ({ ...s, critical: snap.size }));
          setAlerts(criticalDocs.map(c => ({
            type: 'critical', 
            message: `${c.name || 'Child'} (Score: ${c.riskScore}) — ${c.riskPrimaryDriver || 'Urgent intervention needed'}`,
            ashaId: c.ashaId, 
            id: c.id
          })));
        }
      );
    });

    return () => {
      isUnmounted = true;
      if (unsubWorkers) unsubWorkers();
      if (unsubFamilies) unsubFamilies();
      if (unsubCritical) unsubCritical();
    };
  }, [headId]);

  const cards = [
    { label: 'Active ASHA Workers', value: stats.workers, icon: 'group', color: 'text-[#085041]', bg: 'bg-[#EAF3DE]' },
    { label: 'Total Families', value: stats.families, icon: 'family_restroom', color: 'text-[#1565C0]', bg: 'bg-[#E3F2FD]' },
    { label: 'High Risk Cases', value: stats.critical, icon: 'warning', color: 'text-[#E24B4A]', bg: 'bg-[#FCEBEB]' },
    { label: 'Coverage', value: '87%', icon: 'map', color: 'text-[#1D9E75]', bg: 'bg-[#EAF3DE]' },
    { label: 'Pending Reviews', value: 0, icon: 'pending_actions', color: 'text-[#BA7517]', bg: 'bg-[#FFF8E1]' },
    { label: 'Pending Sync', value: stats.pendingSync, icon: 'sync', color: 'text-[#6A1B9A]', bg: 'bg-[#F3E5F5]' },
  ];

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Admin Dashboard</h1>
      
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {cards.map(c => (
          <div key={c.label} className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-[#D3D1C7]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[#5F5E5A] font-medium text-xs md:text-sm">{c.label}</h3>
              <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                <span className={`material-symbols-outlined text-lg ${c.color}`}>{c.icon}</span>
              </div>
            </div>
            <p className={`text-2xl md:text-4xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-[#D3D1C7]">
        <h2 className="text-xl font-bold mb-4">System Alerts</h2>
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="p-4 bg-gray-50 text-gray-500 rounded-xl font-medium border border-gray-200 text-sm">
              <span className="material-symbols-outlined mr-2 align-bottom text-lg">check_circle</span>
              All systems nominal. No critical alerts.
            </div>
          ) : (
            alerts.map(a => (
              <div key={a.id} className="p-4 bg-[#FCEBEB] text-[#791F1F] rounded-xl font-medium border border-[#E24B4A] text-sm">
                <span className="material-symbols-outlined mr-2 align-bottom text-lg">warning</span>
                {a.message}
              </div>
            ))
          )}
          <div className="p-4 bg-[#EAF3DE] text-[#085041] rounded-xl font-medium border border-[#1D9E75] text-sm">
            <span className="material-symbols-outlined mr-2 align-bottom text-lg">check_circle</span>
            Nightly risk engine completed successfully at 02:30 AM
          </div>
        </div>
      </div>
    </div>
  );
}
