import { useState } from 'react';

const METRICS = [
  { name: 'Families Surveyed', current: 124, previous: 98, change: '+26.5%', up: true },
  { name: 'ANC Registrations', current: 18, previous: 15, change: '+20.0%', up: true },
  { name: 'Children Measured', current: 67, previous: 45, change: '+48.9%', up: true },
  { name: 'Vaccinations Recorded', current: 203, previous: 178, change: '+14.0%', up: true },
  { name: 'Critical Cases', current: 7, previous: 4, change: '+75.0%', up: false },
  { name: 'NRC Referrals', current: 3, previous: 1, change: '+200.0%', up: false },
];

export default function Reports() {
  const [month] = useState(new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));

  const handleExportCSV = () => {
    const headers = ['Metric', 'This Month', 'Last Month', 'Change'];
    const rows = METRICS.map(m => [m.name, m.current, m.previous, m.change]);
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
          <p className="text-[#5F5E5A] text-sm">{month} - Monthly Summary</p>
        </div>
        <button onClick={handleExportCSV} className="bg-[#085041] text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 self-start hover:bg-[#1D9E75] transition-colors">
          <span className="material-symbols-outlined text-lg">download</span> Export CSV
        </button>
      </div>

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
            {METRICS.map(m => (
              <tr key={m.name} className="border-t border-[#D3D1C7] hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-sm">{m.name}</td>
                <td className="px-4 py-3 text-center font-bold">{m.current}</td>
                <td className="px-4 py-3 text-center text-[#5F5E5A] hidden sm:table-cell">{m.previous}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-sm font-bold ${m.up ? 'text-[#1D9E75]' : 'text-[#E24B4A]'}`}>
                    {m.change}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
