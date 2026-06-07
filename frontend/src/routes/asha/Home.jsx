import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useSyncStore } from '../../stores/syncStore';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useTx } from '../../context/TranslationContext';
import { apiFetch } from '../../utils/api';

export default React.memo(function Home() {
  const { t } = useTranslation();
  const tx = useTx();
  const { user, docId } = useAuthStore();
  const pendingSyncs = useSyncStore(state => state.pendingCount || 0);

  const [stats, setStats] = useState({ families: 0, criticalCases: 0 });
  const [loading, setLoading] = useState(true);

  const [priorityList, setPriorityList] = useState([]);
  const [priorityLoading, setPriorityLoading] = useState(true);
  const [priorityError, setPriorityError] = useState('');

  useEffect(() => {
    if (!docId) { setLoading(false); return; }
    console.log('[Home] Using docId:', docId);

    let loaded = { families: false, children: false };
    const markLoaded = (key) => {
      loaded[key] = true;
      if (Object.values(loaded).every(Boolean)) setLoading(false);
    };

    // Families — single-where query
    const unsubFamilies = onSnapshot(
      query(collection(db, 'households'), where('ashaId', '==', docId)),
      snap => { setStats(s => ({ ...s, families: snap.size })); markLoaded('families'); },
      err => { console.warn('[Home] households error', err.code); markLoaded('families'); }
    );

    // Children — Critical Cases
    const unsubChildren = onSnapshot(
      query(collection(db, 'children'), where('ashaId', '==', docId), where('riskLevel', '==', 'CRITICAL')),
      snap => {
        setStats(s => ({ ...s, criticalCases: snap.size }));
        markLoaded('children');
      },
      err => { console.warn('[Home] children error', err.code); markLoaded('children'); }
    );

    return () => { unsubFamilies(); unsubChildren(); };
  }, [docId]);

  useEffect(() => {
    if (!docId) return;
    let isUnmounted = false;
    
    const loadPriority = async () => {
      try {
        setPriorityLoading(true);
        setPriorityError('');
        const data = await apiFetch(`/api/risk/priority/${docId}`);
        if (!isUnmounted) {
          // Show top 5
          setPriorityList(data.slice(0, 5));
          setPriorityLoading(false);
        }
      } catch (err) {
        if (!isUnmounted) {
          setPriorityError('Could not load priority list.');
          setPriorityLoading(false);
        }
      }
    };
    
    loadPriority();
    return () => { isUnmounted = true; };
  }, [docId]);

  const modules = [
    { title: t('family_survey'), path: '/asha/family-survey', icon: 'family_home', color: 'bg-[#EAF3DE] text-[#085041]', available: true },
    { title: t('anc_registration'), path: '/asha/anc', icon: 'pregnant_woman', color: 'bg-[#FCEBEB] text-[#791F1F]', available: true },
    { title: t('child_growth'), path: '/asha/child-growth', icon: 'child_care', color: 'bg-[#FFF3E0] text-[#E65100]', available: true },
    { title: t('vaccination'), path: '/asha/vaccination', icon: 'vaccines', color: 'bg-[#E3F2FD] text-[#1565C0]', available: true },
    { title: t('birth_record'), path: '/asha/birth-record', icon: 'crib', color: 'bg-[#E8F5E9] text-[#2E7D32]', available: true },
    { title: t('death_record'), path: '/asha/death-record', icon: 'demography', color: 'bg-[#EFEBE9] text-[#4E342E]', available: true },
    { title: t('disease_surveillance'), path: '/asha/disease-surveillance', icon: 'coronavirus', color: 'bg-[#F3E5F5] text-[#6A1B9A]', available: true },
    { title: t('ncd_tracking'), path: '/asha/ncd-tracking', icon: 'monitor_heart', color: 'bg-[#FBE9E7] text-[#BF360C]', available: true },
    { title: t('family_planning'), path: '/asha/family-planning', icon: 'diversity_3', color: 'bg-[#E1F5FE] text-[#01579B]', available: true },
    { title: t('elderly_care'), path: '/asha/elderly-care', icon: 'elderly', color: 'bg-[#FFF8E1] text-[#F57F17]', available: true },
    { title: t('sanitation'), path: '/asha/sanitation', icon: 'water_drop', color: 'bg-[#E0F7FA] text-[#006064]', available: true },
    { title: t('village_health'), path: '/asha/village-health', icon: 'location_city', color: 'bg-[#F1F8E9] text-[#33691E]', available: true },
  ];

  return (
    <div className="space-y-5">
      {/* Greeting + Stats Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#D3D1C7]">
        <h2 className="text-xl font-bold text-[#1A1A18] mb-1">
          {'\u0928\u092E\u0938\u094D\u0915\u093E\u0930'}, {user?.displayName || 'ASHA'}!
        </h2>
        <p className="text-[#5F5E5A] text-sm">{tx('Today is a good day to make a difference.')}</p>
        
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-[#EAF3DE] p-3 rounded-xl text-center">
            <span className="block text-2xl font-bold text-[#085041]">{loading ? '-' : stats.families}</span>
            <span className="text-[10px] font-medium text-[#1D9E75] uppercase">{tx('Families')}</span>
          </div>
          <div className="bg-[#FCEBEB] p-3 rounded-xl text-center">
            <span className="block text-2xl font-bold text-[#791F1F]">{loading ? '-' : stats.criticalCases}</span>
            <span className="text-[10px] font-medium text-[#E24B4A] uppercase">{tx('Critical Cases')}</span>
          </div>
          <div className="bg-[#F3E5F5] p-3 rounded-xl text-center">
            <span className="block text-2xl font-bold text-[#6A1B9A]">{pendingSyncs}</span>
            <span className="text-[10px] font-medium text-[#AB47BC] uppercase">{tx('Pending Syncs')}</span>
          </div>
        </div>
      </div>

      {/* Priority List */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#D3D1C7]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#1A1A18] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#E24B4A]">priority_high</span>
            {tx('Priority List')}
          </h2>
          <Link to="/asha/priority-list" className="text-sm font-medium text-[#1D9E75] hover:underline">
            {tx('View All')}
          </Link>
        </div>
        
        {priorityLoading ? (
          <div className="flex justify-center py-6">
            <span className="material-symbols-outlined animate-spin text-3xl text-[#1D9E75]">refresh</span>
          </div>
        ) : priorityError ? (
          <div className="p-4 bg-[#FCEBEB] text-[#791F1F] rounded-xl font-medium border border-[#E24B4A] text-sm text-center">
            {priorityError}
          </div>
        ) : priorityList.length === 0 ? (
          <div className="p-4 bg-gray-50 text-gray-500 rounded-xl text-center text-sm">
            {tx('No priority cases right now.')}
          </div>
        ) : (
          <div className="space-y-3">
            {priorityList.map((item, idx) => {
              const bg = item.risk_level === 'CRITICAL' ? 'bg-[#E24B4A]' : item.risk_level === 'HIGH' ? 'bg-[#BA7517]' : 'bg-[#1D9E75]';
              return (
                <div key={item.id || idx} className="flex items-center justify-between p-3 border border-[#D3D1C7] rounded-xl">
                  <div>
                    <h3 className="font-bold text-[#1A1A18] text-sm">{item.name}</h3>
                    <p className="text-xs text-[#5F5E5A] mt-0.5">{item.primary_driver}</p>
                    <p className="text-[10px] text-gray-400 mt-1">Last visit: {item.last_visit_date || 'N/A'}</p>
                  </div>
                  <span className={`${bg} text-white text-[10px] font-bold px-2 py-1 rounded-md`}>
                    {item.risk_level}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Register Scan Banner */}
      <Link to="/asha/register-scan" className="block bg-gradient-to-r from-[#085041] to-[#1D9E75] text-white p-4 rounded-2xl shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">{t('import_register')}</h3>
            <p className="text-xs opacity-90 mt-1">{tx('Scan handwritten logs using Vision AI')}</p>
          </div>
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined">document_scanner</span>
          </div>
        </div>
      </Link>

      {/* Module Grid */}
      <div className="grid grid-cols-3 gap-3">
        {modules.map(mod => {
          if (!mod.available) {
            return (
              <div key={mod.path} className="bg-gray-100 p-3 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center opacity-60 cursor-not-allowed">
                <div className={`w-11 h-11 rounded-full mb-2 flex items-center justify-center bg-gray-200 text-gray-400`}>
                  <span className="material-symbols-outlined text-xl">{mod.icon}</span>
                </div>
                <span className="text-[11px] font-semibold text-gray-500 leading-tight">{mod.title}</span>
                <span className="text-[8px] text-gray-400 mt-1 uppercase font-bold">Coming Soon</span>
              </div>
            );
          }
          return (
            <Link key={mod.path} to={mod.path} className="bg-white p-3 rounded-2xl shadow-sm border border-[#D3D1C7] flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow active:scale-[0.98]">
              <div className={`w-11 h-11 rounded-full mb-2 flex items-center justify-center ${mod.color}`}>
                <span className="material-symbols-outlined text-xl">{mod.icon}</span>
              </div>
              <span className="text-[11px] font-semibold text-[#1A1A18] leading-tight">{mod.title}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
});
