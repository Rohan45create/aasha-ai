import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { format, subDays, startOfDay, isSameDay, isSameMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function WorkerActivity() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState([]);
  
  // KPIs
  const [todayCount, setTodayCount] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [performanceScore, setPerformanceScore] = useState(0);
  
  // Chart Data
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Fetch worker profile
        const workerDoc = await getDoc(doc(db, 'ashas', id));
        if (workerDoc.exists()) {
          setWorker(workerDoc.data());
        } else {
          setWorker({ name: id, village: 'Unknown', phone: 'Unknown' });
        }

        const collectionsToFetch = [
          'households',
          'household_members',
          'birth_records',
          'children',
          'vaccinations',
          'pregnancies',
          'anc',
          'disease_cases',
          'ncd_records',
          'death_records',
          'family_planning',
          'elderly_care',
          'village_health',
          'referrals'
        ];

        let allSubs = [];

        await Promise.all(collectionsToFetch.map(async (collName) => {
          try {
            const q = query(collection(db, collName), where('ashaId', '==', id));
            const snap = await getDocs(q);
            snap.docs.forEach(d => {
              const data = d.data();
              if (data.ashaId === id) {
                // Determine the best timestamp available
                let dateObj = new Date();
                const rawDate = data.createdAt || data.submittedAt || data.surveyDate || data.visitDate || data.dateOfDeath;
                if (rawDate) {
                  if (rawDate.toDate) {
                    dateObj = rawDate.toDate();
                  } else {
                    dateObj = new Date(rawDate);
                  }
                }

                allSubs.push({
                  id: `${collName}_${d.id}`,
                  ashaId: data.ashaId,
                  moduleType: collName.replace(/_/g, ' '),
                  submittedAt: dateObj,
                  source: data.source || 'database',
                  notes: data.notes || `Recorded in ${collName.replace(/_/g, ' ')}`
                });
              }
            });
          } catch (e) {
            console.warn(`Could not fetch from ${collName}:`, e);
          }
        }));

        // Sort descending by calculated date client-side
        allSubs.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());

        setSubmissions(allSubs);

        const now = new Date();
        const startOfToday = startOfDay(now);
        
        let tCount = 0;
        let mCount = 0;
        
        allSubs.forEach(sub => {
          const date = sub.submittedAt;
          if (isSameDay(date, now)) tCount++;
          if (isSameMonth(date, now)) mCount++;
        });

        setTodayCount(tCount);
        setMonthCount(mCount);
        setTotalCount(allSubs.length);

        // Chart Data (Last 7 Days)
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const d = subDays(now, i);
          const count = allSubs.filter(sub => isSameDay(sub.submittedAt, d)).length;
          
          last7Days.push({
            name: format(d, 'EEE'), // Mon, Tue, Wed...
            surveys: count
          });
        }
        setChartData(last7Days);

        // Advanced Performance Score Calculation based on actual activity logic
        let score = 0;
        
        // Baseline for having any history
        if (allSubs.length > 0) score += 20;
        
        // Points for recent activity
        if (mCount > 0) score += 20;
        if (mCount > 10) score += 10;
        
        if (tCount > 0) score += 15;
        
        // Consistency points: active days in the last 7 days (up to 35 points)
        const activeDays = last7Days.filter(day => day.surveys > 0).length;
        score += (activeDays * 5);
        
        // Ensure score is between 0 and 100
        if (score > 100) score = 100;
        if (allSubs.length === 0) score = 0; // 0 if completely inactive
        
        setPerformanceScore(score);

      } catch (err) {
        console.error('Error loading worker activity:', err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadData();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="p-4 md:p-8 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 rounded-xl mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-white rounded-2xl shadow-sm border border-[#D3D1C7]"></div>)}
        </div>
        <div className="h-96 bg-white rounded-2xl shadow-sm border border-[#D3D1C7] mb-8"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate('/admin/workers')}
          className="p-2 hover:bg-gray-200 rounded-xl transition-colors text-[#5F5E5A]"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{worker?.name || id}</h1>
          <p className="text-[#5F5E5A] text-sm">Village: {worker?.village} • Phone: {worker?.phone}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D3D1C7] flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-[#1D9E75] bg-[#EAF3DE] p-2 rounded-lg">today</span>
            <h3 className="text-[#5F5E5A] font-medium">Today</h3>
          </div>
          <p className="text-3xl font-bold">{todayCount}</p>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D3D1C7] flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-[#1D9E75] bg-[#EAF3DE] p-2 rounded-lg">calendar_month</span>
            <h3 className="text-[#5F5E5A] font-medium">This Month</h3>
          </div>
          <p className="text-3xl font-bold">{monthCount}</p>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D3D1C7] flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-[#1D9E75] bg-[#EAF3DE] p-2 rounded-lg">summarize</span>
            <h3 className="text-[#5F5E5A] font-medium">Total Surveys</h3>
          </div>
          <p className="text-3xl font-bold">{totalCount}</p>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D3D1C7] flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-[#1D9E75] bg-[#EAF3DE] p-2 rounded-lg">speed</span>
            <h3 className="text-[#5F5E5A] font-medium">Performance</h3>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold text-[#085041]">{performanceScore}</p>
            <span className="text-sm text-[#5F5E5A] mb-1">/ 100</span>
          </div>
        </div>
      </div>

      {/* Charts & Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-[#D3D1C7]">
          <h2 className="text-xl font-bold mb-6">Activity Last 7 Days</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#5F5E5A', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#5F5E5A', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#F3F4F6'}}
                  contentStyle={{borderRadius: '12px', border: '1px solid #D3D1C7', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                />
                <Bar dataKey="surveys" fill="#1D9E75" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column: Recent Activity */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D3D1C7] flex flex-col">
          <h2 className="text-xl font-bold mb-6">Recent Submissions</h2>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[400px]">
            {submissions.length === 0 ? (
              <p className="text-[#5F5E5A] text-center mt-10">No recent activity.</p>
            ) : (
              submissions.slice(0, 15).map(sub => (
                <div key={sub.id} className="border-l-2 border-[#1D9E75] pl-4 py-1">
                  <p className="font-bold text-[#1A1A18] capitalize text-sm">{(sub.moduleType || '').replace('_', ' ')}</p>
                  <p className="text-xs text-[#5F5E5A]">
                    {sub.submittedAt?.toDate ? format(sub.submittedAt.toDate(), 'PPpp') : '—'}
                  </p>
                  {sub.notes && <p className="text-xs text-[#085041] mt-1 italic">"{sub.notes}"</p>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
