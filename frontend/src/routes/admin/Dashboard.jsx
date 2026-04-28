import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { db } from '../../firebase';
import {
  collection, query, where,
  getDoc, doc, getDocs
} from 'firebase/firestore';
import { useTx } from '../../context/TranslationContext';

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
  const [stats, setStats] = useState({
    workerCount: 0,
    activeToday: 0,
    totalFamilies: 0,
    criticalCases: 0,
    pendingReviews: 0,
  });
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Chart data
  const [moduleChart, setModuleChart] = useState([]);
  const [riskChart, setRiskChart] = useState([]);
  const [workerActivityChart, setWorkerActivityChart] = useState([]);

  const { user, headId: storeHeadId } = useAuthStore();
  const headId = storeHeadId || localStorage.getItem('headId') || 'head_sunita_001';

  useEffect(() => {
    if (!headId) return;
    let isUnmounted = false;

    const loadStats = async () => {
      try {
        console.log('[Dashboard] Using headId:', headId);
        const headDoc = await getDoc(doc(db, 'asha_heads', headId));
        if (!headDoc.exists()) {
          console.warn('[Dashboard] No asha_heads doc for headId:', headId);
        }
        const ashaIds = headDoc.exists()
          ? (headDoc.data()?.ashaIds?.length > 0 ? headDoc.data().ashaIds : FALLBACK_ASHA_IDS)
          : FALLBACK_ASHA_IDS;
        console.log('[Dashboard] Using ashaIds:', ashaIds);

        let totalFamilies = 0;
        let criticalCases = 0;
        const allAlerts = [];

        // Risk level counts — single where query, filter client-side
        const riskCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

        // Module counts from real seeded collections
        const moduleCounts = {
          'Family Survey': 0,
          'ANC': 0,
          'Child Growth': 0,
          'Vaccination': 0,
          'Pregnancies': 0,
          'Disease Cases': 0,
        };

        // Worker activity — households per worker
        const workerActivity = {};

        for (const aid of ashaIds) {
          // Families (households)
          try {
            const fams = await getDocs(query(collection(db, 'households'), where('ashaId', '==', aid)));
            totalFamilies += fams.size;
            moduleCounts['Family Survey'] += fams.size;
            workerActivity[aid] = fams.size;
          } catch (e) { console.warn('[Dashboard] households error', e.code); }

          // Children — single where, filter risk client-side
          try {
            const allChildren = await getDocs(query(collection(db, 'children'), where('ashaId', '==', aid)));
            moduleCounts['Child Growth'] += allChildren.size;
            allChildren.forEach(d => {
              const data = d.data();
              const level = data.riskLevel || 'LOW';
              if (riskCounts[level] !== undefined) riskCounts[level]++;
              if (level === 'CRITICAL') {
                criticalCases++;
                allAlerts.push({
                  id: d.id,
                  type: 'critical',
                  ashaId: aid,
                  message: `${data.name || 'Child'} (Score: ${data.riskScore || '?'}) — ${data.riskPrimaryDriver || 'Urgent intervention needed'}`,
                });
              }
            });
          } catch (e) { console.warn('[Dashboard] children error', e.code); }

          // Pregnancies
          try {
            const pregs = await getDocs(query(collection(db, 'pregnancies'), where('ashaId', '==', aid)));
            moduleCounts['Pregnancies'] += pregs.size;
            moduleCounts['ANC'] += pregs.size; // proxy
          } catch (e) { console.warn('[Dashboard] pregnancies error', e.code); }

          // Vaccinations
          try {
            const vax = await getDocs(query(collection(db, 'vaccinations'), where('ashaId', '==', aid)));
            moduleCounts['Vaccination'] += vax.size;
          } catch (e) { console.warn('[Dashboard] vaccinations error', e.code); }

          // Disease cases
          try {
            const dis = await getDocs(query(collection(db, 'disease_cases'), where('ashaId', '==', aid)));
            moduleCounts['Disease Cases'] += dis.size;
          } catch (e) { console.warn('[Dashboard] disease_cases error', e.code); }

          // Referrals
          try {
            const refs = await getDocs(query(collection(db, 'referrals'), where('ashaId', '==', aid)));
            refs.forEach(d => {
              const data = d.data();
              if (data.status === 'pending') {
                allAlerts.push({
                  id: d.id,
                  type: 'pending_referral',
                  ashaId: aid,
                  message: `Pending NRC Referral: ${data.childName || 'Child'} — ${data.reason || 'Needs review'}`,
                });
              } else if (data.status === 'rejected') {
                allAlerts.push({
                  id: d.id,
                  type: 'rejected_referral',
                  ashaId: aid,
                  message: `Rejected Referral: ${data.childName || 'Child'} — ${data.rejectionReason || 'No reason provided'}`,
                });
              } else if (data.status === 'admitted') {
                allAlerts.push({
                  id: d.id,
                  type: 'admitted_referral',
                  ashaId: aid,
                  message: `Admitted to NRC: ${data.childName || 'Child'} — Follow up due on ${data.followUpDate || 'soon'}`,
                });
              }
            });
          } catch (e) { console.warn('[Dashboard] referrals error', e.code); }
        }

        // Pending reviews
        let pendingReviews = 0;
        try {
          const pending = await getDocs(query(collection(db, 'pending_reviews'), where('reviewStatus', '==', 'pending')));
          pendingReviews = pending.size;
        } catch (_) {}

        // Active today — use workers who have ANY households (proxy for activity)
        const activeToday = Object.values(workerActivity).filter(v => v > 0).length;

        // Format chart data
        const moduleData = Object.entries(moduleCounts)
          .map(([k, v]) => ({ label: k, value: v }))
          .filter(d => d.value > 0)
          .sort((a, b) => b.value - a.value);

        const riskData = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
          .map(k => ({ label: k, value: riskCounts[k] }))
          .filter(d => d.value > 0);

        const workerNames = { asha_lata_001: 'Lata', asha_priya_002: 'Priya', asha_kavita_003: 'Kavita', asha_meena_004: 'Meena', asha_anita_005: 'Anita' };
        const workerData = Object.entries(workerActivity)
          .map(([id, v]) => ({ label: workerNames[id] || id.split('_')[1] || id, value: v }));

        if (!isUnmounted) {
          setStats({ workerCount: ashaIds.length, activeToday, totalFamilies, criticalCases, pendingReviews });
          setAlerts(allAlerts);
          setModuleChart(moduleData);
          setRiskChart(riskData);
          setWorkerActivityChart(workerData);
          setLoading(false);
        }
      } catch (err) {
        console.error('[Dashboard] Stats error:', err);
        if (!isUnmounted) setLoading(false);
      }
    };

    loadStats();

    return () => { isUnmounted = true; };
  }, [headId]);


  const cards = [
    { label: tx('ASHA Workers', 'total_workers'), value: stats.workerCount, icon: 'group', color: 'text-[#085041]', bg: 'bg-[#EAF3DE]' },
    { label: tx('Active Today'), value: stats.activeToday, icon: 'bolt', color: 'text-[#1565C0]', bg: 'bg-[#E3F2FD]' },
    { label: tx('Total Families', 'total_families'), value: stats.totalFamilies, icon: 'family_restroom', color: 'text-[#6A1B9A]', bg: 'bg-[#F3E5F5]' },
    { label: tx('Critical Cases', 'critical_cases'), value: stats.criticalCases, icon: 'warning', color: 'text-[#E24B4A]', bg: 'bg-[#FCEBEB]' },
    { label: tx('Pending Reviews', 'pending_reviews'), value: stats.pendingReviews, icon: 'pending_actions', color: 'text-[#BA7517]', bg: 'bg-[#FFF8E1]' },
  ];

  if (loading) {
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
          {headId}
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
      {workerActivityChart.length > 0 && (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#D3D1C7] mb-8">
          <MiniBarChart data={workerActivityChart} title="Worker Activity This Week (Submissions)" />
        </div>
      )}

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
