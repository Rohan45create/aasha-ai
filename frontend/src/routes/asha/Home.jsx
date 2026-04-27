import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useTx } from '../../context/TranslationContext';

export default React.memo(function Home() {
  const { t } = useTranslation();
  const tx = useTx();
  const { user, ashaId: storeAshaId } = useAuthStore();
  const [stats, setStats] = useState({ families: 0, highRisk: 0, pendingVisits: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ashaId = storeAshaId || localStorage.getItem('ashaId') || user?.uid;
    if (!ashaId) { setLoading(false); return; }
    console.log('[Home] Using ashaId:', ashaId);

    let loaded = { families: false, children: false, pregnancies: false };
    const markLoaded = (key) => {
      loaded[key] = true;
      if (Object.values(loaded).every(Boolean)) setLoading(false);
    };

    // Families — simple single-where query, no index needed
    const unsubFamilies = onSnapshot(
      query(collection(db, 'households'), where('ashaId', '==', ashaId)),
      snap => { setStats(s => ({ ...s, families: snap.size })); markLoaded('families'); },
      err => { console.warn('[Home] households error', err.code); markLoaded('families'); }
    );

    // Children — single where, filter HIGH+CRITICAL client-side
    const unsubChildren = onSnapshot(
      query(collection(db, 'children'), where('ashaId', '==', ashaId)),
      snap => {
        const highRisk = snap.docs.filter(d => ['HIGH', 'CRITICAL'].includes(d.data().riskLevel)).length;
        setStats(s => ({ ...s, highRisk }));
        markLoaded('children');
      },
      err => { console.warn('[Home] children error', err.code); markLoaded('children'); }
    );

    // Pregnancies — use as "pending visits" proxy (ANC follow-ups)
    const unsubPreg = onSnapshot(
      query(collection(db, 'pregnancies'), where('ashaId', '==', ashaId)),
      snap => { setStats(s => ({ ...s, pendingVisits: snap.size })); markLoaded('pregnancies'); },
      err => { console.warn('[Home] pregnancies error', err.code); markLoaded('pregnancies'); }
    );

    return () => { unsubFamilies(); unsubChildren(); unsubPreg(); };
  }, [storeAshaId, user]);



  const modules = [
    { title: t('family_survey'), path: '/asha/family-survey', icon: 'family_home', color: 'bg-[#EAF3DE] text-[#085041]' },
    { title: t('anc_registration'), path: '/asha/anc', icon: 'pregnant_woman', color: 'bg-[#FCEBEB] text-[#791F1F]' },
    { title: t('child_growth'), path: '/asha/child-growth', icon: 'child_care', color: 'bg-[#FFF3E0] text-[#E65100]' },
    { title: t('vaccination'), path: '/asha/vaccination', icon: 'vaccines', color: 'bg-[#E3F2FD] text-[#1565C0]' },
    { title: t('birth_record'), path: '/asha/birth-record', icon: 'crib', color: 'bg-[#E8F5E9] text-[#2E7D32]' },
    { title: t('death_record'), path: '/asha/death-record', icon: 'demography', color: 'bg-[#EFEBE9] text-[#4E342E]' },
    { title: t('disease_surveillance'), path: '/asha/disease-surveillance', icon: 'coronavirus', color: 'bg-[#F3E5F5] text-[#6A1B9A]' },
    { title: t('ncd_tracking'), path: '/asha/ncd-tracking', icon: 'monitor_heart', color: 'bg-[#FBE9E7] text-[#BF360C]' },
    { title: t('family_planning'), path: '/asha/family-planning', icon: 'diversity_3', color: 'bg-[#E1F5FE] text-[#01579B]' },
    { title: t('elderly_care'), path: '/asha/elderly-care', icon: 'elderly', color: 'bg-[#FFF8E1] text-[#F57F17]' },
    { title: t('sanitation'), path: '/asha/sanitation', icon: 'water_drop', color: 'bg-[#E0F7FA] text-[#006064]' },
    { title: t('village_health'), path: '/asha/village-health', icon: 'location_city', color: 'bg-[#F1F8E9] text-[#33691E]' },
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
            <span className="block text-2xl font-bold text-[#791F1F]">{loading ? '-' : stats.highRisk}</span>
            <span className="text-[10px] font-medium text-[#E24B4A] uppercase">{tx('High Risk')}</span>
          </div>
          <div className="bg-[#F3E5F5] p-3 rounded-xl text-center">
            <span className="block text-2xl font-bold text-[#6A1B9A]">{loading ? '-' : stats.pendingVisits}</span>
            <span className="text-[10px] font-medium text-[#AB47BC] uppercase">{tx('Visits')}</span>
          </div>
        </div>
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

      {/* Module Grid — all 12 */}
      <div className="grid grid-cols-3 gap-3">
        {modules.map(mod => (
          <Link key={mod.path} to={mod.path} className="bg-white p-3 rounded-2xl shadow-sm border border-[#D3D1C7] flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow active:scale-[0.98]">
            <div className={`w-11 h-11 rounded-full mb-2 flex items-center justify-center ${mod.color}`}>
              <span className="material-symbols-outlined text-xl">{mod.icon}</span>
            </div>
            <span className="text-[11px] font-semibold text-[#1A1A18] leading-tight">{mod.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
});
