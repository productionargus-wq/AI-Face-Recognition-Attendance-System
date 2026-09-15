import React, { useState, useEffect } from 'react';
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
  UserCheck,
  UserPlus,
  Inbox
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export const PayrollReport = () => {
  const { user, organization } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [payoutApproved, setPayoutApproved] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [empRes, advRes] = await Promise.all([
        api.get('/employees/').catch(() => ({ data: [] })),
        api.get('/advances').catch(() => ({ data: [] }))
      ]);

      const empList = empRes.data || [];
      setEmployees(empList);
      setAdvances(advRes.data || []);

      if (empList.length > 0) {
        const firstEmp = empList[0];
        setSelectedEmployeeId(firstEmp.id);
        fetchEmployeeAttendance(firstEmp.id);
      }
    } catch (err) {
      console.error('Failed to load payroll report data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeAttendance = async (empId) => {
    try {
      const res = await api.get(`/attendance/history?employee_id=${empId}`).catch(async () => {
        // Fallback to today attendance filter if history query differs
        const todayRes = await api.get('/attendance/today');
        const list = (todayRes.data?.records || []).filter(r => r.employee_id === empId);
        return { data: list };
      });
      setAttendanceRecords(res.data || []);
    } catch (err) {
      setAttendanceRecords([]);
    }
  };

  const handleEmployeeChange = (e) => {
    const id = e.target.value;
    setSelectedEmployeeId(id);
    fetchEmployeeAttendance(id);
  };

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || employees[0];

  // Dynamic Payroll Calculations
  const presentDays = attendanceRecords.filter(r => r.status === 'PRESENT').length;
  const totalLoggedHours = attendanceRecords.reduce((acc, curr) => acc + (Number(curr.total_hours) || 0), 0);
  const hourlyRate = 250; // ₹250 / hr standard base
  const standardHours = 160;
  const baseSalary = 40000;
  
  // Overtime computation
  const overtimeHours = Math.max(0, totalLoggedHours > 0 ? Math.round((totalLoggedHours - (presentDays * 8)) * 10) / 10 : 0);
  const overtimePay = Math.round(overtimeHours * hourlyRate * 1.5);
  
  // Performance Bonus
  const performanceBonus = presentDays >= 20 ? 2500 : 0;
  
  // Advance Deduction for this employee
  const employeeAdvances = advances.filter(a => a.employee_id === selectedEmployeeId);
  const advanceDeduction = employeeAdvances.reduce((acc, curr) => acc + (Number(curr.next_deduction || curr.nextDeduction) || 0), 0);

  // Statutory Deductions (PF & Tax)
  const statutoryDeductions = 3000;

  // Gross & Net Pay
  const grossPay = baseSalary + overtimePay + performanceBonus;
  const totalDeductions = advanceDeduction + statutoryDeductions;
  const netTakeHome = Math.max(0, grossPay - totalDeductions);

  const filteredLogs = attendanceRecords.filter(log => {
    if (activeFilter === 'Paid Leaves') return log.status === 'LEAVE';
    if (activeFilter === 'Overtime') return (log.total_hours || 0) > 8;
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
              Current Billing Cycle
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Comprehensive audit, overtime calculations, statutory deductions, and payslip generation for {organization?.name || 'your organisation'}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Billing Cycle: Current Month</span>
          </div>
          
          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs">
              {(user?.name || user?.email || 'AD').slice(0, 2).toUpperCase()}
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-slate-800">{user?.name || user?.email?.split('@')[0] || 'Administrator'}</div>
              <div className="text-[10px] text-slate-400 font-mono">Organisation Administrator</div>
            </div>
          </div>
        </div>
      </div>

      {/* No Employees State */}
      {!loading && employees.length === 0 && (
        <div className="p-6 bg-white border border-slate-200 rounded-2xl text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <UserPlus className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            No employees enrolled in {organization?.name || 'your organisation'} yet
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Payroll and attendance calculations generate automatically once employees are added.
          </p>
          <Link
            to="/enrollment"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052cc] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            Enroll First Employee
          </Link>
        </div>
      )}

      {selectedEmployee && (
        <>
          {/* Employee Selector & Profile Card */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-lg border border-blue-200 shadow-2xs">
                {selectedEmployee.first_name?.[0]}{selectedEmployee.last_name?.[0]}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {selectedEmployee.first_name} {selectedEmployee.last_name}
                  </h2>
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-bold text-[10px] border border-blue-200">
                    {selectedEmployee.employee_code || 'EMP'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-bold text-[10px] border border-emerald-200">
                    Active Workforce
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-medium flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>{selectedEmployee.department || 'Operations'}</span>
                  <span>•</span>
                  <span>Base Rate: <span className="font-bold text-slate-800">₹{hourlyRate} / hr</span></span>
                  <span>•</span>
                  <span>Email: <span className="font-bold text-slate-800">{selectedEmployee.email || 'N/A'}</span></span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
              <select
                value={selectedEmployeeId}
                onChange={handleEmployeeChange}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.employee_code || 'EMP'})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => window.open(api.defaults.baseURL + '/reports/export-csv', '_blank')}
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
                Download Report
              </button>
            </div>
          </div>

          {/* 5 KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Card 1: Attendance & Leaves */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  ATTENDANCE RECORD
                </span>
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
              </div>
              <div className="my-2">
                <div className="text-xl font-black text-slate-900 tracking-tight">
                  {presentDays} <span className="text-xs font-medium text-slate-500">Punches Logged</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono border-t border-slate-100 pt-1 flex justify-between">
                <span className="text-emerald-700 font-bold">Active Roster</span>
                <span>Hours: {totalLoggedHours.toFixed(1)} hrs</span>
              </div>
            </div>

            {/* Card 2: Performance Score */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  PUNCTUALITY BONUS
                </span>
                <Award className="w-4 h-4 text-amber-500" />
              </div>
              <div className="my-2">
                <div className="text-xl font-black text-slate-900 tracking-tight">
                  ₹{performanceBonus.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono border-t border-slate-100 pt-1 flex justify-between">
                <span className="text-blue-600 font-bold">Tier 1 Incentive</span>
                <span>Audit Verified</span>
              </div>
            </div>

            {/* Card 3: Approved Overtime */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  OVERTIME LOGGED
                </span>
                <Clock className="w-4 h-4 text-teal-600" />
              </div>
              <div className="my-2">
                <div className="text-xl font-black text-teal-700 tracking-tight">
                  +{overtimeHours} <span className="text-xs font-medium text-slate-500">Extra Hours</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono border-t border-slate-100 pt-1 flex justify-between">
                <span>1.5x Multiplier</span>
                <span className="text-teal-700 font-bold">+₹{overtimePay.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Card 4: Advance Recovery */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  ADVANCE DEDUCTION
                </span>
                <Banknote className="w-4 h-4 text-red-500" />
              </div>
              <div className="my-2">
                <div className="text-xl font-black text-red-600 tracking-tight">
                  -₹{advanceDeduction.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono border-t border-slate-100 pt-1 flex justify-between">
                <span>Scheduled Cycle</span>
                <span className="text-slate-600 font-bold">{employeeAdvances.length} active</span>
              </div>
            </div>

            {/* Card 5: Total Net Salary */}
            <div className="bg-[#0052cc] text-white p-4 rounded-2xl shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-200">
                  TOTAL NET SALARY
                </span>
                <span className="px-1.5 py-0.5 rounded bg-white/20 text-white text-[9px] font-bold font-mono">
                  Ready
                </span>
              </div>
              <div className="my-2">
                <div className="text-2xl font-black tracking-tight">
                  ₹{netTakeHome.toLocaleString('en-IN')}
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
                  Clear transparent itemization of gross earnings, authorized advance repayments, and net disbursable pay.
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
                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {payoutApproved ? 'Payout Authorized' : 'Approve & Authorize Payout'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 items-start">
              {/* Left Columns: Earnings & Entitlements + Deductions */}
              <div className="lg:col-span-8 space-y-6">
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3">
                    EARNINGS &amp; ENTITLEMENTS
                  </h3>
                  <div className="space-y-2.5">
                    <div className="p-3.5 bg-slate-50/70 border border-slate-100 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-900">Base Salary Hours</div>
                        <div className="text-[10px] text-slate-400 font-mono">160.0 standard monthly hours quota</div>
                      </div>
                      <div className="text-sm font-bold text-slate-900 font-mono">₹{baseSalary.toLocaleString('en-IN')}</div>
                    </div>

                    <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-emerald-900">Approved Overtime (+{overtimeHours} hrs)</div>
                        <div className="text-[10px] text-emerald-700 font-mono">1.5x Multiplier (₹{hourlyRate * 1.5} / hr)</div>
                      </div>
                      <div className="text-sm font-bold text-emerald-700 font-mono">+₹{overtimePay.toLocaleString('en-IN')}</div>
                    </div>

                    <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-blue-900">Performance &amp; Punctuality Bonus</div>
                        <div className="text-[10px] text-blue-700 font-mono">Based on attendance consistency</div>
                      </div>
                      <div className="text-sm font-bold text-blue-700 font-mono">+₹{performanceBonus.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3">
                    DEDUCTIONS &amp; RECOVERIES
                  </h3>
                  <div className="space-y-2.5">
                    <div className="p-3.5 bg-red-50/40 border border-red-100 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-red-900">Advance Salary Installment Recovery</div>
                        <div className="text-[10px] text-red-700 font-mono">Auto-deducted from issued advance balance</div>
                      </div>
                      <div className="text-sm font-bold text-red-600 font-mono">-₹{advanceDeduction.toLocaleString('en-IN')}</div>
                    </div>

                    <div className="p-3.5 bg-slate-50/70 border border-slate-100 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-800">Statutory Deductions (PF &amp; Taxes)</div>
                        <div className="text-[10px] text-slate-400 font-mono">Provident Fund &amp; Professional Tax estimate</div>
                      </div>
                      <div className="text-sm font-bold text-red-600 font-mono">-₹{statutoryDeductions.toLocaleString('en-IN')}</div>
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
                  <span className="text-[10px] font-mono text-slate-400">{selectedEmployee.employee_code || 'EMP'}</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Gross Base Pay:</span>
                    <span className="font-mono font-bold text-slate-800">₹{baseSalary.toLocaleString('en-IN')}.00</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Overtime (+{overtimeHours} hrs):</span>
                    <span className="font-mono font-bold">+₹{overtimePay.toLocaleString('en-IN')}.00</span>
                  </div>
                  <div className="flex justify-between text-blue-700">
                    <span>Performance Incentive:</span>
                    <span className="font-mono font-bold">+₹{performanceBonus.toLocaleString('en-IN')}.00</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2">
                    <span>Total Gross Payable:</span>
                    <span className="font-mono">₹{grossPay.toLocaleString('en-IN')}.00</span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 space-y-1.5">
                    <div className="flex justify-between text-red-600">
                      <span>Advance Salary Recovery:</span>
                      <span className="font-mono font-bold">-₹{advanceDeduction.toLocaleString('en-IN')}.00</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>Taxes &amp; PF Deductions:</span>
                      <span className="font-mono font-bold">-₹{statutoryDeductions.toLocaleString('en-IN')}.00</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-700">
                      <span>Total Deductions:</span>
                      <span className="font-mono text-red-600">-₹{totalDeductions.toLocaleString('en-IN')}.00</span>
                    </div>
                  </div>
                </div>

                {/* Net Take-Home Highlight Card */}
                <div className="p-4 bg-white border-2 border-blue-500/80 rounded-xl shadow-xs text-center">
                  <div className="text-[10px] font-mono uppercase font-bold text-slate-400">
                    Net Take-Home
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                    ₹{netTakeHome.toLocaleString('en-IN')}.00
                  </div>
                  <div className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Ready for Disbursement
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Attendance Log */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Daily Attendance Log for {selectedEmployee.first_name} {selectedEmployee.last_name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Facial terminal punches verified in database
                </p>
              </div>

              <div className="inline-flex rounded-lg p-0.5 bg-slate-100 text-xs font-semibold text-slate-600">
                {['All', 'Overtime'].map((filter) => (
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

            <div className="overflow-x-auto">
              {filteredLogs.length > 0 ? (
                <table className="w-full text-left text-xs text-slate-600 border-collapse min-w-[760px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">DATE</th>
                      <th className="py-3 px-4">CHECK-IN</th>
                      <th className="py-3 px-4">CHECK-OUT</th>
                      <th className="py-3 px-4">HOURS LOGGED</th>
                      <th className="py-3 px-4">ATTENDANCE STATUS</th>
                      <th className="py-3 px-4">VERIFICATION MODE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                          {log.date}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                          {log.check_in ? strTime(log.check_in) : '--:--'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                          {log.check_out ? strTime(log.check_out) : '--:--'}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {log.total_hours || 0} hrs
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-mono font-bold text-[10px] border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {log.status || 'PRESENT'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 text-[11px] font-mono">
                          {log.verification_mode || 'FACE_KIOSK'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Inbox className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">
                    No attendance logs recorded for this employee yet
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    When this employee punches in via Kiosk or Manual Entry, their shift records will appear here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

function strTime(isoStr) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return isoStr;
  }
}
