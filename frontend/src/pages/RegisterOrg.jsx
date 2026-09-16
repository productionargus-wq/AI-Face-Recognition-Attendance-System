import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, 
  AlertCircle
} from 'lucide-react';
import { PrecisionIdentityMatrix } from '../components/PrecisionIdentityMatrix';

const GOOGLE_CLIENT_ID = '640635826843-g3jv0g9jfk79hohe6b1t1vbr60fegkut.apps.googleusercontent.com';

export const RegisterOrg = () => {
  const [formData, setFormData] = useState({
    name: '',
    gstin: ''
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { googleRegisterOrg } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Decode Google credential JWT to extract email and name
  const decodeGoogleJwt = (credential) => {
    try {
      const payload = credential.split('.')[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return { email: decoded.email, name: decoded.name };
    } catch (e) {
      console.error('Failed to decode Google credential:', e);
      return null;
    }
  };

  // Handle Google OAuth callback after successful Google sign-in
  const handleGoogleCallback = useCallback(async (response) => {
    setLoading(true);
    setError('');

    try {
      const userData = decodeGoogleJwt(response.credential);
      if (!userData || !userData.email) {
        setError('Could not retrieve your Google account details. Please try again.');
        setLoading(false);
        return;
      }

      await googleRegisterOrg({
        org_name: formData.name.trim(),
        gstin: formData.gstin?.trim() ? formData.gstin.trim().toUpperCase() : null,
        email: userData.email,
        name: userData.name,
        google_token: response.credential
      });

      // Directly route the CEO/Manager into the Admin Dashboard
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please verify your details.');
    } finally {
      setLoading(false);
    }
  }, [formData, googleRegisterOrg, navigate]);

  // Handle "Register with Google" button click
  const handleRegister = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Please enter your Organisation Name first.');
      return;
    }
    setError('');
    setLoading(true);

    if (!window.google?.accounts?.id) {
      setError('Google Sign-In is still loading. Please wait a moment and try again.');
      setLoading(false);
      return;
    }

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCallback,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // One Tap not available — fall back to rendered button
        const popupBtn = document.getElementById('google-register-fallback');
        if (popupBtn) {
          popupBtn.innerHTML = '';
          window.google.accounts.id.renderButton(popupBtn, {
            theme: 'outline',
            size: 'large',
            width: '100%',
            text: 'signup_with',
          });
          popupBtn.classList.remove('hidden');
          popupBtn.querySelector('div[role="button"]')?.click();
        }
        setLoading(false);
      }
    });
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between text-slate-800 overflow-x-hidden bg-[#f8f9ff]/40">
      {/* 3D Precision Identity Matrix Background */}
      <PrecisionIdentityMatrix />

      {/* Top Header */}
      <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between relative z-20 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-xs border border-slate-200/80 bg-white p-0.5">
            <img 
              src="/company-logo.jpg" 
              alt="Argus Logo" 
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
                if (e.target.parentElement) {
                  e.target.parentElement.innerHTML = '<span class="text-blue-600 font-bold text-xs">AI</span>';
                }
              }} 
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold tracking-wider text-slate-900 text-sm">
              ARGUS
            </span>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
              AI ATTENDANCE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className="hidden sm:inline">Already registered?</span>
          <Link
            to="/login"
            className="px-3 py-1.5 rounded-lg border border-slate-300 hover:border-blue-500 hover:text-blue-600 bg-white font-semibold transition-colors shadow-2xs"
          >
            Sign In with Google
          </Link>
        </div>
      </header>

      {/* Main Registration Viewport */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 relative z-10">
        {/* Page Top Heading */}
        <div className="max-w-xl w-full mx-auto mb-6 text-center">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50/90 border border-blue-200 text-blue-700 text-[10px] font-mono font-bold mb-2 backdrop-blur-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            ORGANISATION ONBOARDING
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Register Organisation
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Set up facial attendance and workforce verification for your team.
          </p>
        </div>

        <div className="max-w-xl w-full mx-auto">
          {/* Organization Registration Form Card */}
          <div className="bg-white/85 backdrop-blur-xl p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xl shadow-blue-900/5 flex flex-col justify-center">
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50/90 border border-red-200 text-red-700 text-xs flex items-center gap-2 animate-in fade-in duration-150 backdrop-blur-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  ORGANISATION NAME *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Argus Technologies Ltd."
                    className="w-full px-3.5 py-2.5 bg-white/90 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  COMPANY GSTIN NUMBER (OPTIONAL)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="gstin"
                    value={formData.gstin}
                    onChange={handleChange}
                    placeholder="33AAAAANM1RZN (Optional)"
                    className="w-full px-3.5 py-2.5 bg-white/90 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-bold tracking-wide"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">
                  Optional 15-character Goods and Services Tax Identification Number.
                </p>
              </div>

              {/* Primary Action Button: Register with Google */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-800 border-2 border-slate-200 hover:border-slate-300 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-3 shadow-xs transition-all cursor-pointer disabled:opacity-60"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>{loading ? 'Registering...' : 'Register with Google'}</span>
                </button>

                {/* Hidden fallback container for Google rendered button */}
                <div id="google-register-fallback" className="hidden mt-2" />
              </div>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
              Already have an organisation registered?{' '}
              <Link to="/login" className="font-bold text-blue-600 hover:text-blue-700">
                Sign In with Google &gt;
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Privacy Footer */}
      <footer className="border-t border-slate-200/80 bg-white/80 backdrop-blur-md px-6 py-3 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2 relative z-20">
        <div className="flex items-center gap-2 text-emerald-700 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Your biometric data is encrypted and secure. Photos are never stored directly.</span>
        </div>
        <div className="text-[10px] text-slate-400">
          Powered by arguscnc.com • © 2026 ARGUS TECHNOLOGIES. All rights reserved.
        </div>
      </footer>
    </div>
  );
};