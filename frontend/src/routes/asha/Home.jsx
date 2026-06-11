import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useSyncStore } from '../../stores/syncStore';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, orderBy, limit, Timestamp, getDoc, doc } from 'firebase/firestore';
import { useTx } from '../../context/TranslationContext';
import { apiFetch, showToast } from '../../utils/api';
import { subscribeToSurveyTemplates } from '../../utils/firestore';
import AppointmentSheet from '../../components/AppointmentSheet';
import { useLanguageStore } from '../../stores/languageStore';
import { 
  Home as HouseIcon, User, Baby, Syringe, Heart, Stethoscope, ClipboardList, Microscope,
  Eye, Hand, Pill, Bandage, Users, MapPin, Droplet, Shield, LineChart, Leaf
} from 'lucide-react';

const SURVEY_ICON_MAP = {
  house: <HouseIcon className="w-6 h-6" />,
  person: <User className="w-6 h-6" />,
  baby: <Baby className="w-6 h-6" />,
  syringe: <Syringe className="w-6 h-6" />,
  heart: <Heart className="w-6 h-6" />,
  stethoscope: <Stethoscope className="w-6 h-6" />,
  clipboard: <ClipboardList className="w-6 h-6" />,
  microscope: <Microscope className="w-6 h-6" />,
  eye: <Eye className="w-6 h-6" />,
  hand: <Hand className="w-6 h-6" />,
  pill: <Pill className="w-6 h-6" />,
  bandage: <Bandage className="w-6 h-6" />,
  pregnant: <User className="w-6 h-6" />,
  elderly: <User className="w-6 h-6" />,
  family: <Users className="w-6 h-6" />,
  village: <MapPin className="w-6 h-6" />,
  water: <Droplet className="w-6 h-6" />,
  shield: <Shield className="w-6 h-6" />,
  chart: <LineChart className="w-6 h-6" />,
  leaf: <Leaf className="w-6 h-6" />
};

export default React.memo(function Home() {
  const { t } = useTranslation();
  const tx = useTx();
  const { user, docId } = useAuthStore();
  const pendingSyncs = useSyncStore(state => state.pendingCount || 0);
  const { language } = useLanguageStore();
  const navigate = useNavigate();

  const [stats, setStats] = useState({ families: 0, criticalCases: 0 });
  const [loading, setLoading] = useState(true);

  const [priorityLoading, setPriorityLoading] = useState(true);
  const [priorityError, setPriorityError] = useState('');
  const [priorityList, setPriorityList] = useState([]);

  const [customSurveys, setCustomSurveys] = useState([]);

  const [activityStats, setActivityStats] = useState({
    familiesToday: 0, surveysToday: 0, childrenToday: 0,
    familiesMonth: 0, surveysMonth: 0,
  });
  const [recentSurveys, setRecentSurveys] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);

  const [upcomingVisits, setUpcomingVisits] = useState([]);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [sheetData, setSheetData] = useState({ isOpen: false, targetType: '', targetId: '', targetName: '' });

  const [activeFilter, setActiveFilter] = useState(null);

  const filteredSubmissions = useMemo(() => {
    if (!activeFilter) return [];
    const now = new Date();
    const todayStart = new Date(now.setHours(0,0,0,0));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return recentSurveys.filter(sub => {
      const subDate = sub.submittedAt?.toDate?.() || new Date(sub.submittedAt);
      if (activeFilter.includes('today')) return subDate >= todayStart;
      if (activeFilter.includes('month')) return subDate >= monthStart;
      return true;
    }).filter(sub => {
      if (activeFilter.includes('families')) return sub.moduleType === 'family_survey';
      if (activeFilter.includes('children')) return sub.moduleType === 'child_growth' || sub.moduleType === 'vaccination';
      return true;
    });
  }, [activeFilter, recentSurveys]);

  // Load activity stats and recent surveys
  useEffect(() => {
    if (!docId) return;

    const todayStart = Timestamp.fromDate(new Date(new Date().setHours(0,0,0,0)));
    const monthStart = Timestamp.fromDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

    // Listen to all submissions this month for stats
    const qStats = query(
      collection(db, 'module_submissions'),
      where('ashaId', '==', docId),
      where('submittedAt', '>=', monthStart)
    );

    const unsubStats = onSnapshot(qStats, (snap) => {
      let fToday=0, sToday=0, cToday=0;
      let fMonth=0, sMonth=0;

      snap.forEach(docSnap => {
        const data = docSnap.data();
        sMonth++;
        if (data.moduleType === 'family_survey') fMonth++;

        if (data.submittedAt && data.submittedAt.toMillis() >= todayStart.toMillis()) {
          sToday++;
          if (data.moduleType === 'family_survey') fToday++;
          if (data.moduleType === 'child_growth' || data.moduleType === 'vaccination') cToday++;
        }
      });

      setActivityStats({
        familiesToday: fToday, surveysToday: sToday, childrenToday: cToday,
        familiesMonth: fMonth, surveysMonth: sMonth
      });
      setActivityLoading(false);
    });

    // Listen to recent 10 surveys
    const qRecent = query(
      collection(db, 'module_submissions'),
      where('ashaId', '==', docId),
      orderBy('submittedAt', 'desc'),
      limit(10)
    );

    const unsubRecent = onSnapshot(qRecent, async (snap) => {
      const promises = snap.docs.map(async d => {
        const sub = { id: d.id, ...d.data() };
        if (sub.householdId) {
          try {
            const hdoc = await getDoc(doc(db, 'households', sub.householdId));
            if (hdoc.exists()) sub.familyName = hdoc.data().familyHeadName;
          } catch(e) {}
        }
        return sub;
      });
      const recents = await Promise.all(promises);
      setRecentSurveys(recents);
    });

    return () => {
      unsubStats();
      unsubRecent();
    };
  }, [docId]);

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

  useEffect(() => {
    if (!docId) return;
    const unsub = subscribeToSurveyTemplates(docId, (templates) => {
      setCustomSurveys(templates);
    });
    return unsub;
  }, [docId]);

  // Load upcoming visits
  useEffect(() => {
    if (!docId) return;
    let isUnmounted = false;
    
    const loadVisits = async () => {
      try {
        const data = await apiFetch(`/api/appointments/upcoming/${docId}`);
        if (!isUnmounted) {
          setUpcomingVisits(data.slice(0, 3));
          setVisitsLoading(false);
        }
      } catch (err) {
        if (!isUnmounted) setVisitsLoading(false);
      }
    };
    
    loadVisits();
    return () => { isUnmounted = true; };
  }, [docId]);

  const handleCompleteVisit = async (id) => {
    try {
      await apiFetch(`/api/appointments/${id}/complete`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: 'Completed from home screen' })
      });
      setUpcomingVisits(prev => prev.filter(v => v.id !== id));
      showToast('Visit marked as complete ✓', 'success');
    } catch (err) {
      showToast('Failed to complete visit', 'error');
    }
  };

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

  const getModuleRoute = (moduleType) => {
    const map = {
      'family_survey': 'family-survey',
      'child_growth': 'child-growth',
      'anc_registration': 'anc',
      'vaccination': 'vaccination',
      'village_health': 'village-health',
      'disease_surveillance': 'disease-surveillance',
      'birth_record': 'birth-record',
      'death_record': 'death-record',
      'ncd_tracking': 'ncd-tracking',
      'family_planning': 'family-planning',
      'sanitation': 'sanitation',
      'elderly_care': 'elderly-care'
    };
    return map[moduleType] || moduleType;
  };

  const renderSurveyRow = (sub) => {
    const pathPart = getModuleRoute(sub.moduleType);
    const moduleDef = modules.find(m => m.path.includes(pathPart)) || { title: sub.moduleType, icon: 'article', color: 'bg-gray-100 text-gray-600', path: `/asha/${pathPart}` };
    const displayDate = sub.submittedAt ? sub.submittedAt.toDate().toLocaleDateString() : 'N/A';
    const nameToShow = sub.familyName || sub.householdId || 'Unknown Family';
    
    return (
      <div 
        key={sub.id} 
        onClick={() => {
          navigate(moduleDef.path, {
            state: {
              submissionId: sub.id,
              submissionData: sub.data || sub,
              mode: 'view',
              householdName: nameToShow
            }
          });
        }}
        className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm border border-[#D3D1C7] active:scale-[0.98] transition-transform cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${moduleDef.color}`}>
             <span className="material-symbols-outlined text-lg">{moduleDef.icon}</span>
          </div>
          <div>
             <h3 className="text-sm font-bold text-[#1A1A18]">{moduleDef.title}</h3>
             <p className="text-xs text-[#5F5E5A]">{nameToShow}</p>
             <p className="text-[10px] text-gray-400 mt-0.5">{displayDate}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setSheetData({
                isOpen: true,
                targetType: sub.moduleType === 'family_survey' ? 'family' : 'child',
                targetId: sub.householdId || sub.childId || sub.id,
                targetName: nameToShow
              });
            }}
            className="px-3 py-1.5 bg-[#EAF3DE] text-[#085041] rounded-lg text-xs font-bold border border-[#1D9E75] flex items-center gap-1 active:scale-95"
          >
            📅 Schedule
          </button>
          <span className="material-symbols-outlined text-gray-400">chevron_right</span>
        </div>
      </div>
    );
  };

  return (
    <>
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
        <Link to="/asha/register-scan" className="block bg-linear-to-r from-[#085041] to-[#1D9E75] text-white p-4 rounded-2xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">{t('import_register')}</h3>
              <p className="text-xs opacity-90 mt-1">{tx('Scan handwritten logs using Vision AI')}</p>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
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
          {customSurveys.map(survey => {
            const displayTitle = language === 'mr' && survey.title_mr ? survey.title_mr :
                                 language === 'hi' && survey.title_hi ? survey.title_hi : 
                                 survey.title;
            return (
              <Link key={survey.id} to={`/asha/dynamic-survey?id=${survey.id}`} className="relative bg-white p-3 rounded-2xl shadow-sm border border-[#D3D1C7] flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow active:scale-[0.98]">
                <div className="w-11 h-11 rounded-full mb-2 flex items-center justify-center bg-[#F3E5F5] text-[#6A1B9A]">
                  {SURVEY_ICON_MAP[survey.iconName] || SURVEY_ICON_MAP['clipboard']}
                </div>
                <span className="text-[11px] font-semibold text-[#1A1A18] leading-tight truncate w-full">{displayTitle}</span>
                {survey.hasLinkage && (
                  <div className="absolute bottom-2 right-2 w-5 h-5 bg-[#EAF3DE] border border-[#1D9E75] rounded-full flex items-center justify-center" title="Links to another survey">
                    <span className="material-symbols-outlined text-[12px] text-[#085041]">link</span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        {/* Upcoming Visits Section */}
        {upcomingVisits.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#D3D1C7]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-[#1A1A18] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1D9E75]">calendar_month</span>
                Upcoming Visits
              </h2>
              <Link to="/asha/appointments" className="text-sm font-medium text-[#1D9E75] hover:underline">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {upcomingVisits.map(visit => {
                const dateObj = new Date(visit.scheduledDate);
                const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                return (
                  <div key={visit.id} className="flex items-center justify-between p-3 bg-gray-50 border border-[#D3D1C7] rounded-xl">
                    <div>
                      <p className="text-xs font-bold text-[#1D9E75] mb-0.5">📅 {dateStr} at {visit.scheduledTime || 'TBD'}</p>
                      <h3 className="font-bold text-[#1A1A18] text-sm">{visit.targetName}</h3>
                      <p className="text-xs text-[#5F5E5A]">{visit.purpose || 'Checkup'}</p>
                    </div>
                    <button 
                      onClick={() => handleCompleteVisit(visit.id)}
                      className="px-3 py-1.5 bg-[#1D9E75] text-white rounded-lg text-xs font-bold shadow-sm active:scale-95"
                    >
                      Done ✓
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* My Activity Section */}
        <div>
          <h2 className="text-lg font-bold text-[#1A1A18] mb-3">{tx('My Activity')}</h2>
          {activityLoading ? (
             <div className="space-y-3">
               <div className="flex gap-3">
                 <div className="flex-1 h-20 bg-gray-200 animate-pulse rounded-xl"></div>
                 <div className="flex-1 h-20 bg-gray-200 animate-pulse rounded-xl"></div>
                 <div className="flex-1 h-20 bg-gray-200 animate-pulse rounded-xl"></div>
               </div>
               <div className="flex gap-3">
                 <div className="flex-1 h-20 bg-gray-200 animate-pulse rounded-xl"></div>
                 <div className="flex-1 h-20 bg-gray-200 animate-pulse rounded-xl"></div>
                 <div className="flex-1 h-20 bg-gray-200 animate-pulse rounded-xl"></div>
               </div>
             </div>
          ) : (
             <div className="space-y-3">
               <div className="flex gap-3">
                 <button onClick={() => setActiveFilter(activeFilter === 'families_today' ? null : 'families_today')} className={`flex-1 bg-white p-3 rounded-xl border ${activeFilter === 'families_today' ? 'border-[#1D9E75] border-b-4 bg-[#EAF3DE]/30' : 'border-[#D3D1C7]'} text-center active:scale-95 transition-all block`}>
                   <span className="block text-xl font-bold text-[#1A1A18]">{activityStats.familiesToday}</span>
                   <span className="text-[10px] text-gray-500 uppercase font-medium">{tx('Families Today')}</span>
                 </button>
                 <button onClick={() => setActiveFilter(activeFilter === 'surveys_today' ? null : 'surveys_today')} className={`flex-1 bg-white p-3 rounded-xl border ${activeFilter === 'surveys_today' ? 'border-[#1D9E75] border-b-4 bg-[#EAF3DE]/30' : 'border-[#D3D1C7]'} text-center active:scale-95 transition-all block`}>
                   <span className="block text-xl font-bold text-[#1A1A18]">{activityStats.surveysToday}</span>
                   <span className="text-[10px] text-gray-500 uppercase font-medium">{tx('Surveys Today')}</span>
                 </button>
                 <button onClick={() => setActiveFilter(activeFilter === 'children_today' ? null : 'children_today')} className={`flex-1 bg-white p-3 rounded-xl border ${activeFilter === 'children_today' ? 'border-[#1D9E75] border-b-4 bg-[#EAF3DE]/30' : 'border-[#D3D1C7]'} text-center active:scale-95 transition-all block`}>
                   <span className="block text-xl font-bold text-[#1A1A18]">{activityStats.childrenToday}</span>
                   <span className="text-[10px] text-gray-500 uppercase font-medium">{tx('Children Today')}</span>
                 </button>
               </div>
               <div className="flex gap-3">
                 <button onClick={() => setActiveFilter(activeFilter === 'families_month' ? null : 'families_month')} className={`flex-1 bg-white p-3 rounded-xl border ${activeFilter === 'families_month' ? 'border-[#1D9E75] border-b-4 bg-[#EAF3DE]/30' : 'border-[#D3D1C7]'} text-center active:scale-95 transition-all block`}>
                   <span className="block text-xl font-bold text-[#1A1A18]">{activityStats.familiesMonth}</span>
                   <span className="text-[10px] text-gray-500 uppercase font-medium">{tx('Families This Month')}</span>
                 </button>
                 <button onClick={() => setActiveFilter(activeFilter === 'surveys_month' ? null : 'surveys_month')} className={`flex-1 bg-white p-3 rounded-xl border ${activeFilter === 'surveys_month' ? 'border-[#1D9E75] border-b-4 bg-[#EAF3DE]/30' : 'border-[#D3D1C7]'} text-center active:scale-95 transition-all block`}>
                   <span className="block text-xl font-bold text-[#1A1A18]">{activityStats.surveysMonth}</span>
                   <span className="text-[10px] text-gray-500 uppercase font-medium">{tx('Surveys This Month')}</span>
                 </button>
                 <div className="flex-1 bg-white p-3 rounded-xl border border-[#D3D1C7] text-center active:scale-95 transition-all block">
                   <span className="block text-xl font-bold text-[#1A1A18]">{pendingSyncs}</span>
                   <span className="text-[10px] text-gray-500 uppercase font-medium">{tx('Pending Sync')}</span>
                 </div>
               </div>
               
               {activeFilter && (
                 <div className="mt-4 p-4 bg-[#F8F9FA] rounded-2xl border border-gray-200">
                   <div className="flex justify-between items-center mb-3">
                     <h3 className="text-sm font-bold text-[#1A1A18]">{tx('Filtered Activity')}</h3>
                     <button onClick={() => setActiveFilter(null)} className="text-xs text-gray-500 hover:text-gray-700 font-medium bg-gray-200 px-2 py-1 rounded-md">Clear ✕</button>
                   </div>
                   {filteredSubmissions.length === 0 ? (
                     <div className="text-center text-sm text-gray-500 py-4">{tx('No records found for this filter.')}</div>
                   ) : (
                     <div className="space-y-3">
                       {filteredSubmissions.map(renderSurveyRow)}
                     </div>
                   )}
                 </div>
               )}
             </div>
          )}
        </div>

      </div>

      <AppointmentSheet 
        isOpen={sheetData.isOpen}
        targetType={sheetData.targetType}
        targetId={sheetData.targetId}
        targetName={sheetData.targetName}
        onClose={() => setSheetData({ ...sheetData, isOpen: false })}
        onScheduled={(result) => {
          // Refresh upcoming visits
          apiFetch(`/api/appointments/upcoming/${docId}`).then(data => {
            setUpcomingVisits(data.slice(0, 3));
          });
        }}
      />
    </>
  );
});
