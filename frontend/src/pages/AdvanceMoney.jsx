import React, { useState } from 'react';
import { 
  Banknote, 
  Plus, 
  Calendar, 
  Download, 
  Filter, 
  Search, 
  ArrowUpRight, 
  Clock, 
  PieChart, 
  CheckCircle2, 
  MoreVertical, 
  FileText, 
  X,
  User,
  IndianRupee,
  Layers,
  Sparkles
} from 'lucide-react';

export const AdvanceMoney = () => {
  const [cycle, setCycle] = useState('October 2024');
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState(null);

  const [advances, setAdvances] = useState([
    {
      id: 'ADV-01',
      name: 'Marcus Vance',
      empCode: 'EMP-1049',
      dept: 'Systems & Sec',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      totalAdvance: 15000,
      nextDeduction: 7500,
      instalmentText: 'Instalment 1/2',
      progressText: '1 of 2 mos',
      progressPercent: 50,
      balance: 7500,
      approval: 'Approved & Active',
      approvalType: 'active',
      cycleImpact: 'Will deduct ₹7,500 on Oct 31'
    },
    {
      id: 'ADV-02',
      name: 'Pooja Sharma',
      empCode: 'EMP-2104',
      dept: 'Identity Verification',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80',
      totalAdvance: 30000,
      nextDeduction: 10000,
      instalmentText: 'Instalment 2/3',
      progressText: '2 of 3 mos',
      progressPercent: 66,
      balance: 10000,
      approval: 'Approved & Active',
      approvalType: 'active',
      cycleImpact: 'Will deduct ₹10,000 on Oct 31'
    },
    {
      id: 'ADV-03',
      name: 'Vikram Malhotra',
      empCode: 'EMP-0922',
      dept: 'Biometric Kiosk Ops',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
      totalAdvance: 20000,
      nextDeduction: 20000,
      instalmentText: 'Completed',
      progressText: '1 of 1 mo',
      progressPercent: 100,
      balance: 0,
      approval: 'Deducted in Payroll',
      approvalType: 'completed',
      cycleImpact: 'Reconciled (Sep Batch)'
    },
    {
      id: 'ADV-04',
      name: 'Ananya Kulkarni',
      empCode: 'EMP-3311',
      dept: 'Compliance & Audit',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80',
      totalAdvance: 25000,
      nextDeduction: 12500,
      instalmentText: 'Awaiting Node Check',
      progressText: '0 of 2 mos',
      progressPercent: 0,
      balance: 25000,
      approval: 'Pending Clearance',
      approvalType: 'pending',
      cycleImpact: 'Hold for Sign-off'
    }
  ]);

  const [newAdvance, setNewAdvance] = useState({
    employeeName: '',
    empCode: '',
    department: 'Tactical Sec',
    amount: '',
    installments: 2,
    reason: ''
  });

  const handleIssueAdvance = (e) => {
    e.preventDefault();
    if (!newAdvance.employeeName || !newAdvance.amount) {
      alert('Please fill out employee name and amount.');
      return;
    }

    const total = parseFloat(newAdvance.amount);
    const months = parseInt(newAdvance.installments) || 1;
    const monthly = Math.round(total / months);

    const record = {
      id: `ADV-${Date.now().toString().slice(-4)}`,
      name: newAdvance.employeeName,
      empCode: newAdvance.empCode || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      dept: newAdvance.department,
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80',
      totalAdvance: total,
      nextDeduction: monthly,
      instalmentText: `Instalment 1/${months}`,
      progressText: `0 of ${months} mos`,
      progressPercent: 0,
      balance: total,
      approval: 'Approved & Active',
      approvalType: 'active',
      cycleImpact: `Will deduct ₹${monthly.toLocaleString('en-IN')} on Oct 31`
    };

    setAdvances([record, ...advances]);
    setModalOpen(false);
    setNewAdvance({
      employeeName: '',
      empCode: '',
      department: 'Tactical Sec',
      amount: '',
      installments: 2,
      reason: ''
    });
  };

  const openSlip = (adv) => {
    setSelectedSlip(adv);
    setSlipModalOpen(true);
  };

  const filteredAdvances = advances.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.empCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.dept.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Title & Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Advance Money Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track, disburse, and auto-amortize employee salary advances against monthly payroll.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Cycle Selector */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] uppercase font-mono text-slate-400">CYCLE:</span>
            <select
              value={cycle}
              onChange={(e) => setCycle(e.target.value)}
              className="bg-transparent border-none focus:outline-none font-bold text-slate-800 cursor-pointer"
            >
              <option value="October 2024">October 2024</option>
              <option value="November 2024">November 2024</option>
              <option value="December 2024">December 2024</option>
            </select>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052cc] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Request / Issue Salary Advance
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Disbursed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              TOTAL DISBURSED (CYCLE)
            </span>
            <div className="w-7 h-7 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              ₹1,45,000
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold w-fit">
            <span>12 Active Advances</span>
            <span className="text-slate-400 font-normal">across 6 depts</span>
          </div>
        </div>

        {/* Card 2: Deductions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              DEDUCTIONS (OCT PAYROLL)
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-black text-blue-600 tracking-tight">
              ₹48,500
            </div>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>To be auto-deducted at cycle cut</span>
          </div>
        </div>

        {/* Card 3: Remaining Advance Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              REMAINING ADVANCE BALANCE
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              ₹96,500
            </div>
          </div>
          <div className="text-[11px] text-slate-500">
            Deferred to Nov &amp; Dec 2024
          </div>
        </div>

        {/* Card 4: Disbursement Distribution Donut */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <PieChart className="w-3.5 h-3.5 text-slate-400" />
              DISBURSEMENT DISTRIBUTION
            </span>
            <span className="text-[10px] font-mono text-slate-400">OCT-24</span>
          </div>

          <div className="flex items-center justify-between gap-2 my-1">
            {/* Circular Progress Mock */}
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                <circle 
                  cx="18" 
                  cy="18" 
                  r="14" 
                  fill="none" 
                  stroke="#0080ff" 
                  strokeWidth="4" 
                  strokeDasharray="88" 
                  strokeDashoffset="28" 
                  strokeLinecap="round" 
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[10px] font-mono font-bold text-slate-800 leading-tight">
                <span>67%</span>
                <span className="text-[8px] text-slate-400">ACTIVE</span>
              </div>
            </div>

            {/* Breakdown Legend */}
            <div className="space-y-1 text-[10px] text-slate-600 font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                <span>2-Mo: ₹80k (55%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span>1-Mo: ₹45k (31%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-300" />
                <span>3-Mo: ₹20k (14%)</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 font-mono">
            Cycle Health: Reconciled
          </div>
        </div>
      </div>

      {/* Table Card: Active Advance Register & Amortization */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Active Advance Register &amp; Amortization
              </h2>
              <p className="text-xs text-slate-500">
                Direct payroll amortization schedule per individual employee.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search employee or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-56"
              />
            </div>

            <button
              type="button"
              className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              title="Filter"
            >
              <Filter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => alert('Downloading Advance Register CSV...')}
              className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              title="Export Register"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table Data */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 border-collapse min-w-[850px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">EMPLOYEE</th>
                <th className="py-3 px-4">TOTAL ADVANCE</th>
                <th className="py-3 px-4">NEXT DEDUCTION</th>
                <th className="py-3 px-4">REPAYMENT PROGRESS</th>
                <th className="py-3 px-4">BALANCE</th>
                <th className="py-3 px-4">APPROVAL</th>
                <th className="py-3 px-4">CYCLE IMPACT</th>
                <th className="py-3 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAdvances.map((adv) => (
                <tr key={adv.id} className="hover:bg-slate-50/60 transition-colors">
                  {/* Employee */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={adv.avatar}
                        alt={adv.name}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200"
                      />
                      <div>
                        <div className="font-bold text-slate-900">{adv.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {adv.empCode} • {adv.dept}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Total Advance */}
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    ₹{adv.totalAdvance.toLocaleString('en-IN')}
                  </td>

                  {/* Next Deduction */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-blue-600">
                      ₹{adv.nextDeduction.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {adv.instalmentText}
                    </div>
                  </td>

                  {/* Repayment Progress Bar */}
                  <td className="py-3.5 px-4">
                    <div className="w-32">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span>{adv.progressText}</span>
                        <span className="font-bold">{adv.progressPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#0080ff] rounded-full transition-all"
                          style={{ width: `${adv.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Balance */}
                  <td className="py-3.5 px-4 font-bold text-slate-800">
                    ₹{adv.balance.toLocaleString('en-IN')}
                  </td>

                  {/* Approval Status Badge */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {adv.approvalType === 'active' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono font-bold text-[10px] border border-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        {adv.approval}
                      </span>
                    )}
                    {adv.approvalType === 'completed' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-mono font-bold text-[10px] border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {adv.approval}
                      </span>
                    )}
                    {adv.approvalType === 'pending' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono font-bold text-[10px] border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        {adv.approval}
                      </span>
                    )}
                  </td>

                  {/* Cycle Impact */}
                  <td className="py-3.5 px-4 text-[11px] text-slate-600 font-medium">
                    {adv.cycleImpact}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openSlip(adv)}
                        className="text-blue-600 hover:text-blue-800 font-bold text-xs hover:underline cursor-pointer"
                      >
                        Slip
                      </button>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Showing {filteredAdvances.length} of 12 active entries
          </div>

          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              className="px-2.5 py-1 border border-slate-200 rounded text-[11px] font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              disabled
            >
              Previous
            </button>
            <span className="px-2.5 py-1 text-slate-600 font-mono font-bold text-[11px]">
              Page 1 of 3
            </span>
            <button
              type="button"
              className="px-2.5 py-1 border border-slate-200 rounded text-[11px] font-bold hover:bg-slate-50 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Issue Salary Advance */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-blue-600" />
                Issue Salary Advance
              </h3>
              <button 
                type="button" 
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleIssueAdvance} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Employee Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Marcus Vance"
                  value={newAdvance.employeeName}
                  onChange={(e) => setNewAdvance({ ...newAdvance, employeeName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Employee Code
                  </label>
                  <input
                    type="text"
                    placeholder="EMP-1049"
                    value={newAdvance.empCode}
                    onChange={(e) => setNewAdvance({ ...newAdvance, empCode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <select
                    value={newAdvance.department}
                    onChange={(e) => setNewAdvance({ ...newAdvance, department: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Tactical Sec">Tactical Sec</option>
                    <option value="Node Eng">Node Eng</option>
                    <option value="Compliance">Compliance</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Advance Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="25000"
                    value={newAdvance.amount}
                    onChange={(e) => setNewAdvance({ ...newAdvance, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Installment Months
                  </label>
                  <select
                    value={newAdvance.installments}
                    onChange={(e) => setNewAdvance({ ...newAdvance, installments: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value={1}>1 Month (100%)</option>
                    <option value={2}>2 Months (50%/mo)</option>
                    <option value={3}>3 Months (33%/mo)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reason / Approval Reference
                </label>
                <textarea
                  rows="2"
                  placeholder="Medical urgency / Family support"
                  value={newAdvance.reason}
                  onChange={(e) => setNewAdvance({ ...newAdvance, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0052cc] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Authorize Advance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Advance Slip Preview */}
      {slipModalOpen && selectedSlip && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">ARGUS ADVANCE RECEIPT</span>
              <button 
                type="button" 
                onClick={() => setSlipModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="text-center">
                <div className="text-xl font-black text-slate-900">
                  ₹{selectedSlip.totalAdvance.toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-slate-500 font-medium">Disbursed Salary Advance</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Employee:</span>
                  <span className="font-bold text-slate-800">{selectedSlip.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Badge ID:</span>
                  <span className="font-mono text-slate-800">{selectedSlip.empCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Next Deduction:</span>
                  <span className="font-bold text-blue-600">₹{selectedSlip.nextDeduction.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Remaining Balance:</span>
                  <span className="font-bold text-slate-900">₹{selectedSlip.balance.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-bold text-emerald-700">{selectedSlip.approval}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                alert('Printing official Advance Slip...');
                setSlipModalOpen(false);
              }}
              className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-xs cursor-pointer"
            >
              Print Official Slip
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
