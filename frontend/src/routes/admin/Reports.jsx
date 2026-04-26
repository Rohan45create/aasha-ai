import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { db } from '../../firebase';
import { collection, query, where, getDocs, getDoc, doc, Timestamp } from 'firebase/firestore';

const FALLBACK_ASHA_IDS = [
  'asha_lata_001', 'asha_priya_002', 'asha_kavita_003',
  'asha_meena_004', 'asha_anita_005'
];

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function calcChange(current, previous) {
  if (previous === 0) return current > 0 ? { str: 'New', up: true } : { str: '—', up: true };
  const pct = ((current - previous) / previous * 100).toFixed(1);
  return { str: `${pct > 0 ? '+' : ''}${pct}%`, up: Number(pct) >= 0 };
}

export default function Reports() {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const { headId: storeHeadId } = useAuthStore();
  const headId = storeHeadId || localStorage.getItem('headId') || 'head_sunita_001';

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  useEffect(() => {
    const load = async () => {
      try {
        console.log('[Reports] Using headId:', headId);
        const headDoc = await getDoc(doc(db, 'asha_heads', headId));
        const ashaIds = headDoc.exists()
          ? (headDoc.data()?.ashaIds?.length > 0 ? headDoc.data().ashaIds : FALLBACK_ASHA_IDS)
          : FALLBACK_ASHA_IDS;

        const tsThis = Timestamp.fromDate(thisMonthStart);
        const tsLast = Timestamp.fromDate(lastMonthStart);
        const tsThisEnd = Timestamp.fromDate(thisMonthStart); // used as end for last month

        // Helper: count docs in a collection for given month range and ashaId filter
        const countFor = async (col, monthStart, monthEnd, extraFilters = []) => {
          let total = 0;
          const endTs = monthEnd ? Timestamp.fromDate(monthEnd) : null;
          for (const aid of ashaIds) {
            try {
              let q = query(
                collection(db, col),
                where('ashaId', '==', aid),
                where('createdAt', '>=', Timestamp.fromDate(monthStart)),
                ...(endTs ? [where('createdAt', '<', endTs)] : []),
                ...extraFilters
              );
              const snap = await getDocs(q);
              total += snap.size;
            } catch (_) {}
          }
          return total;
        };

        // Special: count by riskLevel across all ASHAs (no month filter)
        const countRiskLevel = async (level) => {
          let total = 0;
          for (const aid of ashaIds) {
            try {
              const snap = await getDocs(query(collection(db, 'children'), where('ashaId', '==', aid), where('riskLevel', '==', level)));
              total += snap.size;
            } catch (_) {}
          }
          return total;
        };

        const [
          familiesThis, familiesLast,
          ancThis, ancLast,
          childrenThis, childrenLast,
          vaccinationsThis, vaccinationsLast,
          criticalCases,
          referralsThis, referralsLast,
        ] = await Promise.all([
          countFor('households', thisMonthStart, null),
          countFor('households', lastMonthStart, thisMonthStart),
          countFor('pregnancies', thisMonthStart, null),
          countFor('pregnancies', lastMonthStart, thisMonthStart),
          countFor('children', thisMonthStart, null),
          countFor('children', lastMonthStart, thisMonthStart),
          countFor('vaccinations', thisMonthStart, null),
          countFor('vaccinations', lastMonthStart, thisMonthStart),
          countRiskLevel('CRITICAL'),
          countFor('referrals', thisMonthStart, null),
          countFor('referrals', lastMonthStart, thisMonthStart),
        ]);

        const rows = [
          { name: 'Families Surveyed', current: familiesThis, previous: familiesLast },
          { name: 'ANC Registrations', current: ancThis, previous: ancLast },
          { name: 'Children Measured', current: childrenThis, previous: childrenLast },
          { name: 'Vaccinations Recorded', current: vaccinationsThis, previous: vaccinationsLast },
          { name: 'Critical Cases (Total)', current: criticalCases, previous: 0 },
          { name: 'NRC Referrals', current: referralsThis, previous: referralsLast },
        ].map(r => ({ ...r, ...calcChange(r.current, r.previous) }));

        setMetrics(rows);
      } catch (err) {
        console.error('[Reports] Load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [headId]);

  const handleExportCSV = () => {
    const headers = ['Metric', 'This Month', 'Last Month', 'Change'];
    const rows = metrics.map(m => [m.name, m.current, m.previous, m.str]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ashaai_report_${new Date().toISOString().slice(0,7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Reports</h1>
          <p className="text-[#5F5E5A] text-sm">{monthLabel} - Monthly Summary</p>
        </div>
        <button onClick={handleExportCSV} className="bg-[#085041] text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 self-start hover:bg-[#1D9E75] transition-colors">
          <span className="material-symbols-outlined text-lg">download</span> Export CSV
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-8 text-center animate-pulse text-[#5F5E5A]">Loading report data…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-2xl shadow-sm border border-[#D3D1C7] overflow-hidden">
            <thead>
              <tr className="bg-[#085041] text-white text-sm">
                <th className="text-left px-4 py-3">Metric</th>
                <th className="text-center px-4 py-3">This Month</th>
                <th className="text-center px-4 py-3 hidden sm:table-cell">Last Month</th>
                <th className="text-center px-4 py-3">Change</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(m => (
                <tr key={m.name} className="border-t border-[#D3D1C7] hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-sm">{m.name}</td>
                  <td className="px-4 py-3 text-center font-bold">{m.current}</td>
                  <td className="px-4 py-3 text-center text-[#5F5E5A] hidden sm:table-cell">{m.previous}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-bold ${m.up ? 'text-[#1D9E75]' : 'text-[#E24B4A]'}`}>
                      {m.str}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
