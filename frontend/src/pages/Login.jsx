import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ScanFace, 
  Lock, 
  AlertCircle, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2, 
  Camera,
  RefreshCw, 
  Sparkles
} from 'lucide-react';
import { AttendanceTerminalModal } from '../components/AttendanceTerminalModal';
import { PrecisionIdentityMatrix } from '../components/PrecisionIdentityMatrix';

const GOOGLE_CLIENT_ID = '640635826843-g3jv0g9jfk79hohe6b1t1vbr60fegkut.apps.googleusercontent.com';

export const Login = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceScanning, setFaceScanning] = useState(false);
  const [faceError, setFaceError] = useState('');
  const [faceSuccess, setFaceSuccess] = useState('');
  const [showTerminal, setShowTerminal] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const { user, googleLogin, faceLogin } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect immediately to respective UI
  useEffect(() => {
    if (user) {
      if (user.role === 'org_admin' || user.role === 'super_admin') {
        navigate('/admin');
      } else {
        navigate('/portal');
      }
    }
  }, [user, navigate]);

  // Handle instant Face Biometric Sign-in
  const handleFaceSignIn = async () => {
    if (!videoRef.current) return;
    setError('');
    setFaceError('');
    setFaceSuccess('');
    setFaceScanning(true);

    try {
      const canvas = canvasRef.current || document.createElement('canvas');
      const video = videoRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageSample = canvas.toDataURL('image/jpeg', 0.85);

      const res = await faceLogin(imageSample);
      const roleLabel = res.user.role === 'org_admin' || res.user.role === 'super_admin' ? 'Admin' : 'Staff';
      setFaceSuccess(`Verified: ${res.user.name || 'User'} (${roleLabel}) — Access Granted!`);

      setTimeout(() => {
        if (res.user.role === 'org_admin' || res.user.role === 'super_admin') {
          navigate('/admin');
        } else {
          navigate('/portal');
        }
      }, 700);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Face not recognized. Please position your face clearly in the reticle or sign in with Google.';
      setFaceError(detail);
    } finally {
      setFaceScanning(false);
    }
  };

  // Face webcam stream handler
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.warn('Webcam not accessible:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      setCameraActive(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

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

  // Handle Google OAuth callback
  const handleGoogleCallback = useCallback(async (response) => {
    setError('');
    setLoading(true);

    try {
      const userData = decodeGoogleJwt(response.credential);
      if (!userData || !userData.email) {
        setError('Could not retrieve your Google account details. Please try again.');
        setLoading(false);
        return;
      }

      const res = await googleLogin({
        email: userData.email,
        name: userData.name,
        google_token: response.credential
      });

      if (res.user.role === 'org_admin' || res.user.role === 'super_admin') {
        navigate('/admin');
      } else {
        navigate('/portal');
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Access Denied: Your Google account is not registered with any organisation. Please register your organisation first.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  }, [googleLogin, navigate]);

  // Handle "Continue with Google" button click — triggers Google One Tap / popup
  const handleGoogleSignIn = () => {
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

    // Use prompt() for One Tap, but if it's dismissed/unavailable, fall back to renderButton approach
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // One Tap not available (e.g. user dismissed before, or 3rd party cookies blocked)
        // Fall back to popup mode
        const popupBtn = document.getElementById('google-signin-fallback');
        if (popupBtn) {
          window.google.accounts.id.renderButton(popupBtn, {
            theme: 'outline',
            size: 'large',
            width: '100%',
            text: 'continue_with',
          });
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

      {/* Top Brand Header */}
      <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 relative z-20 shadow-2xs">
        <div className="flex items-center gap-3 shrink-0">
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
            <span className="hidden sm:inline text-[11px] font-mono font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
              AI ATTENDANCE
            </span>
          </div>
        </div>

        {/* Top Center: Attendance Capture Terminal Button */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => setShowTerminal(true)}
            className="group relative inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 hover:shadow-lg transition-all cursor-pointer border border-blue-400/30 active:scale-95"
            title="Open Live Kiosk Attendance Punch Terminal"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <ScanFace className="w-4 h-4 text-blue-200 group-hover:scale-110 transition-transform" />
            <span className="tracking-wide font-semibold text-xs sm:text-sm">Attendance Capture Terminal</span>
            <span className="hidden md:inline text-[9px] font-mono uppercase bg-white/20 text-white px-1.5 py-0.5 rounded ml-0.5 font-bold">
              LIVE
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 shrink-0">
          <span className="hidden lg:inline">New organisation?</span>
          <Link
            to="/register-org"
            className="px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-300 hover:border-blue-500 hover:text-blue-600 bg-white font-semibold transition-colors shadow-2xs text-[11px] sm:text-xs"
          >
            Register Organisation
          </Link>
        </div>
      </header>

      {/* Main Dual-Column Authentication Viewport */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 relative z-10">
        {/* Page Top Heading */}
        <div className="max-w-4xl w-full mx-auto mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50/90 border border-blue-200 text-blue-700 text-[10px] font-mono font-bold mb-2 backdrop-blur-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            PRECISION IDENTITY MATRIX
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Sign In
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Sign in with your Google account to access your organisation dashboard.
          </p>
        </div>

        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Left Column: Live Optical Face Scanner Viewport */}
          <div className="lg:col-span-5 bg-white/85 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xl shadow-blue-900/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                  FACE RECOGNITION
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  ACTIVE // READY
                </span>
              </div>

              {/* Viewport Frame with Cybernetic HUD Brackets */}
              <div className="relative w-full aspect-square bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
                {/* HUD Corner Brackets */}
                <div className="hud-corner-tl" />
                <div className="hud-corner-tr" />
                <div className="hud-corner-bl" />
                <div className="hud-corner-br" />

                {/* Video Stream */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />

                {/* Hidden canvas for instantaneous frame extraction */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Laser scanline animation */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#00e5ff] to-transparent shadow-[0_0_12px_#00e5ff] animate-scanline" />

                {/* Center Face Reticle Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className={`w-36 h-48 sm:w-44 sm:h-56 border border-dashed rounded-full flex items-center justify-center transition-colors ${
                    faceScanning ? 'border-emerald-400/90 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'border-cyan-400/50'
                  }`}>
                    <div className="w-4 h-4 border-t-2 border-l-2 border-cyan-400 absolute top-2 left-6" />
                    <div className="w-4 h-4 border-t-2 border-r-2 border-cyan-400 absolute top-2 right-6" />
                    <div className="w-4 h-4 border-b-2 border-l-2 border-cyan-400 absolute bottom-2 left-6" />
                    <div className="w-4 h-4 border-b-2 border-r-2 border-cyan-400 absolute bottom-2 right-6" />
                  </div>
                </div>

                {/* Telemetry Labels inside camera */}
                <div className="absolute top-3 left-3 z-10 text-[9px] font-mono text-cyan-400/90 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  LIVE_FEED // 60 FPS
                </div>

                <div className="absolute bottom-3 left-3 z-10 text-[9px] font-mono text-cyan-400/80">
                  {faceScanning ? 'ANALYZING NEURAL VECTORS...' : 'ISO/IEC 30107-3 ACTIVE'}
                </div>
              </div>
            </div>

            {/* Face Recognition Feedback Banner */}
            {faceSuccess && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in duration-200 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold text-[11px] leading-tight">{faceSuccess}</span>
              </div>
            )}

            {faceError && (
              <div className="mt-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-in fade-in duration-200 shadow-2xs">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-tight">{faceError}</span>
              </div>
            )}

            {/* Face Login Button */}
            <div>
              <button
                type="button"
                onClick={handleFaceSignIn}
                disabled={faceScanning || loading}
                className="mt-4 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 active:scale-[0.99] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 hover:shadow-lg transition-all cursor-pointer border border-blue-400/30 disabled:opacity-60"
                title="Scan and verify face to sign in"
              >
                {faceScanning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Verifying Face Biometrics...</span>
                  </>
                ) : (
                  <>
                    <ScanFace className="w-4 h-4 text-blue-200" />
                    <span>Scan & Sign In with Face</span>
                  </>
                )}
              </button>

              <div className="mt-2 text-center text-[10px] text-slate-500 font-medium flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Instant 1:N neural vector match • Direct dashboard routing</span>
              </div>
            </div>
          </div>

          {/* Right Column: Google Single Sign-On Account Portal */}
          <div className="lg:col-span-7 bg-white/85 backdrop-blur-xl p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xl shadow-blue-900/5 flex flex-col justify-center">
            {/* Error / Access Denied Notification Banner */}
            {error && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-50/90 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-in fade-in duration-200 backdrop-blur-xs">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-red-800">Authentication Failed</div>
                  <div className="text-red-700 text-[11px] leading-relaxed">{error}</div>
                </div>
              </div>
            )}

            {/* Google Single Sign-On Primary Button */}
            <div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-800 border-2 border-slate-200 hover:border-slate-300 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-3 shadow-xs transition-all cursor-pointer disabled:opacity-60"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
              </button>

              {/* Hidden fallback container for Google rendered button */}
              <div id="google-signin-fallback" className="hidden mt-2" />
            </div>

            {/* Need an Account Footer Link */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Need an account?</span>
              <Link 
                to="/register-org" 
                className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Register Organization
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Privacy & Compliance Trust Bar */}
      <footer className="h-12 border-t border-slate-200/80 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between text-[11px] text-slate-500 font-medium relative z-20">
        <div className="flex items-center gap-1.5 text-emerald-700">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Zero-Knowledge Architecture: Encrypted 128-d vectors only.</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <Lock className="w-3.5 h-3.5" />
          <span>ISO/IEC 30107-3 Biometric Compliance</span>
        </div>
      </footer>

      {/* Attendance Capture Terminal Modal */}
      <AttendanceTerminalModal 
        isOpen={showTerminal} 
        onClose={() => setShowTerminal(false)} 
      />
    </div>
  );
};