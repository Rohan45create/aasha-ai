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
const PendingReview = lazy(() => import('./routes/admin/PendingReview.jsx'));
const Reports = lazy(() => import('./routes/admin/Reports.jsx'));

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { useAuthStore } from './stores/authStore';

const LoadingFallback = () => (
  <div className="min-h-screen bg-[#F1EFE8] flex flex-col p-4 animate-pulse">
    {/* Skeleton Header */}
    <div className="h-16 bg-gray-200 rounded-2xl w-full mb-6"></div>
    
    {/* Skeleton Hero / Top card */}
    <div className="h-32 bg-[#EAF3DE] rounded-3xl w-full mb-6 opacity-60"></div>
    
    {/* Skeleton Grid for modules */}
    <div className="grid grid-cols-2 gap-4">
       <div className="h-28 bg-white rounded-3xl w-full"></div>
       <div className="h-28 bg-white rounded-3xl w-full"></div>
       <div className="h-28 bg-white rounded-3xl w-full"></div>
       <div className="h-28 bg-white rounded-3xl w-full"></div>
    </div>
  </div>
);

const App = () => {
  const { setUser, setRole, setLoading, isLoading } = useAuthStore();

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        try {
          const token = await user.getIdTokenResult(true);
          let userRole = token.claims?.role;
          if (!userRole) {
            if (token.claims?.admin) userRole = 'admin';
            else userRole = 'asha_worker';
          }
          setRole(userRole);
        } catch (err) {
          console.error("Error getting user claims:", err);
          setRole('asha_worker');
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [setUser, setRole, setLoading]);

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
            <Route path="/admin/review" element={<PendingReview />} />
            <Route path="/admin/builder" element={<SurveyBuilder />} />
            <Route path="/admin/map" element={<CoverageMap />} />
            <Route path="/admin/reports" element={<Reports />} />
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
