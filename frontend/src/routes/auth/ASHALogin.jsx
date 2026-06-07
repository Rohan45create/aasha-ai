import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import LanguageToggle from '../../components/LanguageToggle';

export default function ASHALogin() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1: phone, 2: otp
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();


  const setupRecaptcha = () => {
    // Always clear stale verifier to avoid reuse issues
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    });
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Please enter a valid 10-digit number');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      setupRecaptcha();
      const formattedPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
      const appVerifier = window.recaptchaVerifier;
      window.confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setStep(2);
    } catch (err) {
      // Destroy the verifier so next attempt starts fresh
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length < 6) return;
    setError('');
    setIsLoading(true);
    try {
      const result = await window.confirmationResult.confirm(otp);
      const user = result.user;
      
      const { useAuthStore } = await import('../../stores/authStore');
      await useAuthStore.getState().handleFirebaseLogin(user, navigate);
    } catch (err) {
      setError('Invalid OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F1EFE8] px-4 font-sans text-[#1A1A18]">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      <div className="w-full max-w-sm my-5 bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-[#085041] p-8 text-center">
          {/* <div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-[#1D9E75]">monitor_heart</span>
            </div> */}
          <img src="/logo.png" alt="AshaAI Logo" className="w-60 mx-auto mb-4" />
          {/* <h1 className="text-3xl font-bold text-white font-['Noto_Sans']">AshaAI</h1> */}
          <p className="text-[#EAF3DE] mt-2 opacity-90 text-sm">Empowering ASHA Workers</p>
        </div>
        <div className="p-8">
          <h2 className="text-2xl font-semibold mb-6 flex items-center justify-center text-[#1A1A18]">
            {t('login')}
          </h2>

            <div className="mt-6 bg-[#EAF3DE] border border-[#1D9E75] rounded-xl p-4">
            <p className="text-xs font-bold text-[#27500A] mb-2"><span className="material-symbols-outlined text-[16px] align-middle mr-1">key</span> Demo Credentials</p>
            <p className="text-xs text-[#27500A] font-mono">Phone Number: 9876543211</p>
            <p className="text-xs text-[#27500A] font-mono mt-1">OTP: 123456</p>
          </div>
          <form onSubmit={step === 1 ? handleSendOtp : handleVerifyOtp} className="space-y-5">
            {step === 1 ? (
              <div>
                <label className="block text-sm font-medium mb-2 text-[#5F5E5A]">Phone Number</label>
                <div className="flex border-2 border-[#D3D1C7] rounded-xl overflow-hidden focus-within:border-[#1D9E75] focus-within:ring-2 focus-within:ring-[#1D9E75]/20 transition-all">
                  <span className="px-4 py-3 bg-gray-50 text-[#5F5E5A] border-r border-[#D3D1C7] font-medium">+91</span>
                  <input
                    type="tel"
                    className="flex-1 px-4 py-3 outline-none text-lg tracking-wide"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="9876543210"
                    maxLength={10}
                    autoFocus
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-2 text-[#5F5E5A]">Enter OTP</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border-2 border-[#D3D1C7] rounded-xl outline-none text-center text-2xl tracking-[0.5em] focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20 transition-all font-mono"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="------"
                  maxLength={6}
                  autoFocus
                />
              </div>
            )}

            {error && <p className="text-sm font-medium text-[#791F1F] bg-[#FCEBEB] p-3 rounded-lg border border-[#E24B4A]">{error}</p>}

            <button
              type="submit"
              disabled={isLoading || (step === 1 ? phoneNumber.length < 10 : otp.length < 6)}
              className="w-full bg-[#1D9E75] hover:bg-[#085041] text-white py-3.5 rounded-xl font-medium text-lg transition-colors flex items-center justify-center disabled:opacity-50 shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="material-symbols-outlined animate-spin">refresh</span>
              ) : step === 1 ? t('send_otp') : t('verify_otp')}
            </button>
            <div
              id="recaptcha-container"
              style={{ display: isLoading ? 'none' : 'block' }}
            ></div>
          </form>

          {step === 2 && (
            <button onClick={() => setStep(1)} className="mt-6 w-full text-sm font-medium text-[#1D9E75] hover:text-[#085041] transition-colors">
              Change Phone Number
            </button>
          )}

          <div className="mt-8 text-center border-t border-[#D3D1C7] pt-6">
            <p className="text-sm text-[#5F5E5A] mb-3">Supervisor or Admin?</p>
            <button
              onClick={() => navigate('/admin/login')}
              className="text-sm font-medium border border-[#1D9E75] text-[#1D9E75] px-4 py-2 rounded-lg hover:bg-[#EAF3DE] transition-colors"
            >
              Go to Admin Portal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
