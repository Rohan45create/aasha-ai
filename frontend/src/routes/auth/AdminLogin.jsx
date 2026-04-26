import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { useAuthStore } from '../../stores/authStore';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();
  const { setUser, setRole, setHeadId } = useAuthStore();

  const resolveHeadId = async (user) => {
    let resolvedHeadId = null;
    const userEmail = user.email;
    if (userEmail) {
      const q = query(collection(db, 'asha_heads'), where('email', '==', userEmail));
      const snap = await getDocs(q);
      if (!snap.empty) {
        resolvedHeadId = snap.docs[0].id;
        console.log('[AdminLogin] Resolved headId by email:', resolvedHeadId);
      }
    }
    if (!resolvedHeadId) {
      const direct = await getDoc(doc(db, 'asha_heads', user.uid));
      if (direct.exists()) resolvedHeadId = user.uid;
    }
    if (!resolvedHeadId) {
      // Demo fallback — use head_sunita_001
      resolvedHeadId = 'head_sunita_001';
      console.log('[AdminLogin] Using demo fallback headId:', resolvedHeadId);
    }
    return resolvedHeadId;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      const resolvedHeadId = await resolveHeadId(user);

      setUser(user);
      setRole('asha_head');
      setHeadId(resolvedHeadId);
      localStorage.setItem('headId', resolvedHeadId);

      navigate('/admin/dashboard');
    } catch (err) {
      console.error('[AdminLogin] Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Check the demo credentials below.');
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) { setError('Enter your email first'); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex text-[#1A1A18] font-sans relative overflow-hidden bg-[#085041]">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
      <div className="flex-1 hidden lg:flex flex-col justify-center px-16 z-10 text-white">
        <img src="/logo.png" alt="AshaAI Logo" className="w-70 mb-4" onError={(e) => { e.target.style.display='none'; }} />
        <h1 className="text-6xl font-bold mb-6 text-[#EAF3DE]">AshaAI Supervisor</h1>
        <p className="text-2xl text-white/80 max-w-xl leading-relaxed">Manage your coverage area, monitor critical health alerts, and deploy dynamic surveys across the district.</p>
      </div>
      <div className="w-full lg:w-1/3 min-w-[400px] bg-[#F1EFE8] flex flex-col justify-center items-center py-12 px-8 z-10 relative shadow-[-20px_0_40px_rgba(0,0,0,0.2)]">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-[#085041] rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-6 rotate-3">
              <span className="material-symbols-outlined text-white text-3xl -rotate-3">shield_locked</span>
            </div>
            <h2 className="text-3xl font-bold mb-2">Admin Portal</h2>
            <p className="text-[#5F5E5A]">Sign in with your admin credentials.</p>
          </div>

          {error && (
            <div className="mb-6 bg-[#FCEBEB] text-[#791F1F] p-4 rounded-xl border border-[#E24B4A] text-sm">
              <div className="flex items-start">
                <span className="material-symbols-outlined mr-2 flex-shrink-0">error</span>
                <p>{error}</p>
              </div>
            </div>
          )}

          {resetSent && (
            <div className="mb-6 bg-[#EAF3DE] text-[#085041] p-4 rounded-xl border border-[#1D9E75] text-sm">
              Password reset email sent! Check your inbox.
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-[#5F5E5A]">Email Address</label>
              <input
                type="email"
                id="admin-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border-2 border-[#D3D1C7] rounded-xl focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20 transition-all bg-white"
                placeholder="sunita.sharma@asha.gov.in"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-[#5F5E5A]">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="admin-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 pr-12 border-2 border-[#D3D1C7] rounded-xl focus:outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20 transition-all bg-white"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5F5E5A] hover:text-[#1A1A18]"
                >
                  <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="admin-login-btn"
              disabled={isLoading}
              className="w-full bg-[#1D9E75] text-white py-4 px-6 rounded-xl font-bold shadow-md hover:bg-[#085041] transition-all flex items-center justify-center disabled:opacity-50"
            >
              {isLoading ? (
                <span className="material-symbols-outlined animate-spin">refresh</span>
              ) : (
                <>
                  <span className="material-symbols-outlined mr-2">login</span>
                  <span>Login</span>
                </>
              )}
            </button>
          </form>

          <button
            onClick={handleForgotPassword}
            className="w-full mt-3 text-sm text-[#5F5E5A] hover:text-[#085041] transition-colors underline"
          >
            Forgot password?
          </button>

          {/* Demo Credentials */}
          <div className="mt-6 bg-[#EAF3DE] border border-[#1D9E75] rounded-xl p-4">
            <p className="text-xs font-bold text-[#27500A] mb-2">🔑 Demo Credentials</p>
            <p className="text-xs text-[#27500A] font-mono">Email: admin@asha.gov.in</p>
            <p className="text-xs text-[#27500A] font-mono mt-1">Password: Admin@123</p>
            <p className="text-xs text-[#5F5E5A] mt-2">Create this account in Firebase Console → Authentication → Users</p>
          </div>
        </div>

        <button onClick={() => navigate('/login')} className="absolute bottom-8 left-1/2 -translate-x-1/2 text-sm text-[#5F5E5A] hover:text-[#085041] transition-colors underline">Return to ASHA Mobile App</button>
      </div>
    </div>
  );
}
