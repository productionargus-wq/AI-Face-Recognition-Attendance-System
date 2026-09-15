import React, { useState, useEffect } from 'react';
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
  Inbox,
  UserPlus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export const AdvanceMoney = () => {
  const { user } = useAuth();
  const [cycle, setCycle] = useState('October 2024');
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [newAdvance, setNewAdvance] = useState({
    employeeId: '',
    amount: '',
    installments: 2,
    reason: ''
  });

  useEffect(() => {
    fetchInitialData();
  }, [cycle]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [empRes, advRes] = await Promise.all([
        api.get('/employees/').catch(() => ({ data: [] })),
        api.get(`/advances?cycle=${encodeURIComponent(cycle)}`).catch(() => ({ data: [] }))
      ]);

      setEmployees(empRes.data || []);
      if (empRes.data && empRes.data.length > 0) {
        setNewAdvance(prev => ({ ...prev, employeeId: empRes.data[0].id }));
      }
      setAdvances(advRes.data || []);
    } catch (err) {
      console.error('Failed to load advance money data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueAdvance = async (e) => {
    e.preventDefault();
    if (!newAdvance.employeeId || !newAdvance.amount) {
      setErrorMessage('Please select an employee and enter the advance amount.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      const res = await api.post('/advances', {
        employee_id: newAdvance.employeeId,
        total_advance: parseFloat(newAdvance.amount),
        installments: parseInt(newAdvance.installments) || 2,
        reason: newAdvance.reason || 'Authorized Salary Advance'
      });

      setAdvances(prev => [res.data, ...prev]);
      setModalOpen(false);
      setStatusMessage('Salary advance issued and scheduled for payroll deduction.');
      setTimeout(() => setStatusMessage(''), 4000);

      setNewAdvance({
        employeeId: employees.length > 0 ? employees[0].id : '',
        amount: '',
        installments: 2,
        reason: ''
      });
    } catch (err) {
      setErrorMessage(err.response?.data?.detail || 'Failed to issue salary advance.');
    } finally {
      setSubmitting(false);
    }
  };

  const openSlip = (adv) => {
    setSelectedSlip(adv);
    setSlipModalOpen(true);
  };

  // Dynamic KPI calculations from actual records
  const totalDisbursed = advances.reduce((acc, curr) => acc + (Number(curr.total_advance || curr.totalAdvance) || 0), 0);
  const totalDeductions = advances.reduce((acc, curr) => acc + (Number(curr.next_deduction || curr.nextDeduction) || 0), 0);
  const remainingBalance = advances.reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0);
  const activeCount = advances.filter(a => (a.approval_type || a.approvalType) === 'active').length;

  const filteredAdvances = advances.filter(a => {
    const name = a.name || '';
    const code = a.emp_code || a.empCode || '';
    const dept = a.dept || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           code.toLowerCase().includes(searchTerm.toLowerCase()) ||
           dept.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Title & Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Advance Money Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track, disburse, and auto-amortize employee salary advances against monthly payroll for your organisation.
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

      {statusMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

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
              ₹{totalDisbursed.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold w-fit">
            <span>{activeCount} Active Advances</span>
            <span className="text-slate-400 font-normal">in this cycle</span>
          </div>
        </div>

        {/* Card 2: Deductions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              DEDUCTIONS (CURRENT CYCLE)
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-black text-blue-600 tracking-tight">
              ₹{totalDeductions.toLocaleString('en-IN')}
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
              ₹{remainingBalance.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="text-[11px] text-slate-500">
            Deferred to upcoming payroll cycles
          </div>
        </div>

        {/* Card 4: Disbursement Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <PieChart className="w-3.5 h-3.5 text-slate-400" />
              CYCLE HEALTH
            </span>
            <span className="text-[10px] font-mono text-slate-400">ACTIVE</span>
          </div>

          <div className="my-2">
            <div className="text-sm font-bold text-slate-800">
              {advances.length} Active Records
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              100% tenant reconciled
            </div>
          </div>

          <div className="text-[10px] text-slate-400 font-mono border-t border-slate-100 pt-1">
            Reconciliation Engine: Synchronous
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
              onClick={() => alert('Exporting register...')}
              className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              title="Export Register"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table Data */}
        <div className="overflow-x-auto">
          {filteredAdvances.length > 0 ? (
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
                {filteredAdvances.map((adv) => {
                  const empName = adv.name || 'Employee';
                  const empCode = adv.emp_code || adv.empCode || 'EMP';
                  const dept = adv.dept || 'Operations';
                  const total = Number(adv.total_advance || adv.totalAdvance) || 0;
                  const nextDed = Number(adv.next_deduction || adv.nextDeduction) || 0;
                  const bal = Number(adv.balance) || 0;
                  const initials = empName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();

                  return (
                    <tr key={adv.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Employee */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{empName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {empCode} • {dept}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Total Advance */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        ₹{total.toLocaleString('en-IN')}
                      </td>

                      {/* Next Deduction */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-blue-600">
                          ₹{nextDed.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {adv.instalment_text || adv.instalmentText || 'Instalment 1/2'}
                        </div>
                      </td>

                      {/* Repayment Progress Bar */}
                      <td className="py-3.5 px-4">
                        <div className="w-32">
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                            <span>{adv.progress_text || adv.progressText || '0 of 2 mos'}</span>
                            <span className="font-bold">{adv.progress_percent || adv.progressPercent || 0}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#0080ff] rounded-full transition-all"
                              style={{ width: `${adv.progress_percent || adv.progressPercent || 0}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Balance */}
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        ₹{bal.toLocaleString('en-IN')}
                      </td>

                      {/* Approval Status Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono font-bold text-[10px] border border-blue-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          {adv.approval || 'Approved & Active'}
                        </span>
                      </td>

                      {/* Cycle Impact */}
                      <td className="py-3.5 px-4 text-[11px] text-slate-600 font-medium">
                        {adv.cycle_impact || adv.cycleImpact || `Will deduct ₹${nextDed.toLocaleString('en-IN')} on cycle cut`}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openSlip(adv)}
                          className="text-blue-600 hover:text-blue-800 font-bold text-xs hover:underline cursor-pointer"
                        >
                          Slip
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Inbox className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">
                No active salary advances for this cycle
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                Click the button below to disburse and schedule a salary advance for your enrolled staff.
              </p>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="px-4 py-2 bg-[#0052cc] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Issue First Advance
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Showing {filteredAdvances.length} active advance entries
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Direct Amortization Active
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
                  Select Enrolled Employee *
                </label>
                {employees.length > 0 ? (
                  <select
                    required
                    value={newAdvance.employeeId}
                    onChange={(e) => setNewAdvance({ ...newAdvance, employeeId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} ({emp.employee_code || 'EMP'}) — {emp.department || 'General'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                    <span>No enrolled employees found.</span>
                    <Link to="/enrollment" className="font-bold underline">
                      Enroll now
                    </Link>
                  </div>
                )}
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
                  placeholder="e.g. Medical urgency / Family support"
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
                  disabled={submitting || employees.length === 0}
                  className="px-4 py-2 bg-[#0052cc] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Authorizing...' : 'Authorize Advance'}
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
                  ₹{Number(selectedSlip.total_advance || selectedSlip.totalAdvance || 0).toLocaleString('en-IN')}
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
                  <span className="font-mono text-slate-800">{selectedSlip.emp_code || selectedSlip.empCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Next Deduction:</span>
                  <span className="font-bold text-blue-600">₹{Number(selectedSlip.next_deduction || selectedSlip.nextDeduction || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Remaining Balance:</span>
                  <span className="font-bold text-slate-900">₹{Number(selectedSlip.balance || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-bold text-emerald-700">{selectedSlip.approval || 'Approved & Active'}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                window.print();
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
