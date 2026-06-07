import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { db } from '../../firebase';
import {
  collection, query, where,
  getDoc, doc, getDocs, onSnapshot, orderBy, limit, Timestamp
} from 'firebase/firestore';
import { useTx } from '../../context/TranslationContext';
import { apiFetch } from '../../utils/api';

const FALLBACK_ASHA_IDS = [
  'asha_lata_001', 'asha_priya_002', 'asha_kavita_003',
  'asha_meena_004', 'asha_anita_005'
];

// ── Pure SVG Charts ──────────────────────────────────────────────────────────

function HorizontalBarChart({ data, title }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const COLORS = ['#1D9E75','#085041','#BA7517','#185FA5','#6A1B9A','#BF360C','#E24B4A'];
  return (
    <div>
      <h3 className="text-sm font-semibold text-[#5F5E5A] mb-3 uppercase tracking-wide">{title}</h3>
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="text-xs text-[#5F5E5A] w-28 truncate flex-shrink-0">{item.label}</span>
            <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-700"
                style={{ width: `${(item.value / max) * 100}%`, background: COLORS[i % COLORS.length] }}
              />
            </div>
            <span className="text-xs font-bold text-[#1A1A18] w-6 text-right">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ data, title }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const COLORS = { CRITICAL: '#E24B4A', HIGH: '#BA7517', MEDIUM: '#185FA5', LOW: '#1D9E75' };
  
  // SVG donut
  const size = 100;
  const cx = 50, cy = 50, r = 35, stroke = 14;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const segments = data.map(d => {
    const pct = d.value / total;
    const seg = { ...d, pct, offset, dasharray: `${pct * circ} ${circ}`, color: COLORS[d.label] || '#ccc' };
    offset += pct * circ;
    return seg;
  });

  return (
    <div>
      <h3 className="text-sm font-semibold text-[#5F5E5A] mb-3 uppercase tracking-wide">{title}</h3>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 100 100" className="w-24 h-24 flex-shrink-0">
          {total === 0 ? (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eee" strokeWidth={stroke} />
          ) : (
            segments.map((seg, i) => (
              <circle
                key={i}
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={seg.dasharray}
                strokeDashoffset={-seg.offset + circ / 4}
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
              />
            ))
          )}
          <text x={cx} y={cy} textAnchor="middle" dy=".3em" className="text-xs" fontSize="14" fontWeight="bold" fill="#1A1A18">
            {total}
          </text>
        </svg>
        <div className="space-y-1">
          {data.map(d => (
            <div key={d.label} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[d.label] || '#ccc' }} />
              <span className="text-xs text-[#5F5E5A]">{d.label}</span>
              <span className="text-xs font-bold ml-auto">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniBarChart({ data, title }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const COLORS = ['#1D9E75','#085041','#1D9E75','#085041','#1D9E75'];
  return (
    <div>
      <h3 className="text-sm font-semibold text-[#5F5E5A] mb-3 uppercase tracking-wide">{title}</h3>
      <div className="flex items-end gap-2 h-20">
        {data.map((item, i) => (
          <div key={item.label} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] font-bold text-[#1A1A18]">{item.value}</span>
            <div
              className="w-full rounded-t transition-all duration-700"
              style={{ height: `${Math.max(4, (item.value / max) * 60)}px`, background: COLORS[i % COLORS.length] }}
            />
            <span className="text-[8px] text-[#5F5E5A] truncate w-full text-center">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const tx = useTx();
  const { docId } = useAuthStore();

  const [stats, setStats] = useState({
    workerCount: 0,
    activeToday: 0,
    totalFamilies: 0,
    criticalCases: 0,
    pendingReviews: 0,
  });
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Workers table state
  const [workers, setWorkers] = useState([]);
  const [workersLoading, setWorkersLoading] = useState(true);
  const [workersError, setWorkersError] = useState('');

  // Chart data
  const [moduleChart, setModuleChart] = useState([]);
  const [riskChart, setRiskChart] = useState([]);
  const [workerActivityChart, setWorkerActivityChart] = useState([]);

  // Part C: Real-time alerts
  useEffect(() => {
    if (!docId) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', docId),
      where('isRead', '==', false),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const newAlerts = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Map to existing alert structure for UI
        type: doc.data().type || 'info',
        message: doc.data().message || doc.data().title
      }));
      setAlerts(newAlerts);
    }, (error) => {
      console.error('[Dashboard] Alerts onSnapshot error:', error);
    });

    return () => unsubscribe();
  }, [docId]);

  // Part A: Metrics cards
  useEffect(() => {
    if (!docId) return;
    let isUnmounted = false;

    const loadStats = async () => {
      try {
        setLoading(true);
        const headDoc = await getDoc(doc(db, 'asha_heads', docId));
        const ashaIds = headDoc.exists() && headDoc.data().ashaIds ? headDoc.data().ashaIds : [];

        if (ashaIds.length === 0) {
          if (!isUnmounted) setLoading(false);
          return;
        }

        // Note: Firestore 'in' queries support max 30 items. Since we have 5 ASHAs this is fine.
        
        // Critical Cases
        const criticalSnap = await getDocs(
          query(collection(db, 'children'), where('ashaId', 'in', ashaIds), where('riskLevel', '==', 'CRITICAL'))
        );
        
        // Total Families
        const familiesSnap = await getDocs(
          query(collection(db, 'households'), where('ashaId', 'in', ashaIds))
        );

        // Active Today (Fix: proper Firestore Timestamp)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayStartTs = Timestamp.fromDate(todayStart);
        
        const activeSnap = await getDocs(
          query(collection(db, 'module_submissions'), where('ashaId', 'in', ashaIds), where('submittedAt', '>=', todayStartTs))
        );
        
        const activeAshaIds = new Set();
        activeSnap.forEach(d => activeAshaIds.add(d.data().ashaId));

        // Pending reviews
        const pendingSnap = await getDocs(query(collection(db, 'pending_reviews'), where('reviewStatus', '==', 'pending')));

        // ------------------
        // CHART DATA BUILDER
        // ------------------
        
        // 1. Risk Chart (all 4 levels)
        const allChildrenSnap = await getDocs(
          query(collection(db, 'children'), where('ashaId', 'in', ashaIds))
        );
        const rCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        allChildrenSnap.forEach(d => {
          const risk = d.data().riskLevel;
          if (rCounts[risk] !== undefined) rCounts[risk]++;
        });
        
        // 2. Module & Worker Charts (fetch recent submissions)
        const allSubsSnap = await getDocs(
          query(collection(db, 'module_submissions'), where('ashaId', 'in', ashaIds))
        );
        const wCounts = {};
        const mCounts = {};
        allSubsSnap.forEach(d => {
          const data = d.data();
          const mod = data.moduleType || 'unknown';
          const asha = data.ashaId;
          wCounts[asha] = (wCounts[asha] || 0) + 1;
          mCounts[mod] = (mCounts[mod] || 0) + 1;
        });

        if (!isUnmounted) {
          setStats({
            workerCount: ashaIds.length,
            criticalCases: criticalSnap.size,
            totalFamilies: familiesSnap.size,
            activeToday: activeAshaIds.size,
            pendingReviews: pendingSnap.size
          });
          
          setRiskChart([
            { label: 'CRITICAL', value: rCounts.CRITICAL },
            { label: 'HIGH', value: rCounts.HIGH },
            { label: 'MEDIUM', value: rCounts.MEDIUM },
            { label: 'LOW', value: rCounts.LOW }
          ]);
          setWorkerActivityChart(Object.entries(wCounts).map(([k, v]) => ({ label: k, value: v })));
          setModuleChart(Object.entries(mCounts).map(([k, v]) => ({ label: k, value: v })));
          
          setLoading(false);
        }
      } catch (err) {
        console.error('[Dashboard] Stats error:', err);
        if (!isUnmounted) setLoading(false);
      }
    };

    loadStats();
    return () => { isUnmounted = true; };
  }, [docId]);

  // Part B: Workers Table Data
  useEffect(() => {
    if (!docId) return;
    let isUnmounted = false;

    const loadWorkers = async () => {
      try {
        setWorkersLoading(true);
        setWorkersError('');
        const data = await apiFetch(`/api/admin/supervisor/workers/${docId}`);
        if (!isUnmounted) {
          setWorkers(data);
          setWorkersLoading(false);
        }
      } catch (err) {
        console.error('[Dashboard] Workers fetch error:', err);
        if (!isUnmounted) {
          setWorkersError('Failed to load workers.');
          setWorkersLoading(false);
        }
      }
    };

    loadWorkers();
    return () => { isUnmounted = true; };
  }, [docId]);

  const workerActivityChartWithNames = useMemo(() => {
    if (!workerActivityChart.length || !workers.length) return workerActivityChart;
    const nameMap = {};
    workers.forEach(w => nameMap[w.id] = w.name);
    return workerActivityChart.map(item => ({
      ...item,
      label: nameMap[item.label] || item.label.slice(0, 8) + '...'
    }));
  }, [workerActivityChart, workers]);

  const cards = [
    { label: tx('ASHA Workers', 'total_workers'), value: stats.workerCount, icon: 'group', color: 'text-[#085041]', bg: 'bg-[#EAF3DE]' },
    { label: tx('Active Today'), value: stats.activeToday, icon: 'bolt', color: 'text-[#1565C0]', bg: 'bg-[#E3F2FD]' },
    { label: tx('Total Families', 'total_families'), value: stats.totalFamilies, icon: 'family_restroom', color: 'text-[#6A1B9A]', bg: 'bg-[#F3E5F5]' },
    { label: tx('Critical Cases', 'critical_cases'), value: stats.criticalCases, icon: 'warning', color: 'text-[#E24B4A]', bg: 'bg-[#FCEBEB]' },
    { label: tx('Pending Reviews', 'pending_reviews'), value: stats.pendingReviews, icon: 'pending_actions', color: 'text-[#BA7517]', bg: 'bg-[#FFF8E1]' },
  ];

  if (!docId || loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">{tx('Admin Dashboard', 'admin_dashboard')}</h1>
          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full animate-pulse">{tx('Loading data…', 'loading')}</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8 animate-pulse">
          {[...Array(5)].map((_, i) => (<div key={i} className="h-28 bg-gray-200 rounded-2xl" />))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">{tx('Admin Dashboard', 'admin_dashboard')}</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full font-mono">
          {docId}
        </span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {cards.map(c => (
          <div key={c.label} className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-[#D3D1C7]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[#5F5E5A] font-medium text-xs">{c.label}</h3>
              <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                <span className={`material-symbols-outlined text-lg ${c.color}`}>{c.icon}</span>
              </div>
            </div>
            <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Module Survey Completion */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#D3D1C7] lg:col-span-2">
          {moduleChart.length > 0 ? (
            <HorizontalBarChart data={moduleChart} title="Survey Submissions by Module" />
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-[#5F5E5A] mb-3 uppercase tracking-wide">{tx('Survey Submissions by Module')}</h3>
              <p className="text-sm text-gray-400 text-center py-4">{tx('No submissions yet')}</p>
            </div>
          )}
        </div>

        {/* Risk Distribution Donut */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#D3D1C7]">
          <DonutChart
            data={riskChart.length > 0 ? riskChart : [{ label: 'LOW', value: 0 }]}
            title="Risk Distribution"
          />
        </div>
      </div>

      {/* Worker Activity This Week */}
      {workerActivityChartWithNames.length > 0 && (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#D3D1C7] mb-8">
          <MiniBarChart data={workerActivityChartWithNames} title="Worker Activity This Week (Submissions)" />
        </div>
      )}

      {/* Workers Table */}
      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-[#D3D1C7] mb-8">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#185FA5]">group</span>
          {tx('ASHA Workers')}
        </h2>
        {workersLoading ? (
          <div className="flex justify-center p-8">
            <span className="material-symbols-outlined animate-spin text-3xl text-[#1D9E75]">refresh</span>
          </div>
        ) : workersError ? (
          <div className="p-4 bg-[#FCEBEB] text-[#791F1F] rounded-xl font-medium border border-[#E24B4A] text-sm">
            {workersError}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D3D1C7]">
                  <th className="p-3 text-sm font-semibold text-[#5F5E5A]">{tx('Name')}</th>
                  <th className="p-3 text-sm font-semibold text-[#5F5E5A]">{tx('Village')}</th>
                  <th className="p-3 text-sm font-semibold text-[#5F5E5A]">{tx('Coverage')}</th>
                  <th className="p-3 text-sm font-semibold text-[#5F5E5A]">{tx('Submissions')}</th>
                  <th className="p-3 text-sm font-semibold text-[#5F5E5A]">{tx('Status')}</th>
                </tr>
              </thead>
              <tbody>
                {workers.map(w => (
                  <tr key={w.id} className="border-b border-[#D3D1C7] last:border-0 hover:bg-gray-50">
                    <td className="p-3 text-sm font-medium text-[#1A1A18]">{w.name || w.id}</td>
                    <td className="p-3 text-sm text-[#5F5E5A]">{w.village || '-'}</td>
                    <td className="p-3 text-sm text-[#5F5E5A]">{w.coverage_percent || 0}%</td>
                    <td className="p-3 text-sm text-[#5F5E5A]">{w.submissions_this_month || 0}</td>
                    <td className="p-3 text-sm">
                      {w.isActive ? (
                        <span className="px-2 py-1 bg-[#EAF3DE] text-[#085041] rounded-lg text-xs font-bold border border-[#1D9E75]">Active</span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold border border-gray-300">Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
                {workers.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-4 text-center text-sm text-gray-500">No workers found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alerts Panel */}
      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-[#D3D1C7]">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#E24B4A]">notifications_active</span>
          {tx('System Alerts')}
        </h2>
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="p-4 bg-[#EAF3DE] text-[#085041] rounded-xl font-medium border border-[#1D9E75] text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">check_circle</span>
              {tx('All systems nominal. No critical cases.')}
            </div>
          ) : (
            alerts.map(a => {
              let config = {
                bg: 'bg-[#FCEBEB]',
                border: 'border-[#E24B4A]',
                text: 'text-[#791F1F]',
                icon: 'warning',
                iconColor: 'text-[#E24B4A]'
              };
              
              if (a.type === 'pending_referral') {
                config = { bg: 'bg-[#FFF8E1]', border: 'border-[#BA7517]', text: 'text-[#8A560B]', icon: 'pending_actions', iconColor: 'text-[#BA7517]' };
              } else if (a.type === 'rejected_referral') {
                config = { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-700', icon: 'cancel', iconColor: 'text-gray-500' };
              } else if (a.type === 'admitted_referral') {
                config = { bg: 'bg-[#EAF3DE]', border: 'border-[#1D9E75]', text: 'text-[#085041]', icon: 'local_hospital', iconColor: 'text-[#1D9E75]' };
              }

              return (
                <div key={a.id} className={`p-4 ${config.bg} ${config.text} rounded-xl font-medium border ${config.border} text-sm flex items-start gap-2`}>
                  <span className={`material-symbols-outlined text-lg flex-shrink-0 ${config.iconColor}`}>{config.icon}</span>
                  <span>{a.message}</span>
                </div>
              );
            })
          )}
          <div className="p-4 bg-gray-50 text-gray-600 rounded-xl text-sm flex items-center gap-2 border border-gray-200">
            <span className="material-symbols-outlined text-lg text-gray-400">schedule</span>
            {tx('Nightly risk engine last ran at 02:30 AM')}
          </div>
        </div>
      </div>
    </div>
  );
}
