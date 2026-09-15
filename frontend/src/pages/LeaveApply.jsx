import React, { useState } from 'react';
import { 
  CalendarDays, 
  Plus, 
  Calendar, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  User, 
  Briefcase, 
  Search, 
  Filter, 
  FileText, 
  ExternalLink,
  Phone,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LeaveApply = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('my-leaves'); // 'my-leaves' or 'team-approvals'
  const [selectedCategory, setSelectedCategory] = useState('PL'); // 'PL', 'CL', 'SL', 'LOP'
  const [durationMode, setDurationMode] = useState('FULL'); // 'FULL' or 'HALF'
  const [fromDate, setFromDate] = useState('2024-10-24');
  const [toDate, setToDate] = useState('2024-10-25');
  const [reason, setReason] = useState('Annual medical health checkup and travel');
  const [contactPhone, setContactPhone] = useState('+91 98765 43210');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const [leaveBalances, setLeaveBalances] = useState({
    PL: { available: 12, used: 6, total: 18, name: 'Paid Leave (PL)' },
    CL: { available: 5, used: 3, total: 8, name: 'Casual Leave (CL)' },
    SL: { available: 7, used: 3, total: 10, name: 'Sick Leave (SL)' },
    LOP: { available: 0, used: 0, total: 0, name: 'Unpaid Leave (LOP)' }
  });

  const [leaveHistory, setLeaveHistory] = useState([
    {
      id: 'LVR-201',
      name: 'Marcus Vance',
      empCode: 'EMP-1049',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      category: 'Paid Leave (PL)',
      categoryCode: 'PL',
      dates: 'Oct 14 – Oct 15, 2024',
      days: '2 Days • Full Shift',
      reason: 'Family Wedding in hometown',
      status: 'Approved',
      approvedBy: 'Dr. S. Jenkins',
      statusType: 'approved',
      payrollEffect: 'Salary Protected'
    },
    {
      id: 'LVR-202',
      name: 'Marcus Vance',
      empCode: 'EMP-1049',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      category: 'Sick Leave (SL)',
      categoryCode: 'SL',
      dates: 'Nov 02, 2024',
      days: '1 Day • Medical',
      reason: 'Viral Fever consultation',
      status: 'Pending Review',
      approvedBy: 'Tier 1 Approval',
      statusType: 'pending',
      payrollEffect: 'Awaiting Node Audit'
    },
    {
      id: 'LVR-203',
      name: 'Marcus Vance',
      empCode: 'EMP-1049',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      category: 'Unpaid LOP',
      categoryCode: 'LOP',
      dates: 'Sep 19, 2024',
      days: '1 Day • Personal',
      reason: 'Extended travel transit delay',
      status: 'Logged LOP',
      approvedBy: 'HR Auto-Process',
      statusType: 'lop',
      payrollEffect: '-₹1,333 Ded. (Processed)'
    }
  ]);

  const handleSubmitLeave = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('Please specify a reason for leave.');
      return;
    }

    const newLeave = {
      id: `LVR-${Date.now().toString().slice(-4)}`,
      name: user?.name || 'Marcus Vance',
      empCode: user?.employee_id || 'EMP-1049',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      category: selectedCategory === 'PL' ? 'Paid Leave (PL)' : 
                selectedCategory === 'CL' ? 'Casual Leave (CL)' :
                selectedCategory === 'SL' ? 'Sick Leave (SL)' : 'Unpaid LOP',
      categoryCode: selectedCategory,
      dates: `${fromDate} to ${toDate}`,
      days: durationMode === 'FULL' ? '2 Days • Full Shift' : '1 Day • Half Day',
      reason: reason,
      status: 'Pending Review',
      approvedBy: 'Tier 1 Approval',
      statusType: 'pending',
      payrollEffect: selectedCategory === 'LOP' ? '-₹1,333 Ded. (Pending)' : 'Salary Protected'
    };

    setLeaveHistory([newLeave, ...leaveHistory]);
    setStatusMessage('Leave application submitted successfully for supervisor approval.');
    setTimeout(() => setStatusMessage(''), 4000);
  };

  const handleClear = () => {
    setReason('');
    setSelectedCategory('PL');
    setDurationMode('FULL');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            ABSENCE GOVERNANCE &amp; LEDGER
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Leave Application &amp; Manager Approvals
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Apply for leaves, view remaining leave balances, and manage manager approvals for seamless payroll reconciliation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          {/* Dual Tab Toggle */}
          <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('my-leaves')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'my-leaves' ? 'bg-white text-blue-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Leave Requests
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('team-approvals')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'team-approvals' ? 'bg-white text-blue-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Team Approvals</span>
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                3
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 300, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052cc] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Apply for Leave
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* 4 Leave Balance Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Paid Leave (PL) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              ANNUAL ALLOCATION
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-xs font-bold text-slate-700 mb-0.5">Paid Leave (PL)</div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              12 <span className="text-xs font-medium text-slate-500">Days Available</span>
            </div>
          </div>
          <div className="space-y-1 pt-1 border-t border-slate-100">
            <div className="text-[10px] text-slate-400 font-mono">
              Used: 6 days • Total: 18 days
            </div>
            <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              100% Base Salary Protected
            </div>
          </div>
        </div>

        {/* Card 2: Casual Leave (CL) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              SHORT-NOTICE / PERSONAL
            </span>
            <div className="w-7 h-7 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-xs font-bold text-slate-700 mb-0.5">Casual Leave (CL)</div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              5 <span className="text-xs font-medium text-slate-500">Days Available</span>
            </div>
          </div>
          <div className="space-y-1 pt-1 border-t border-slate-100">
            <div className="text-[10px] text-slate-400 font-mono">
              Used: 3 days • Total: 8 days
            </div>
            <div className="text-[11px] text-slate-600 font-medium">
              Max 2 consecutive days
            </div>
          </div>
        </div>

        {/* Card 3: Sick Leave (SL) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              MEDICAL PROVISION
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-xs font-bold text-slate-700 mb-0.5">Sick Leave (SL)</div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              7 <span className="text-xs font-medium text-slate-500">Days Available</span>
            </div>
          </div>
          <div className="space-y-1 pt-1 border-t border-slate-100">
            <div className="text-[10px] text-slate-400 font-mono">
              Used: 3 days • Total: 10 days
            </div>
            <div className="text-[11px] text-slate-600 font-medium">
              Full pay with certificate (&gt;2d)
            </div>
          </div>
        </div>

        {/* Card 4: Unpaid Leave (LOP) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              PAYROLL IMPACTING
            </span>
            <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-xs font-bold text-slate-700 mb-0.5">Unpaid Leave (LOP)</div>
            <div className="text-2xl sm:text-3xl font-black text-red-600 tracking-tight">
              0 <span className="text-xs font-medium text-slate-500">Days Incurred</span>
            </div>
          </div>
          <div className="space-y-1 pt-1 border-t border-slate-100">
            <div className="text-[10px] text-slate-400 font-mono">
              Active cycle deductions: ₹0.00
            </div>
            <div className="text-[11px] text-red-600 font-bold flex items-center gap-1">
              <span>▲</span>
              Impacts salary deduction directly
            </div>
          </div>
        </div>
      </div>

      {/* Dual Column Layout: Form Left, History Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Apply for Leave Form */}
        <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-mono uppercase font-bold text-blue-600 tracking-wider">
                NEW SUBMISSION
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Apply for Leave
              </h2>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              EMP-1049
            </span>
          </div>

          <form onSubmit={handleSubmitLeave} className="space-y-4">
            {/* Step 1: Category selection pills */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                1. Select Leave Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                {/* PL */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('PL')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedCategory === 'PL' 
                      ? 'border-blue-500 bg-blue-50/50 shadow-2xs' 
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-xs text-slate-900">
                    <span>Paid Leave</span>
                    {selectedCategory === 'PL' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">12 Days balance</div>
                </button>

                {/* CL */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('CL')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedCategory === 'CL' 
                      ? 'border-blue-500 bg-blue-50/50 shadow-2xs' 
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-xs text-slate-900">
                    <span>Casual Leave</span>
                    {selectedCategory === 'CL' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">5 Days balance</div>
                </button>

                {/* SL */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('SL')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedCategory === 'SL' 
                      ? 'border-blue-500 bg-blue-50/50 shadow-2xs' 
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-xs text-slate-900">
                    <span>Sick Leave</span>
                    {selectedCategory === 'SL' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">7 Days balance</div>
                </button>

                {/* LOP */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('LOP')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedCategory === 'LOP' 
                      ? 'border-red-400 bg-red-50/50 shadow-2xs' 
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-xs text-slate-900">
                    <span>Unpaid (LOP)</span>
                    {selectedCategory === 'LOP' && <AlertCircle className="w-4 h-4 text-red-600" />}
                  </div>
                  <div className="text-[10px] text-red-600 font-medium mt-0.5">Salary deduction</div>
                </button>
              </div>
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  FROM DATE
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  TO DATE
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Duration type pills & badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="duration"
                    checked={durationMode === 'FULL'}
                    onChange={() => setDurationMode('FULL')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  Full Day
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="duration"
                    checked={durationMode === 'HALF'}
                    onChange={() => setDurationMode('HALF')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  Half Day
                </label>
              </div>

              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Calculated Duration: {durationMode === 'FULL' ? '2 Days' : '1 Day'}
              </span>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Reason for Leave
              </label>
              <textarea
                rows="2"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Specify the reason for taking absence..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Approver & Contact row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  REPORTING APPROVER
                </label>
                <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Dr. Sarah Jenkins</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  CONTACT DURING LEAVE
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Payroll Protection Card */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-blue-800 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Payroll Reconciliation Protection</span>
              </div>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                Paid leaves will <span className="font-bold">NOT deduct</span> from your regular base pay of ₹40,000/month. Unapproved or LOP requests trigger a ₹1,333/day compensation offset.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Clear
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#0052cc] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Submit Leave Application
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Leave Request History */}
        <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Leave Request History
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time sync with Argus Biometric Timecard &amp; Payroll
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search entries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36 sm:w-44"
                />
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                All Types
              </button>
            </div>
          </div>

          {/* History List Table */}
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-xs text-slate-600 border-collapse min-w-[550px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 px-3">EMPLOYEE</th>
                  <th className="py-2.5 px-3">LEAVE DETAILS</th>
                  <th className="py-2.5 px-3">REASON</th>
                  <th className="py-2.5 px-3">STATUS</th>
                  <th className="py-2.5 px-3 text-right">PAYROLL EFFECT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaveHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Employee */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                          MV
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.empCode}</div>
                        </div>
                      </div>
                    </td>

                    {/* Details */}
                    <td className="py-3 px-3">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold font-mono mb-1 ${
                        item.categoryCode === 'PL' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        item.categoryCode === 'SL' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {item.category}
                      </span>
                      <div className="font-bold text-slate-800 text-[11px]">{item.dates}</div>
                      <div className="text-[10px] text-slate-400">{item.days}</div>
                    </td>

                    {/* Reason */}
                    <td className="py-3 px-3 text-slate-700 max-w-[160px] truncate">
                      {item.reason}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {item.statusType === 'approved' && (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Approved
                          </span>
                          <div className="text-[9px] text-slate-400 mt-0.5">{item.approvedBy}</div>
                        </div>
                      )}
                      {item.statusType === 'pending' && (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            Pending Review
                          </span>
                          <div className="text-[9px] text-slate-400 mt-0.5">{item.approvedBy}</div>
                        </div>
                      )}
                      {item.statusType === 'lop' && (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-bold border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Logged LOP
                          </span>
                          <div className="text-[9px] text-slate-400 mt-0.5">{item.approvedBy}</div>
                        </div>
                      )}
                    </td>

                    {/* Payroll Effect */}
                    <td className="py-3 px-3 text-right">
                      {item.categoryCode === 'LOP' ? (
                        <span className="text-red-600 font-bold font-mono text-[11px]">
                          {item.payrollEffect}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-700 font-medium text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          {item.payrollEffect}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="pt-4 mt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-1.5 text-slate-600">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ledger Synchronized with Argus Biometric Timecard Node 01</span>
            </div>

            <div className="flex items-center gap-2">
              <span>Showing 3 records</span>
              <div className="inline-flex items-center gap-1">
                <button type="button" className="px-2 py-0.5 border border-slate-200 rounded text-[10px] font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50" disabled>
                  Prev
                </button>
                <button type="button" className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold">
                  1
                </button>
                <button type="button" className="px-2 py-0.5 border border-slate-200 rounded text-[10px] font-bold hover:bg-slate-50 cursor-pointer">
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Rulebook Banner */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <span>Organizational Attendance Rulebook #SEC-402</span>
              <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                HASH: 4b91-e87f-matrix
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Unplanned consecutive leaves greater than 3 days require medical certification upon return. Shift leaves sync daily with the facial kiosk node.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => alert('Downloading Organizational Attendance Rulebook PDF...')}
          className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 whitespace-nowrap cursor-pointer"
        >
          Download Handbook
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
