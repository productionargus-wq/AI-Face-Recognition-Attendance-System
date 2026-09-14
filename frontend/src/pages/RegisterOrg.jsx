import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  Mail, 
  Lock, 
  User, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Camera, 
  FileText 
} from 'lucide-react';

export const RegisterOrg = () => {
  const [formData, setFormData] = useState({
    name: 'Argus Technologies Ltd.',
    gstin: '33AAAAANM1RZN',
    contact_email: '',
    admin_name: 'Admin Director',
    admin_password: '',
    work_hours: {
      start_time: '09:00',
      end_time: '18:00',
      late_grace_minutes: 15
    }
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { registerOrg } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('work_')) {
      const field = name.replace('work_', '');
      setFormData(prev => ({
        ...prev,
        work_hours: {
          ...prev.work_hours,
          [field]: field === 'late_grace_minutes' ? parseInt(value) || 0 : value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await registerOrg({
        name: formData.name,
        contact_email: formData.contact_email || 'admin@' + formData.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com',
        admin_name: formData.admin_name,
        admin_password: formData.admin_password || 'AdminPass@2026',
        work_hours: formData.work_hours
      });
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to register organization. Please check details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fbff] bg-blueprint flex flex-col justify-between text-slate-800">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-6 sm:px-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0080ff] flex items-center justify-center text-white shadow-xs font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-black tracking-wider text-slate-900 uppercase">
              ARGUS
            </div>
            <div className="text-[9px] tracking-tight text-slate-500 font-bold -mt-0.5 uppercase">
              AI ATTENDANCE
            </div>
          </div>
        </div>

        <div className="text-[11px] font-mono uppercase font-bold tracking-wider text-slate-500 hidden sm:block">
          TENANT REGISTRATION PORTAL
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col justify-center">
        {/* Title Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-widest mb-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            ORGANISATION ONBOARDING
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Register Organisation
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Set up facial attendance and workforce verification for your team.
          </p>
        </div>

        {/* 2-Column Split: Biometric Kiosk Preview & Form Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Biometric Kiosk Preview (Matches Image 5) */}
          <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Camera className="w-4 h-4 text-blue-600" />
                Biometric Kiosk Preview
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-[10px] font-bold text-emerald-700 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                INSTANT SETUP
              </div>
            </div>

            {/* High-Tech HUD Viewport with Cybernetic Face Mesh */}
            <div className="relative aspect-[4/3] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
              {/* Wireframe Reticle Elements */}
              <div className="absolute inset-0 p-3 flex flex-col justify-between pointer-events-none">
                <div className="flex justify-between items-start">
                  <div className="hud-corner-tl w-7 h-7" />
                  <div className="text-[9px] font-mono text-cyan-400">BIOMETRIC VERIFICATION</div>
                  <div className="hud-corner-tr w-7 h-7" />
                </div>

                {/* Center Face Target Mesh Frame */}
                <div className="self-center w-36 h-44 border border-cyan-500/25 rounded-full flex items-center justify-center relative">
                  <div className="w-28 h-36 border border-dashed border-cyan-400/50 rounded-full animate-pulse" />
                  <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-cyan-400/30" />
                  <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-cyan-400/30" />
                </div>

                <div className="flex justify-between items-end">
                  <div className="hud-corner-bl w-7 h-7" />
                  <div className="hud-corner-br w-7 h-7" />
                </div>
              </div>

              {/* Status Pill Inside Viewport */}
              <div className="absolute bottom-2.5 left-3 right-3 px-3 py-1.5 bg-slate-900/80 backdrop-blur-sm border border-slate-700/60 rounded-lg flex items-center gap-2 text-[10px] text-slate-200 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Liveness Detection Active</span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Works on standard tablets, phones, or web cameras</span>
            </div>
          </div>

          {/* Right Column: Registration Form (Matches Image 5) */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  ORGANISATION NAME
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Argus Technologies Ltd."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  COMPANY GSTIN NUMBER *
                </label>
                <input
                  type="text"
                  name="gstin"
                  required
                  value={formData.gstin}
                  onChange={handleChange}
                  placeholder="33AAAAANM1RZN"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  WORK EMAIL (OPTIONAL)
                </label>
                <input
                  type="email"
                  name="contact_email"
                  value={formData.contact_email}
                  onChange={handleChange}
                  placeholder="sarah.jenkins@arguscnc.com"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Admin Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  ADMIN PASSWORD
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="admin_password"
                    value={formData.admin_password}
                    onChange={handleChange}
                    placeholder="Create a strong password"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Google OAuth Quick Button */}
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, contact_email: 'sarah.jenkins@arguscnc.com' }));
                }}
                className="w-full py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2.5 shadow-2xs transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Continue with Google
              </button>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-70"
              >
                {loading ? 'Creating Organization...' : 'Complete Registration'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
              Already have an organisation account?{' '}
              <Link to="/login" className="font-bold text-blue-600 hover:text-blue-700">
                Sign In here &gt;
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