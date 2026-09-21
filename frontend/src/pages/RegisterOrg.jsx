import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, 
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { PrecisionIdentityMatrix } from '../components/PrecisionIdentityMatrix';

const GOOGLE_CLIENT_ID = '640635826843-g3jv0g9jfk79hohe6b1t1vbr60fegkut.apps.googleusercontent.com';

export const RegisterOrg = () => {
  const [formData, setFormData] = useState({
    name: '',
    gstin: ''
  });
  
  const [savedGoogleCred, setSavedGoogleCred] = useState(null);
  const [googleUserName, setGoogleUserName] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const googleBtnRef = useRef(null);
  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

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
    const cred = response?.credential;
    if (!cred) return;

    const userData = decodeGoogleJwt(cred);
    if (!userData || !userData.email) {
      setError('Could not retrieve your Google account details. Please try again.');
      return;
    }

    const currentName = formDataRef.current.name?.trim();
    if (!currentName) {
      setError('Please enter your Organisation Name above to complete registration.');
      setSavedGoogleCred(cred);
      setGoogleUserName(userData.name || userData.email);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await googleRegisterOrg({
        org_name: currentName,
        gstin: formDataRef.current.gstin?.trim() ? formDataRef.current.gstin.trim().toUpperCase() : null,
        email: userData.email,
        name: userData.name,
        google_token: cred
      });

      // Directly route the CEO/Manager into the Admin Dashboard
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please verify your details.');
    } finally {
      setLoading(false);
    }
  }, [googleRegisterOrg, navigate]);

  // Handle submission when Google credential was already saved
  const handleSubmitWithSavedCred = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim()) {
      setError('Please enter your Organisation Name first.');
      return;
    }
    if (savedGoogleCred) {
      await handleGoogleCallback({ credential: savedGoogleCred });
    }
  };

  // Initialize and render Google Sign-Up button
  useEffect(() => {
    let intervalId = null;

    const renderGoogleBtn = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCallback,
            use_fedcm_for_prompt: true,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          googleBtnRef.current.innerHTML = '';
          const containerWidth = googleBtnRef.current.parentElement?.clientWidth || 360;
          const btnWidth = Math.min(400, Math.max(200, Math.floor(containerWidth)));

          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            text: 'signup_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: btnWidth,
          });
          setGoogleReady(true);
          return true;
        } catch (err) {
          console.warn('Google Identity initialization error:', err);
        }
      }
      return false;
    };

    if (!renderGoogleBtn()) {
      intervalId = setInterval(() => {
        if (renderGoogleBtn()) {
          clearInterval(intervalId);
        }
      }, 150);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [handleGoogleCallback]);

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

            <form onSubmit={handleSubmitWithSavedCred} className="space-y-4">
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

              {/* Primary Action Button: Register with Google / Complete Registration */}
              <div className="pt-2">
                {savedGoogleCred ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Google account connected: <strong>{googleUserName}</strong></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSavedGoogleCred(null); setGoogleUserName(''); }}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                      >
                        Change
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !formData.name.trim()}
                      className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          <span>Completing Registration...</span>
                        </>
                      ) : (
                        <>
                          <span>Complete Registration</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="w-full flex flex-col items-center">
                    {loading && (
                      <div className="w-full mb-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold flex items-center justify-center gap-2 animate-pulse">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Registering organisation...</span>
                      </div>
                    )}

                    {!googleReady && !loading && (
                      <div className="w-full py-3 px-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-3 text-slate-400 animate-pulse">
                        <div className="w-5 h-5 rounded-full bg-slate-200" />
                        <span>Loading Google Sign-Up...</span>
                      </div>
                    )}

                    <div 
                      ref={googleBtnRef} 
                      className={`w-full flex justify-center ${loading ? 'opacity-50 pointer-events-none' : ''} ${!googleReady ? 'hidden' : ''}`} 
                    />
                  </div>
                )}
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