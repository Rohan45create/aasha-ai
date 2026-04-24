import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export default function AdminLogin() {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSetupHelp, setShowSetupHelp] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setError('');
    setShowSetupHelp(false);
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      
      const token = await result.user.getIdTokenResult();
      if (token.claims.role === 'asha_head' || token.claims.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        setShowSetupHelp(true);
        setError('Your account does not have admin access yet.');
        await auth.signOut();
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
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
            <p className="text-[#5F5E5A]">Sign in with your authorized Google account.</p>
          </div>

          {error && (
            <div className="mb-6 bg-[#FCEBEB] text-[#791F1F] p-4 rounded-xl border border-[#E24B4A] text-sm">
              <div className="flex items-start">
                <span className="material-symbols-outlined mr-2 flex-shrink-0">error</span>
                <p>{error}</p>
              </div>
            </div>
          )}

          {showSetupHelp && (
            <div className="mb-6 bg-[#FFF8E1] text-[#5D4037] p-4 rounded-xl border border-[#FFCA28] text-xs space-y-2">
              <p className="font-bold text-sm">How to get admin access:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Go to Firebase Console &rarr; Authentication &rarr; Users</li>
                <li>Find your email and copy the <strong>User UID</strong></li>
                <li>Open a terminal in the project folder</li>
                <li>Run: <code className="bg-white/50 px-1 rounded">cd backend && python set_admin_role.py</code></li>
                <li>Paste your UID and choose role: <strong>asha_head</strong></li>
                <li>Come back here, clear cookies (F12 &rarr; Application &rarr; Clear site data)</li>
                <li>Sign in again</li>
              </ol>
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white border border-[#D3D1C7] text-[#1A1A18] py-4 px-6 rounded-xl font-bold shadow-sm hover:shadow-md transition-all flex items-center justify-center space-x-3 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="material-symbols-outlined animate-spin">refresh</span>
            ) : (
              <>
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                <span>Sign in with Google</span>
              </>
            )}
          </button>

          <div className="mt-8 bg-[#EAF3DE] border border-[#1D9E75] rounded-xl p-4 flex items-start">
            <span className="material-symbols-outlined text-[#1D9E75] mr-3 mt-0.5">verified_user</span>
            <p className="text-xs text-[#27500A] leading-relaxed">
              <strong>2FA Notice:</strong> Access to the supervisor portal requires Multi-Factor Authentication. Setup is enforced post-login.
            </p>
          </div>
        </div>
        
        <button onClick={() => navigate('/login')} className="absolute bottom-8 left-1/2 -translate-x-1/2 text-sm text-[#5F5E5A] hover:text-[#085041] transition-colors underline">Return to ASHA Mobile App</button>
      </div>
    </div>
  );
}
