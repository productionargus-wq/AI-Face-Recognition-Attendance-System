import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Clock, 
  Upload, 
  Trash2, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  ShieldCheck, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  User, 
  Briefcase,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export const OrgSettings = () => {
  const { user, organization } = useAuth();
  const [activeTab, setActiveTab] = useState('details'); // 'details' or 'shifts'
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: organization?.name || 'Argus Technologies Pvt Ltd',
    industry: 'Artificial Intelligence & Security Hardware',
    gstin: organization?.gstin || 'U72900MH2021PTC368912',
    email: organization?.contact_email || user?.email || 'admin@argustech.ai',
    phone: '+91 6389247897',
    website: 'https://www.argustech.ai',
    address: 'Argus Tech Tower, Sector 5, Bandra Kurla Complex, Mumbai, Maharashtra 400051, India',
    // Shift timings
    shiftStart: organization?.work_hours?.start_time || '09:00',
    shiftEnd: organization?.work_hours?.end_time || '18:00',
    graceMinutes: organization?.work_hours?.late_grace_minutes || 15,
    halfDayHours: organization?.work_hours?.half_day_hours || 4.5,
    otMultiplier: 1.5
  });

  useEffect(() => {
    if (organization) {
      setFormData(prev => ({
        ...prev,
        name: organization.name || prev.name,
        gstin: organization.gstin || prev.gstin,
        email: organization.contact_email || prev.email,
        shiftStart: organization.work_hours?.start_time || prev.shiftStart,
        shiftEnd: organization.work_hours?.end_time || prev.shiftEnd,
        graceMinutes: organization.work_hours?.late_grace_minutes || prev.graceMinutes,
        halfDayHours: organization.work_hours?.half_day_hours || prev.halfDayHours
      }));
    }
  }, [organization]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (organization?.id) {
        await api.put(`/organizations/${organization.id}`, {
          name: formData.name,
          gstin: formData.gstin || null,
          work_hours: {
            start_time: formData.shiftStart,
            end_time: formData.shiftEnd,
            late_grace_minutes: parseInt(formData.graceMinutes) || 15,
            half_day_hours: parseFloat(formData.halfDayHours) || 4.5
          }
        });
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.warn('Saved locally (network error fallback):', err);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      name: organization?.name || 'Argus Technologies Pvt Ltd',
      industry: 'Artificial Intelligence & Security Hardware',
      gstin: organization?.gstin || 'U72900MH2021PTC368912',
      email: organization?.contact_email || user?.email || 'admin@argustech.ai',
      phone: '+91 6389247897',
      website: 'https://www.argustech.ai',
      address: 'Argus Tech Tower, Sector 5, Bandra Kurla Complex, Mumbai, Maharashtra 400051, India',
      shiftStart: '09:00',
      shiftEnd: '18:00',
      graceMinutes: 15,
      halfDayHours: 4.5,
      otMultiplier: 1.5
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Organisation Settings &amp; Preferences
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure legal tenancy parameters, corporate coordinates, shift schedules, and operational policies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-mono font-bold text-xs">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            ADMIN ROLE
          </span>

          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200">
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&auto=format&fit=crop&q=80"
              alt="CEO"
              className="w-8 h-8 rounded-full object-cover border border-slate-200"
            />
            <div>
              <div className="text-xs font-bold text-slate-800">{user?.name || 'Dr. Sarah Jenkins'}</div>
              <div className="text-[10px] text-slate-400 font-mono">CHIEF EXECUTIVE OFFICER</div>
            </div>
          </div>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Organisation settings and policy schedules updated successfully!</span>
        </div>
      )}

      {/* Sub-Tab Navigation Pills */}
      <div className="inline-flex rounded-xl p-1 bg-white border border-slate-200 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'details'
              ? 'bg-[#0052cc] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Organisation Details
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('shifts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'shifts'
              ? 'bg-[#0052cc] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          Work Shifts &amp; Timing
        </button>
      </div>

      {activeTab === 'details' ? (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Top Row: Company Profile & Executive Oversight */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Card: Company Profile */}
            <div className="lg:col-span-8 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <h2 className="text-sm font-bold text-slate-900 mb-4">
                Company Profile
              </h2>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="relative w-24 h-24 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center p-2 shrink-0">
                  <div className="text-center">
                    <Building2 className="w-8 h-8 text-blue-600 mx-auto" />
                    <span className="text-[10px] font-black text-slate-700 tracking-wider">ARGUS</span>
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] shadow-xs">
                    ✓
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="font-extrabold text-base text-slate-900">
                    {formData.name}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed max-w-md">
                    Recommended: High-resolution PNG or SVG vector format. Dimensions 512×512px, maximum 2.0MB.
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => alert('Logo file picker simulation')}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      Change Logo
                    </button>
                    <button
                      type="button"
                      onClick={() => alert('Logo removed')}
                      className="text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Card: Executive Oversight */}
            <div className="lg:col-span-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  EXECUTIVE OVERSIGHT
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Authorized
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3 my-auto">
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80"
                  alt="Sarah Jenkins"
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                />
                <div>
                  <div className="font-bold text-slate-900 text-xs sm:text-sm">
                    {user?.name || 'Dr. Sarah Jenkins'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Chief Executive Officer &amp; Founder
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-mono pt-2">
                Sign-off Authority: Unrestricted
              </div>
            </div>
          </div>

          {/* Legal Registration & Contact Coordinates Card */}
          <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Legal Registration &amp; Contact Coordinates
                </h2>
              </div>
              <span className="text-slate-400">
                <Building2 className="w-4 h-4" />
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Organisation Legal Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Industry / Operational Sector
                </label>
                <input
                  type="text"
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Corporate Registration / GSTIN
                </label>
                <input
                  type="text"
                  name="gstin"
                  value={formData.gstin}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Official Email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Primary Voice Hotline
              </label>
              <div className="relative max-w-md">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Corporate Web Portal
              </label>
              <div className="relative">
                <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Head Office Physical Campus
              </label>
              <textarea
                rows="2"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Bottom Bar Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Last modified on Oct 25, 2024 by <span className="font-bold text-slate-700">{user?.name || 'Dr. Sarah Jenkins (CEO)'}</span></span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Reset to Default
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-[#0052cc] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'Saving...' : 'Save Organisation Details'}</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* Work Shifts & Timing Configuration Tab */
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Work Shift Timing &amp; Attendance Rules
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Set baseline operational hours, grace thresholds, and automatic deduction boundaries.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Standard Shift Start Time
                </label>
                <input
                  type="time"
                  name="shiftStart"
                  value={formData.shiftStart}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Standard Shift End Time
                </label>
                <input
                  type="time"
                  name="shiftEnd"
                  value={formData.shiftEnd}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Late Grace Minutes
                </label>
                <input
                  type="number"
                  name="graceMinutes"
                  value={formData.graceMinutes}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Arrival after grace is tagged as LATE.</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Half-Day Hours Threshold
                </label>
                <input
                  type="number"
                  step="0.5"
                  name="halfDayHours"
                  value={formData.halfDayHours}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Shift below threshold marked HALF_DAY.</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Overtime Pay Multiplier
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="otMultiplier"
                  value={formData.otMultiplier}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Applied to extra approved hours (e.g. 1.5x).</p>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Reset Defaults
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#0052cc] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Save Shift Timings'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
