import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  ShieldCheck, 
  AlertCircle, 
  ArrowRight, 
  CheckCircle2, 
  FileText,
  ScanFace,
  Sparkles
} from 'lucide-react';

export const RegisterOrg = () => {
  const [formData, setFormData] = useState({
    name: '',
    gstin: '',
    email: ''
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

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Please enter your Organisation Name first.');
      return;
    }
    if (!formData.gstin.trim()) {
      setError('Please enter your Company GSTIN Number first.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const cleanName = formData.name.trim();
      const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const userEmail = formData.email?.trim() || `admin@${slug || 'company'}.com`;
      const userName = cleanName + ' Admin';

      await googleRegisterOrg({
        org_name: cleanName,
        gstin: formData.gstin.trim().toUpperCase(),
        email: userEmail,
        name: userName
      });

      // Directly route the CEO/Manager into the Admin Dashboard
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fbff] bg-blueprint flex flex-col justify-between text-slate-800">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-200/80 bg-white/70 backdrop-blur-xs px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0080ff] flex items-center justify-center text-white shadow-xs font-bold">
            <ScanFace className="w-5 h-5" />
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

      {/* Main Dual-Column Setup Viewport */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        {/* Page Top Heading */}
        <div className="max-w-4xl w-full mx-auto mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-mono font-bold mb-2">
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

        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Left Column: Biometric Kiosk Terminal Preview */}
          <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                  KIOSK PREVIEW
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  TERMINAL_A1 // ONLINE
                </span>
              </div>

              {/* Viewport Frame with Cybernetic HUD Brackets */}
              <div className="relative w-full aspect-square bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
                {/* HUD Corner Brackets */}
                <div className="hud-corner-tl" />
                <div className="hud-corner-tr" />
                <div className="hud-corner-bl" />
                <div className="hud-corner-br" />

                {/* Laser scanline animation */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#00e5ff] to-transparent shadow-[0_0_12px_#00e5ff] animate-scanline" />

                {/* Face Scanning Simulation Graphic */}
                <div className="relative w-36 h-48 sm:w-44 sm:h-56 border border-dashed border-cyan-400/50 rounded-full flex flex-col items-center justify-center">
                  <div className="w-4 h-4 border-t-2 border-l-2 border-cyan-400 absolute top-2 left-6" />
                  <div className="w-4 h-4 border-t-2 border-r-2 border-cyan-400 absolute top-2 right-6" />
                  <div className="w-4 h-4 border-b-2 border-l-2 border-cyan-400 absolute bottom-2 left-6" />
                  <div className="w-4 h-4 border-b-2 border-r-2 border-cyan-400 absolute bottom-2 right-6" />
                  
                  <ScanFace className="w-16 h-16 text-cyan-400/70 mb-2 animate-pulse" />
                  <span className="text-[10px] font-mono text-cyan-300 font-bold">READY FOR SCAN</span>
                </div>

                {/* Status Pill Inside Viewport */}
                <div className="absolute bottom-2.5 left-3 right-3 px-3 py-1.5 bg-slate-900/80 backdrop-blur-xs border border-slate-700/60 rounded-lg flex items-center justify-between text-[10px] text-slate-200 font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Liveness Detection Active</span>
                  </div>
                  <span className="text-cyan-400 font-bold">99.8%</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Zero hardware installation: Works with any webcam or tablet.</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 font-mono mt-4">
              TENANCY: ISOLATED CLOUD PARTITION
            </div>
          </div>

          {/* Right Column: Organization Registration Form */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0" />
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
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  COMPANY GSTIN NUMBER *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="gstin"
                    required
                    value={formData.gstin}
                    onChange={handleChange}
                    placeholder="33AAAAANM1RZN"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-bold tracking-wide"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">
                  Must be a valid 15-character Goods and Services Tax Identification Number.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  WORK EMAIL (OPTIONAL)
                </label>
                <div className="relative">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="sarah.jenkins@arguscnc.com"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
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
                  <span>{loading ? 'Registering with Google...' : 'Register with Google'}</span>
                </button>
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
      <footer className="border-t border-slate-200/80 bg-white/70 backdrop-blur-xs px-6 py-3 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
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