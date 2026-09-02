import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, Mail, Lock, User, Clock, AlertCircle, CheckCircle2, ArrowRight, Eye, EyeOff } from 'lucide-react';

export const RegisterOrg = () => {
  const [formData, setFormData] = useState({
    name: '',
    contact_email: '',
    admin_name: '',
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
      await registerOrg(formData);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to register organization. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-blue-500/20">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Register Your Organization</h2>
          <p className="mt-1 text-sm text-slate-500">
            Set up your organization tenant in 60 seconds
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Organization Details */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Organization / Company Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Building2 className="w-4 h-4" />
              </div>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Apex Innovations Ltd"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Admin User Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  name="admin_name"
                  required
                  value={formData.admin_name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  name="contact_email"
                  required
                  value={formData.contact_email}
                  onChange={handleChange}
                  placeholder="admin@company.com"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                name="admin_password"
                required
                value={formData.admin_password}
                onChange={handleChange}
                placeholder="Create a strong password"
                className="w-full pl-9 pr-10 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                tabIndex="-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Work Hours & Grace Period */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              Work Shift & Grace Policy
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Start Time</label>
                <input
                  type="time"
                  name="work_start_time"
                  value={formData.work_hours.start_time}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">End Time</label>
                <input
                  type="time"
                  name="work_end_time"
                  value={formData.work_hours.end_time}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Grace (Mins)</label>
                <input
                  type="number"
                  name="work_late_grace_minutes"
                  value={formData.work_hours.late_grace_minutes}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-70 mt-4"
          >
            {loading ? 'Creating Organization...' : 'Create Organization & Start'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="text-center text-sm text-slate-600">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700 underline">
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
};