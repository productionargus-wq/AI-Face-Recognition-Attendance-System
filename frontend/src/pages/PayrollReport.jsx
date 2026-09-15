import React, { useState } from 'react';
import { 
  CreditCard, 
  Download, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Award, 
  Banknote, 
  ShieldCheck, 
  Printer, 
  Send, 
  FileSpreadsheet, 
  ArrowUpRight, 
  TrendingUp, 
  AlertCircle,
  UserCheck
} from 'lucide-react';

export const PayrollReport = () => {
  const [selectedEmployee, setSelectedEmployee] = useState('EMP-1049');
  const [activeFilter, setActiveFilter] = useState('All');
  const [payoutApproved, setPayoutApproved] = useState(false);

  const dailyLogs = [
    {
      date: 'Oct 25, 2024',
      day: 'Friday',
      in: '08:52 AM',
      out: '05:08 PM',
      hours: '8.0 hrs',
      status: 'On-Time',
      statusType: 'ontime',
      remark: 'Standard shift completed.'
    },
    {
      date: 'Oct 24, 2024',
      day: 'Thursday',
      in: '08:48 AM',
      out: '07:30 PM',
      hours: '10.5 hrs',
      status: 'Overtime (+2.5 hrs)',
      statusType: 'overtime',
      remark: 'Evening tactical briefing cover. Overtime credited.'
    },
    {
      date: 'Oct 23, 2024',
      day: 'Wednesday',
      in: '08:55 AM',
      out: '05:00 PM',
      hours: '8.0 hrs',
      status: 'On-Time',
      statusType: 'ontime',
      remark: 'Standard shift completed.'
    },
    {
      date: 'Oct 22, 2024',
      day: 'Tuesday',
      in: '08:45 AM',
      out: '06:45 PM',
      hours: '9.5 hrs',
      status: 'Overtime (+1.5 hrs)',
      statusType: 'overtime',
      remark: 'Escort duty assistance. Overtime credited.'
    },
    {
      date: 'Oct 21, 2024',
      day: 'Monday',
      in: '--:--',
      out: '--:--',
      hours: '0.0 hrs',
      status: 'Paid Leave (PL)',
      statusType: 'leave',
      remark: 'Approved by HR: 100% Salary Protected (No Loss of Pay). Advance Installment #1 applied.'
    },
    {
      date: 'Oct 18, 2024',
      day: 'Friday',
      in: '07:54 AM',
      out: '04:30 PM',
      hours: '8.0 hrs',
      status: 'On-Time',
      statusType: 'ontime',
      remark: 'Standard shift completed.'
    }
  ];

  const filteredLogs = dailyLogs.filter(log => {
    if (activeFilter === 'Paid Leaves') return log.statusType === 'leave';
    if (activeFilter === 'Overtime') return log.statusType === 'overtime';
    return true;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Employee Payroll &amp; Attendance Report
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono font-bold text-[11px] border border-emerald-200">
              October 2024
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Comprehensive audit, overtime calculations, statutory deductions, and payslip generation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Cycle: Oct 01 - Oct 31, 2024</span>
          </div>
          
          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-200">
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&auto=format&fit=crop&q=80"
              alt="Director"
              className="w-8 h-8 rounded-full object-cover border border-slate-200"
            />
            <div className="text-left">
              <div className="text-xs font-bold text-slate-800">Director Sarah Jenkins</div>
              <div className="text-[10px] text-slate-400 font-mono">Chief Executive Officer</div>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Selector & Profile Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80"
            alt="Marcus Vance"
            className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-2xs"
          />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-extrabold text-slate-900">
                Marcus Vance
              </h2>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-bold text-[10px] border border-blue-200">
                EMP-1049
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-bold text-[10px] border border-emerald-200">
                Full-Time Staff
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Tactical Security Department</span>
              <span>•</span>
              <span>Base Hourly: <span className="font-bold text-slate-800">₹250 / hr</span></span>
              <span>•</span>
              <span>Manager: <span className="font-bold text-slate-800">D. Sterling</span></span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
          >
            <option value="EMP-1049">Marcus Vance (EMP-1049)</option>
            <option value="EMP-1052">Priya Ramanathan (EMP-1052)</option>
            <option value="EMP-1088">Devraj Anand (EMP-1088)</option>
            <option value="EMP-1090">Ananya Sharma (EMP-1090)</option>
          </select>

          <button
            type="button"
            onClick={() => alert('Exporting monthly attendance CSV...')}
            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-[#0052cc] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download Monthly Report
          </button>
        </div>
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Attendance & Leaves */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              ATTENDANCE &amp; LEAVES
            </span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="my-2">
            <div className="text-xl font-black text-slate-900 tracking-tight">
              21 <span className="text-xs font-medium text-slate-500">Present / 22 Days</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-mono border-t border-slate-100 pt-1 flex justify-between">
            <span className="text-emerald-700 font-bold">1 Paid Leave</span>
            <span>Logged: 168.0 hrs</span>
          </div>
        </div>

        {/* Card 2: Performance Score */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              PERFORMANCE SCORE
            </span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="my-2">
            <div className="text-xl font-black text-slate-900 tracking-tight">
              4.8 <span className="text-xs font-medium text-amber-600 font-bold">/ 5.0 (Tier 1)</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-mono border-t border-slate-100 pt-1 flex justify-between">
            <span className="text-blue-600 font-bold">+₹2,500 Bonus</span>
            <span>On-Time: 95.5%</span>
          </div>
        </div>

        {/* Card 3: Approved Overtime */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              APPROVED OVERTIME
            </span>
            <Clock className="w-4 h-4 text-teal-600" />
          </div>
          <div className="my-2">
            <div className="text-xl font-black text-teal-700 tracking-tight">
              +12.5 <span className="text-xs font-medium text-slate-500">Extra Hours</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-mono border-t border-slate-100 pt-1 flex justify-between">
            <span>Rate 1.5x</span>
            <span className="text-teal-700 font-bold">+₹4,688 Extra</span>
          </div>
        </div>

        {/* Card 4: Advance Recovery */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              ADVANCE RECOVERY
            </span>
            <Banknote className="w-4 h-4 text-red-500" />
          </div>
          <div className="my-2">
            <div className="text-xl font-black text-red-600 tracking-tight">
              -₹7,500 <span className="text-xs font-medium text-slate-500">Deducted</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-mono border-t border-slate-100 pt-1 flex justify-between">
            <span>1 of 2 Tenures</span>
            <span className="text-slate-600 font-bold">₹7,500 pending</span>
          </div>
        </div>

        {/* Card 5: Total Net Salary (Featured) */}
        <div className="bg-[#0052cc] text-white p-4 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-200">
              TOTAL NET SALARY
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white/20 text-white text-[9px] font-bold font-mono">
              Ready for Pay
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black tracking-tight">
              ₹36,688
            </div>
          </div>
          <div className="text-[10px] text-blue-100 font-mono border-t border-white/20 pt-1 flex justify-between">
            <span>Base + OT - PF - Adv</span>
            <span className="font-bold text-emerald-300">Direct Deposit</span>
          </div>
        </div>
      </div>

      {/* Monthly Salary Calculation Breakdown Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">
                Monthly Salary Calculation Breakdown
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Clear transparent itemization of gross earnings, authorized advance repayments, protected leaves, and net disbursable pay.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              Print Payslip
            </button>

            <button
              type="button"
              onClick={() => setPayoutApproved(true)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-xs cursor-pointer transition-all ${
                payoutApproved ? 'bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {payoutApproved ? 'Payout Authorized' : 'Approve & Authorize Payout'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 items-start">
          {/* Left Columns: Earnings & Entitlements + Deductions */}
          <div className="lg:col-span-8 space-y-6">
            {/* Section 1: Earnings */}
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3">
                EARNINGS &amp; ENTITLEMENTS
              </h3>
              <div className="space-y-2.5">
                <div className="p-3.5 bg-slate-50/70 border border-slate-100 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Base Salary Hours</div>
                    <div className="text-[10px] text-slate-400 font-mono">160.0 standard logged hours</div>
                  </div>
                  <div className="text-sm font-bold text-slate-900 font-mono">₹40,000</div>
                </div>

                <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-emerald-900">Approved Overtime (+12.5 hrs)</div>
                    <div className="text-[10px] text-emerald-700 font-mono">Extra 1.5x multiplier (₹375 / hr)</div>
                  </div>
                  <div className="text-sm font-bold text-emerald-700 font-mono">+₹4,688</div>
                </div>

                <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-blue-900">Performance &amp; Punctuality Bonus</div>
                    <div className="text-[10px] text-blue-700 font-mono">Attendance score 95.5% + zero security incident record</div>
                  </div>
                  <div className="text-sm font-bold text-blue-700 font-mono">+₹2,500</div>
                </div>

                <div className="p-3.5 bg-slate-50/70 border border-slate-100 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Approved Paid Leave (1 Day PL)</div>
                    <div className="text-[10px] text-slate-400 font-mono">Oct 21 Paid Leave sanctioned &amp; 100% salary protected</div>
                  </div>
                  <div className="text-sm font-bold text-slate-600 font-mono">₹0 Deduction</div>
                </div>
              </div>
            </div>

            {/* Section 2: Deductions & Recoveries */}
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3">
                DEDUCTIONS &amp; RECOVERIES
              </h3>
              <div className="space-y-2.5">
                <div className="p-3.5 bg-red-50/40 border border-red-100 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-red-900">Advance Salary Installment Recovery</div>
                    <div className="text-[10px] text-red-700 font-mono">Advance cumulative normalisation (1 of 2 Total sanctioned ₹15,000)</div>
                  </div>
                  <div className="text-sm font-bold text-red-600 font-mono">-₹7,500</div>
                </div>

                <div className="p-3.5 bg-slate-50/70 border border-slate-100 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Unpaid Absence / Loss of Pay (LOP)</div>
                    <div className="text-[10px] text-slate-400 font-mono">0 unapproved absent days recorded this billing cycle</div>
                  </div>
                  <div className="text-sm font-bold text-slate-600 font-mono">₹0</div>
                </div>

                <div className="p-3.5 bg-slate-50/70 border border-slate-100 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Statutory Deductions (PF &amp; Taxes)</div>
                    <div className="text-[10px] text-slate-400 font-mono">Provident Fund (PF: ₹2,400) + Professional Tax (₹600)</div>
                  </div>
                  <div className="text-sm font-bold text-red-600 font-mono">-₹3,000</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: PAYROLL SUMMARY TICKET */}
          <div className="lg:col-span-4 bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600">
                PAYROLL SUMMARY TICKET
              </span>
              <span className="text-[10px] font-mono text-slate-400">EMP-1049</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Gross Base Pay:</span>
                <span className="font-mono font-bold text-slate-800">₹40,000.00</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Overtime (+12.5 hrs):</span>
                <span className="font-mono font-bold">+₹4,687.50</span>
              </div>
              <div className="flex justify-between text-blue-700">
                <span>Performance Incentive:</span>
                <span className="font-mono font-bold">+₹2,500.00</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2">
                <span>Total Gross Payable:</span>
                <span className="font-mono">₹47,187.50</span>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <div className="flex justify-between text-red-600">
                  <span>Advance Salary Recovery:</span>
                  <span className="font-mono font-bold">-₹7,500.00</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Taxes &amp; PF Deductions:</span>
                  <span className="font-mono font-bold">-₹3,000.00</span>
                </div>
                <div className="flex justify-between font-bold text-slate-700">
                  <span>Total Deductions:</span>
                  <span className="font-mono text-red-600">-₹10,500.00</span>
                </div>
              </div>
            </div>

            {/* Formula Math Box */}
            <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-center text-[10px] font-mono text-slate-500">
              ( ₹40k + ₹4.68k + ₹2.5k ) - ( ₹7.5k + ₹3k )
            </div>

            {/* Net Take-Home Highlight Card */}
            <div className="p-4 bg-white border-2 border-blue-500/80 rounded-xl shadow-xs text-center">
              <div className="text-[10px] font-mono uppercase font-bold text-slate-400">
                Net Take-Home
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                ₹36,687.50
              </div>
              <div className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Ready for Disbursement on Oct 31
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Attendance & Shift Performance Log */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Daily Attendance &amp; Shift Performance Log
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Biometric facial terminal punches verified for Marcus Vance (October 2024)
            </p>
          </div>

          {/* Filter Pills */}
          <div className="inline-flex rounded-lg p-0.5 bg-slate-100 text-xs font-semibold text-slate-600">
            {['All', 'Paid Leaves', 'Overtime'].map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  activeFilter === filter ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Table Viewport */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">DATE</th>
                <th className="py-3 px-4">DAY</th>
                <th className="py-3 px-4">BIOMETRIC PUNCH-IN</th>
                <th className="py-3 px-4">BIOMETRIC PUNCH-OUT</th>
                <th className="py-3 px-4">HOURS LOGGED</th>
                <th className="py-3 px-4">ATTENDANCE STATUS</th>
                <th className="py-3 px-4">DAILY PERFORMANCE / SHIFT REMARK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                    {log.date}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {log.day}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                    {log.in}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                    {log.out}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {log.hours}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {log.statusType === 'ontime' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-mono font-bold text-[10px] border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {log.status}
                      </span>
                    )}
                    {log.statusType === 'overtime' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono font-bold text-[10px] border border-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        {log.status}
                      </span>
                    )}
                    {log.statusType === 'leave' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-mono font-bold text-[10px] border border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {log.status}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 text-[11px]">
                    {log.remark}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>Showing recent {filteredLogs.length} of 22 working shifts</span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 font-bold">Total Attendance Compliance: 98.2%</span>
          </div>

          <div className="inline-flex items-center gap-1">
            <button type="button" className="px-2.5 py-1 border border-slate-200 rounded text-[11px] font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50" disabled>
              Previous
            </button>
            <button type="button" className="px-2.5 py-1 bg-blue-600 text-white rounded text-[11px] font-bold">
              1
            </button>
            <button type="button" className="px-2.5 py-1 border border-slate-200 rounded text-[11px] font-bold hover:bg-slate-50 cursor-pointer">
              2
            </button>
            <button type="button" className="px-2.5 py-1 border border-slate-200 rounded text-[11px] font-bold hover:bg-slate-50 cursor-pointer">
              3
            </button>
            <button type="button" className="px-2.5 py-1 border border-slate-200 rounded text-[11px] font-bold hover:bg-slate-50 cursor-pointer">
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Dispatch Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">
              Direct Employee Dispatch
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Send verified timecard &amp; salary report directly to Marcus Vance's portal.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => alert('Sending salary report email copy to employee...')}
            className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-2xs cursor-pointer"
          >
            Email Copy to Employee
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-[#0052cc] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Full Monthly Report
          </button>
        </div>
      </div>
    </div>
  );
};
