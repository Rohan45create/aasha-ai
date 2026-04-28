import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Guards & Layouts
import ASHAGuard from './guards/ASHAGuard.jsx';
import AdminGuard from './guards/AdminGuard.jsx';
import MobileLayout from './layouts/MobileLayout.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';

// Auth Routes
const ASHALogin = lazy(() => import('./routes/auth/ASHALogin.jsx'));
const AdminLogin = lazy(() => import('./routes/auth/AdminLogin.jsx'));

// ASHA Routes
const Home = lazy(() => import('./routes/asha/Home.jsx'));
const Profile = lazy(() => import('./routes/asha/Profile.jsx'));
const AskAshaAI = lazy(() => import('./routes/asha/AskAshaAI.jsx'));
const PriorityList = lazy(() => import('./routes/asha/PriorityList.jsx'));
const RegisterScan = lazy(() => import('./routes/asha/RegisterScan.jsx'));
const FamilySurvey = lazy(() => import('./routes/asha/modules/FamilySurvey.jsx'));
const VillageHealth = lazy(() => import('./routes/asha/modules/VillageHealth.jsx'));
const ANCRegistration = lazy(() => import('./routes/asha/modules/ANCRegistration.jsx'));
const ChildGrowth = lazy(() => import('./routes/asha/modules/ChildGrowth.jsx'));
const Vaccination = lazy(() => import('./routes/asha/modules/Vaccination.jsx'));
const BirthRecord = lazy(() => import('./routes/asha/modules/BirthRecord.jsx'));
const DeathRecord = lazy(() => import('./routes/asha/modules/DeathRecord.jsx'));
const DiseaseSurveillance = lazy(() => import('./routes/asha/modules/DiseaseSurveillance.jsx'));
const NCDTracking = lazy(() => import('./routes/asha/modules/NCDTracking.jsx'));
const FamilyPlanning = lazy(() => import('./routes/asha/modules/FamilyPlanning.jsx'));
const Sanitation = lazy(() => import('./routes/asha/modules/Sanitation.jsx'));
const ElderlyCare = lazy(() => import('./routes/asha/modules/ElderlyCare.jsx'));
const DynamicSurvey = lazy(() => import('./routes/asha/modules/DynamicSurvey.jsx'));

// Admin Routes
const AdminDashboard = lazy(() => import('./routes/admin/Dashboard.jsx'));
const SurveyBuilder = lazy(() => import('./routes/admin/SurveyBuilder.jsx'));
const CoverageMap = lazy(() => import('./routes/admin/CoverageMap.jsx'));
const WorkerManagement = lazy(() => import('./routes/admin/WorkerManagement.jsx'));
const WorkerActivity = lazy(() => import('./routes/admin/WorkerActivity.jsx'));
const PendingReview = lazy(() => import('./routes/admin/PendingReview.jsx'));
const Reports = lazy(() => import('./routes/admin/Reports.jsx'));
const AdminReferrals = lazy(() => import('./routes/admin/Referrals.jsx'));

import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db } from './firebase';
import { useAuthStore } from './stores/authStore';

const LoadingFallback = () => (
  <div className="min-h-screen bg-[#F1EFE8] flex flex-col p-4 animate-pulse">
    <div className="h-16 bg-gray-200 rounded-2xl w-full mb-6"></div>
    <div className="h-32 bg-[#EAF3DE] rounded-3xl w-full mb-6 opacity-60"></div>
    <div className="grid grid-cols-2 gap-4">
       <div className="h-28 bg-white rounded-3xl w-full"></div>
       <div className="h-28 bg-white rounded-3xl w-full"></div>
       <div className="h-28 bg-white rounded-3xl w-full"></div>
       <div className="h-28 bg-white rounded-3xl w-full"></div>
    </div>
  </div>
);

const App = () => {
  const { setUser, setRole, setLoading, setHeadId, setAshaId, isLoading } = useAuthStore();

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        try {
          const tokenResult = await user.getIdTokenResult(true);
          let userRole = tokenResult.claims?.role;
          if (tokenResult.claims?.admin) userRole = 'admin';

          // Always try to resolve headId from Firestore by email first
          // This covers seeded demo accounts that have no custom claims
          const email = user.email;
          let resolvedHeadId = null;

          if (email) {
            try {
              const q = query(collection(db, 'asha_heads'), where('email', '==', email));
              const snap = await getDocs(q);
              if (!snap.empty) {
                resolvedHeadId = snap.docs[0].id;
                if (!userRole) userRole = 'asha_head';
                console.log('[Auth] Resolved headId by email:', resolvedHeadId);
              }
            } catch (err) {
              console.warn('[Auth] Firestore head lookup by email failed:', err.code);
            }
          }

          // Fallback: try direct uid lookup in asha_heads
          if (!resolvedHeadId) {
            try {
              const headDoc = await getDocs(
                query(collection(db, 'asha_heads'), where('__name__', '==', user.uid))
              );
              if (!headDoc.empty) {
                resolvedHeadId = user.uid;
                if (!userRole) userRole = 'asha_head';
                console.log('[Auth] Resolved headId by uid:', resolvedHeadId);
              }
            } catch (_) {}
          }

          // Fallback: if email/uid lookup fails but role says admin/head, grab first asha_heads doc
          // This handles demo accounts where email doesn't match seeded email
          if (!resolvedHeadId && (userRole === 'admin' || userRole === 'asha_head' ||
              // Also check if email is present (logged in via email → likely admin)
              (user.email && !user.phoneNumber))) {
            try {
              const allHeads = await getDocs(collection(db, 'asha_heads'));
              if (!allHeads.empty) {
                resolvedHeadId = allHeads.docs[0].id;
                if (!userRole) userRole = 'asha_head';
                console.log('[Auth] Fallback: first asha_heads doc =', resolvedHeadId);
              }
            } catch (err) {
              console.warn('[Auth] asha_heads collection read failed:', err.code);
              // Ultimate hardcoded fallback for demo
              resolvedHeadId = 'head_sunita_001';
              console.log('[Auth] Using hardcoded fallback headId:', resolvedHeadId);
            }
          }

          // Set final role
          if (!userRole) userRole = 'asha_worker';
          setRole(userRole);

          if (resolvedHeadId) {
            setHeadId(resolvedHeadId);
            localStorage.setItem('headId', resolvedHeadId);
            console.log('[Auth] Set headId in store:', resolvedHeadId);
          }


          // For ASHA workers — resolve real Firestore doc ID from phone number
          if (userRole === 'asha_worker') {
            let resolvedAshaId = localStorage.getItem('ashaId');
            if (!resolvedAshaId || resolvedAshaId === 'undefined') {
              // Try to resolve by phone number (seeded docs use phone field)
              const phone = user.phoneNumber; // e.g. "+919876543210"
              if (phone) {
                try {
                  // Try exact match first
                  const phoneQ = query(collection(db, 'ashas'), where('phone', '==', phone));
                  const phoneSnap = await getDocs(phoneQ);
                  if (!phoneSnap.empty) {
                    resolvedAshaId = phoneSnap.docs[0].id;
                    console.log('[Auth] Resolved ashaId by phone:', resolvedAshaId);
                  }
                  // Try without country code
                  if (!resolvedAshaId) {
                    const shortPhone = phone.replace('+91', '');
                    const shortQ = query(collection(db, 'ashas'), where('phone', '==', shortPhone));
                    const shortSnap = await getDocs(shortQ);
                    if (!shortSnap.empty) resolvedAshaId = shortSnap.docs[0].id;
                  }
                } catch (err) {
                  console.warn('[Auth] Phone-based ashaId lookup failed:', err);
                }
              }
              // Demo fallback: use first asha doc found
              if (!resolvedAshaId) {
                try {
                  const allSnap = await getDocs(query(collection(db, 'ashas'), limit(1)));
                  if (!allSnap.empty) {
                    resolvedAshaId = allSnap.docs[0].id;
                    console.log('[Auth] Demo fallback ashaId:', resolvedAshaId);
                  }
                } catch (_) {}
              }
              // Last resort for demo
              if (!resolvedAshaId) resolvedAshaId = 'asha_lata_001';
              localStorage.setItem('ashaId', resolvedAshaId);
            }
            console.log('[Auth] Final ashaId:', resolvedAshaId);
            setAshaId(resolvedAshaId);
          }
        } catch (err) {
          console.error('Error in auth state handler:', err);
          setRole('asha_worker');
        }
      } else {
        setUser(null);
        setRole(null);
        setHeadId(null);
        setAshaId(null);
        localStorage.removeItem('headId');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [setUser, setRole, setLoading, setHeadId, setAshaId]);

  if (isLoading) {
    return <LoadingFallback />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<ASHALogin />} />
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* ASHA Protected Routes */}
          <Route element={<ASHAGuard><MobileLayout /></ASHAGuard>}>
            <Route path="/asha/home" element={<Home />} />
            <Route path="/asha/profile" element={<Profile />} />
            <Route path="/asha/ask" element={<AskAshaAI />} />
            <Route path="/asha/priority-list" element={<PriorityList />} />
            <Route path="/asha/register-scan" element={<RegisterScan />} />
            <Route path="/asha/family-survey" element={<FamilySurvey />} />
            <Route path="/asha/village-health" element={<VillageHealth />} />
            <Route path="/asha/anc" element={<ANCRegistration />} />
            <Route path="/asha/child-growth" element={<ChildGrowth />} />
            <Route path="/asha/vaccination" element={<Vaccination />} />
            <Route path="/asha/birth-record" element={<BirthRecord />} />
            <Route path="/asha/death-record" element={<DeathRecord />} />
            <Route path="/asha/disease-surveillance" element={<DiseaseSurveillance />} />
            <Route path="/asha/ncd-tracking" element={<NCDTracking />} />
            <Route path="/asha/family-planning" element={<FamilyPlanning />} />
            <Route path="/asha/sanitation" element={<Sanitation />} />
            <Route path="/asha/elderly-care" element={<ElderlyCare />} />
            <Route path="/asha/dynamic-survey" element={<DynamicSurvey />} />
          </Route>

          {/* Admin Protected Routes */}
          <Route element={<AdminGuard><AdminLayout /></AdminGuard>}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/workers" element={<WorkerManagement />} />
            <Route path="/admin/worker/:id" element={<WorkerActivity />} />
            <Route path="/admin/review" element={<PendingReview />} />
            <Route path="/admin/builder" element={<SurveyBuilder />} />
            <Route path="/admin/map" element={<CoverageMap />} />
            <Route path="/admin/reports" element={<Reports />} />
            <Route path="/admin/referrals" element={<AdminReferrals />} />
          </Route>

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/asha/home" replace />} />
          <Route path="/asha" element={<Navigate to="/asha/home" replace />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
