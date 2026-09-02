import React from 'react';
import { Link } from 'react-router-dom';
import { ScanFace, Building2, UserCheck, ShieldCheck, ArrowRight, Sparkles, CheckCircle2, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Home = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto pt-6 pb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          Multi-Tenant Facial Recognition Platform
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Simple & Fast AI Attendance <br className="hidden sm:inline" />
          <span className="text-blue-600">for Every Organization</span>
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
          Touchless facial recognition with anti-spoofing liveness checks. Complete data privacy—storing only encrypted vector embeddings, never raw photos.
        </p>
      </div>

      {/* 3 Main Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full mb-12">
        {/* Card 1: Attendance Kiosk Terminal */}
        <div className="bg-white rounded-2xl border-2 border-blue-500/30 p-6 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between relative group overflow-hidden bg-gradient-to-b from-blue-50/40 to-white">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform" />
          <div>
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-4 shadow-md shadow-blue-500/20">
              <ScanFace className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Launch Kiosk Mode</h3>
            <p className="text-sm text-slate-600 mb-6">
              Open the full-screen tablet & webcam terminal for fast touchless employee check-in and check-out.
            </p>
          </div>
          <Link
            to="/kiosk"
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all group-hover:gap-3"
          >
            Launch Camera Kiosk
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Card 2: Organization Admin */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between hover:border-slate-300">
          <div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 border border-indigo-100">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Organization Admin</h3>
            <p className="text-sm text-slate-600 mb-6">
              Manage employees, enroll facial embeddings, view today's live roster, and export custom Excel/CSV reports.
            </p>
          </div>
          <Link
            to={user && user.role === 'org_admin' ? '/admin' : '/login'}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            {user && user.role === 'org_admin' ? 'Open Dashboard' : 'Admin Login'}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Card 3: Employee Portal */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between hover:border-slate-300">
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-100">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Employee Portal</h3>
            <p className="text-sm text-slate-600 mb-6">
              Employees can sign in to view their monthly attendance history, verify hours worked, and check consent status.
            </p>
          </div>
          <Link
            to={user ? '/portal' : '/login'}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            {user ? 'View My Punches' : 'Employee Login'}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Trust & Non-functional Privacy Highlights */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-5xl mx-auto w-full mb-6">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 text-center sm:text-left">
          Enterprise Grade Security & Privacy Compliance
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-slate-700">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-900">No Photos Stored</div>
              <div className="text-xs text-slate-500 mt-0.5">Processed in-memory to 128-d vectors; raw images are destroyed immediately.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-900">Liveness Anti-Spoofing</div>
              <div className="text-xs text-slate-500 mt-0.5">Interactive motion challenge prevents static photos and screen replay spoofing.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-900">Strict Multi-Tenancy</div>
              <div className="text-xs text-slate-500 mt-0.5">Data and facial search space are securely isolated per organization ID.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};