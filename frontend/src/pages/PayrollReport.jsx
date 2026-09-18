import React, { useState, useEffect, useMemo } from 'react';
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
  FileSpreadsheet, 
  ArrowUpRight, 
  TrendingUp, 
  AlertCircle,
  UserCheck,
  UserPlus,
  Inbox,
  Search,
  Save,
  RotateCcw,
  Edit3,
  Send,
  FileText,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export const PayrollReport = () => {
  const { user, organization } = useAuth();
  const isEmployee = user?.role === 'employee' || user?.role === 'staff';

  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [payoutApproved, setPayoutApproved] = useState(false);

  // Payout history & slip modal
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [slipModalOpen, setSlipModalOpen] = useState(false);

  // Employee search query
  const [searchQuery, setSearchQuery] = useState('');

  // Compensation structure state
  const [baseSalary, setBaseSalary] = useState(40000);
  const [hourlyRate, setHourlyRate] = useState(250);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [performanceBonus, setPerformanceBonus] = useState(0);
  const [advanceDeduction, setAdvanceDeduction] = useState(0);
  const [statutoryDeductions, setStatutoryDeductions] = useState(3000);

  const [savingPayroll, setSavingPayroll] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');
  const [disbursing, setDisbursing] = useState(false);
  const [payoutSuccess, setPayoutSuccess] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchPayoutHistory = async (empId) => {
    try {
      const url = isEmployee ? '/salary-payouts/history' : `/salary-payouts/history?employee_id=${empId || ''}`;
      const res = await api.get(url);
      setPayoutHistory(res.data || []);
    } catch (e) {
      setPayoutHistory([]);
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      if (isEmployee) {
        // Fetch caller's own employee profile directly
        const [myEmpRes, advRes] = await Promise.all([
          api.get('/employees/me').catch(async () => {
            const fallback = await api.get('/employees/').catch(() => ({ data: [] }));
            return { data: Array.isArray(fallback.data) ? fallback.data[0] : fallback.data };
          }),
          api.get('/advances').catch(() => ({ data: [] }))
        ]);

        let myEmp = myEmpRes.data;
        if (!myEmp && user) {
          const nameParts = (user.name || 'Employee').split(' ');
          myEmp = {
            id: user.employee_id || user.id || 'EMP-ME',
            first_name: nameParts[0] || 'Employee',
            last_name: nameParts.slice(1).join(' ') || '',
            employee_code: user.employee_code || 'EMP',
            email: user.email,
            department: user.department || 'Operations',
            base_salary: 40000,
            hourly_rate: 250,
            statutory_deductions: 3000
          };
        }

        if (myEmp) {
          setEmployees([myEmp]);
          setSelectedEmployeeId(myEmp.id);
          fetchEmployeeAttendance(myEmp.id);
          fetchPayoutHistory(myEmp.id);
        }
        setAdvances(advRes.data || []);
      } else {
        const [empRes, advRes] = await Promise.all([
          api.get('/employees/').catch(() => ({ data: [] })),
          api.get('/advances').catch(() => ({ data: [] }))
        ]);

        const empList = empRes.data || [];
        setEmployees(empList);
        setAdvances(advRes.data || []);

        if (empList.length > 0) {
          const initialEmp = empList[0];
          setSelectedEmployeeId(initialEmp.id);
          fetchEmployeeAttendance(initialEmp.id);
          fetchPayoutHistory(initialEmp.id);
        }
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

  const handleEmployeeSelect = (empId) => {
    setSelectedEmployeeId(empId);
    fetchEmployeeAttendance(empId);
    fetchPayoutHistory(empId);
  };

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || employees[0] || (isEmployee && user ? {
    id: user.employee_id || user.id,
    first_name: (user.name || 'Employee').split(' ')[0],
    last_name: (user.name || '').split(' ').slice(1).join(' '),
    employee_code: user.employee_code || 'EMP',
    email: user.email,
    department: user.department || 'Operations',
    base_salary: 40000,
    hourly_rate: 250,
    statutory_deductions: 3000
  } : null);

  // Synchronize compensation fields whenever the selected employee or attendance data changes
  useEffect(() => {
    if (!selectedEmployee) return;

    const bSalary = selectedEmployee.base_salary != null ? Number(selectedEmployee.base_salary) : 40000;
    const hRate = selectedEmployee.hourly_rate != null ? Number(selectedEmployee.hourly_rate) : 250;
    const statDed = selectedEmployee.statutory_deductions != null ? Number(selectedEmployee.statutory_deductions) : 3000;

    const presentDaysCount = attendanceRecords.filter(r => r.status === 'PRESENT').length;
    const totalHours = attendanceRecords.reduce((acc, curr) => acc + (Number(curr.total_hours) || 0), 0);
    const autoOT = Math.max(0, totalHours > 0 ? Math.round((totalHours - (presentDaysCount * 8)) * 10) / 10 : 0);
    const autoBonus = presentDaysCount >= 20 ? 2500 : 0;

    const empAdvances = advances.filter(a => a.employee_id === selectedEmployee.id);
    const autoAdvance = empAdvances.reduce((acc, curr) => acc + (Number(curr.next_deduction || curr.nextDeduction) || 0), 0);

    setBaseSalary(bSalary);
    setHourlyRate(hRate);
    setStatutoryDeductions(statDed);
    setOvertimeHours(autoOT);
    setPerformanceBonus(autoBonus);
    setAdvanceDeduction(autoAdvance);
    setPayoutApproved(false);
    setSaveSuccess('');
    setSaveError('');
  }, [selectedEmployeeId, attendanceRecords, advances]);

  // Filtered employees based on search input
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const term = searchQuery.toLowerCase();
    return employees.filter(e => 
      `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase().includes(term) ||
      (e.employee_code || '').toLowerCase().includes(term) ||
      (e.department || '').toLowerCase().includes(term) ||
      (e.email || '').toLowerCase().includes(term)
    );
  }, [employees, searchQuery]);

  // Reset editable inputs back to computed defaults
  const handleResetDefaults = () => {
    if (!selectedEmployee) return;
    const bSalary = selectedEmployee.base_salary != null ? Number(selectedEmployee.base_salary) : 40000;
    const hRate = selectedEmployee.hourly_rate != null ? Number(selectedEmployee.hourly_rate) : 250;
    const statDed = selectedEmployee.statutory_deductions != null ? Number(selectedEmployee.statutory_deductions) : 3000;

    const presentDaysCount = attendanceRecords.filter(r => r.status === 'PRESENT').length;
    const totalHours = attendanceRecords.reduce((acc, curr) => acc + (Number(curr.total_hours) || 0), 0);
    const autoOT = Math.max(0, totalHours > 0 ? Math.round((totalHours - (presentDaysCount * 8)) * 10) / 10 : 0);
    const autoBonus = presentDaysCount >= 20 ? 2500 : 0;

    const empAdvances = advances.filter(a => a.employee_id === selectedEmployee.id);
    const autoAdvance = empAdvances.reduce((acc, curr) => acc + (Number(curr.next_deduction || curr.nextDeduction) || 0), 0);

    setBaseSalary(bSalary);
    setHourlyRate(hRate);
    setStatutoryDeductions(statDed);
    setOvertimeHours(autoOT);
    setPerformanceBonus(autoBonus);
    setAdvanceDeduction(autoAdvance);
  };

  // Save current salary structure into database for selected employee
  const handleSavePayrollStructure = async () => {
    if (!selectedEmployee) return;
    setSavingPayroll(true);
    setSaveSuccess('');
    setSaveError('');
    try {
      const payload = {
        base_salary: Number(baseSalary) || 0,
        hourly_rate: Number(hourlyRate) || 0,
        statutory_deductions: Number(statutoryDeductions) || 0
      };
      await api.put(`/employees/${selectedEmployee.id}`, payload);

      // Update in-memory employees array
      setEmployees(prev => prev.map(e => e.id === selectedEmployee.id ? { ...e, ...payload } : e));
      setSaveSuccess(`Payroll compensation settings for ${selectedEmployee.first_name} ${selectedEmployee.last_name} saved to database.`);
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err) {
      setSaveError(err.response?.data?.detail || 'Failed to persist payroll settings to database.');
    } finally {
      setSavingPayroll(false);
    }
  };

  // Attendance stats
  const presentDays = attendanceRecords.filter(r => r.status === 'PRESENT').length;
  const totalLoggedHours = attendanceRecords.reduce((acc, curr) => acc + (Number(curr.total_hours) || 0), 0);
  const paidLeavesCount = attendanceRecords.filter(r => r.status === 'LEAVE').length;

  // Employment Type & Multi-Model Basis
  const empType = selectedEmployee?.employment_type || 'FULL_TIME';

  // Dynamic calculations based on state variables
  const numBaseSalary = Number(baseSalary) || 0;
  const numHourlyRate = Number(hourlyRate) || 0;
  const numOvertimeHours = Number(overtimeHours) || 0;
  const numPerformanceBonus = Number(performanceBonus) || 0;
  const numAdvanceDeduction = Number(advanceDeduction) || 0;
  const numStatutoryDeductions = Number(statutoryDeductions) || 0;

  // Multi-Model Calculation Logic
  let earnedBasePay = numBaseSalary;
  let calculationBasis = '';
  let effectiveHourlyRate = numHourlyRate;
  let effectiveDailyRate = selectedEmployee?.daily_wage_rate || 650;
  let absentDays = 0;
  let lossOfPay = 0;

  if (empType === 'PART_TIME') {
    effectiveHourlyRate = numHourlyRate || (numBaseSalary > 0 ? Math.round(numBaseSalary / 160) : 250);
    earnedBasePay = Math.round(totalLoggedHours * effectiveHourlyRate);
    calculationBasis = `${totalLoggedHours.toFixed(1)} hrs logged × ₹${effectiveHourlyRate}/hr (Hourly Part-Time Basis)`;
  } else if (empType === 'DAILY_WAGE') {
    effectiveDailyRate = selectedEmployee?.daily_wage_rate || (numBaseSalary > 0 ? Math.round(numBaseSalary / 26) : 650);
    earnedBasePay = Math.round(presentDays * effectiveDailyRate);
    calculationBasis = `${presentDays} Days Present × ₹${effectiveDailyRate}/day (Daily Wage Basis)`;
  } else if (empType === 'FIELD_WORKER') {
    earnedBasePay = numBaseSalary;
    calculationBasis = `Field Worker Base Pay: ₹${numBaseSalary.toLocaleString('en-IN')} (Includes designated client project site visits)`;
  } else {
    // FULL_TIME Office Staff (9 AM - 6 PM)
    const standardDays = 26;
    const perDayRate = Math.round(numBaseSalary / standardDays);
    absentDays = Math.max(0, standardDays - presentDays - paidLeavesCount);
    lossOfPay = Math.round(absentDays * perDayRate);
    earnedBasePay = Math.max(0, numBaseSalary - lossOfPay);
    calculationBasis = absentDays > 0 
      ? `Fixed Monthly ₹${numBaseSalary.toLocaleString('en-IN')} (26 days base; -${absentDays} unpaid absent days @ ₹${perDayRate}/day)`
      : `Fixed Monthly ₹${numBaseSalary.toLocaleString('en-IN')} (100% full attendance credit)`;
  }

  const overtimePay = Math.round(numOvertimeHours * (effectiveHourlyRate || 250) * 1.5);
  const grossPay = Math.round(earnedBasePay + overtimePay + numPerformanceBonus);
  const totalDeductions = Math.round(numAdvanceDeduction + numStatutoryDeductions);
  const netTakeHome = Math.max(0, grossPay - totalDeductions);

  const handleDisburseSalary = async () => {
    if (!selectedEmployee) return;
    setDisbursing(true);
    setSaveSuccess('');
    setSaveError('');
    try {
      const currentCycle = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
      const payload = {
        employee_id: selectedEmployee.id,
        cycle: currentCycle,
        amount: netTakeHome,
        base_salary: earnedBasePay,
        overtime_pay: overtimePay,
        performance_bonus: numPerformanceBonus,
        advance_deduction: numAdvanceDeduction,
        statutory_deductions: numStatutoryDeductions,
        net_salary: netTakeHome,
        employment_type: empType,
        calculation_basis: calculationBasis,
        logged_hours: totalLoggedHours,
        hourly_rate: effectiveHourlyRate,
        days_present: presentDays
      };
      await api.post('/notifications/disburse-salary', payload);
      setPayoutSuccess(true);
      setSaveSuccess(`Salary of ₹${netTakeHome.toLocaleString('en-IN')}.00 successfully credited to ${selectedEmployee.first_name} ${selectedEmployee.last_name}. Credit notification dispatched.`);
      fetchPayoutHistory(selectedEmployee.id);
      setTimeout(() => {
        setPayoutSuccess(false);
      }, 5000);
    } catch (err) {
      setSaveError(err.response?.data?.detail || 'Failed to disburse salary.');
    } finally {
      setDisbursing(false);
    }
  };

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
              {isEmployee ? 'My Salary & Payslip Details' : 'Employee Payroll & Attendance Report'}
            </h1>
          </div>
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
              <div className="text-xs font-bold text-slate-800">{user?.name || user?.email?.split('@')[0] || (isEmployee ? 'Employee' : 'Administrator')}</div>
              <div className="text-[10px] text-slate-400 font-mono">{isEmployee ? 'Verified Staff Member' : 'Organisation Administrator'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Success / Error Alerts */}
      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-xs font-bold text-slate-700">Loading payroll &amp; compensation records...</div>
        </div>
      )}

      {/* No Employees State (Admin Only) */}
      {!loading && !isEmployee && employees.length === 0 && (
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
          {/* Employee Search & Selector Card */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Employee Info Header */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-lg border border-blue-200 shadow-2xs shrink-0">
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
                    <span>Department: <span className="font-bold text-slate-800">{selectedEmployee.department || 'Operations'}</span></span>
                    <span>•</span>
                    <span>•</span>
                    <span>Email: <span className="font-bold text-slate-800">{selectedEmployee.email || 'N/A'}</span></span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Export & Print */}
              <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
                {!isEmployee && (
                  <button
                    type="button"
                    onClick={() => window.open(api.defaults.baseURL + '/reports/export-csv', '_blank')}
                    className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                    Export CSV
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#0052cc] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isEmployee ? 'Print Statement' : 'Download Report'}
                </button>
              </div>
            </div>

            {/* Employee Search & Select Control Bar - Admin Only */}
            {!isEmployee && (
              <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                {/* Search input */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search employee by name, code, or department..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Filtered Dropdown */}
                <div className="w-full md:w-80">
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => handleEmployeeSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    {filteredEmployees.length > 0 ? (
                      filteredEmployees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name} ({emp.employee_code || 'EMP'}) — {emp.department || 'General'}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>No matching employees found</option>
                    )}
                  </select>
                </div>

                <div className="text-[11px] text-slate-400 font-mono shrink-0">
                  {filteredEmployees.length} of {employees.length} employees
                </div>
              </div>
            )}
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
                <div className="text-xl font-black text-slate-900 tracking-tight font-mono">
                  ₹{numPerformanceBonus.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono border-t border-slate-100 pt-1 flex justify-between">
                <span className="text-blue-600 font-bold">Incentive</span>
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
                <div className="text-xl font-black text-teal-700 tracking-tight font-mono">
                  +{numOvertimeHours} <span className="text-xs font-medium text-slate-500">Extra Hours</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono border-t border-slate-100 pt-1 flex justify-between">
                <span>1.5x Multiplier</span>
                <span className="text-teal-700 font-bold font-mono">+₹{overtimePay.toLocaleString('en-IN')}</span>
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
                <div className="text-xl font-black text-red-600 tracking-tight font-mono">
                  -₹{numAdvanceDeduction.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono border-t border-slate-100 pt-1 flex justify-between">
                <span>Scheduled Cycle</span>
                <span className="text-slate-600 font-bold">{isEmployee ? 'Amortized' : 'Editable'}</span>
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
                <div className="text-2xl font-black tracking-tight font-mono">
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
              </div>

              {!isEmployee ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    title="Reset to calculated defaults"
                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    Reset
                  </button>

                  <button
                    type="button"
                    onClick={handleSavePayrollStructure}
                    disabled={savingPayroll}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingPayroll ? 'Saving...' : 'Save Settings'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayoutApproved(true)}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {payoutApproved ? 'Payout Authorized' : 'Approve Payout'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Verified Structure
                  </span>
                </div>
              )}
            </div>

            {/* Multi-Model Payroll Calculation Formula Banner */}
            <div className="my-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider ${
                  empType === 'PART_TIME' ? 'bg-blue-100 text-blue-800' :
                  empType === 'DAILY_WAGE' ? 'bg-amber-100 text-amber-900' :
                  empType === 'FIELD_WORKER' ? 'bg-purple-100 text-purple-900' :
                  'bg-emerald-100 text-emerald-800'
                }`}>
                  {empType.replace('_', ' ')} BASIS
                </span>
                <div>
                  <div className="font-bold text-slate-800">
                    Active Calculation Formula: <span className="font-mono text-blue-700">{calculationBasis}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Calculated Base Earned: <strong className="text-slate-800">₹{earnedBasePay.toLocaleString('en-IN')}.00</strong>
                    {absentDays > 0 && empType === 'FULL_TIME' && (
                      <span className="text-red-600 font-medium"> ({absentDays} unpaid absent days prorated deduction)</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] font-mono text-slate-400 block uppercase">Earned Gross Pay</span>
                <span className="text-base font-black font-mono text-slate-900">₹{grossPay.toLocaleString('en-IN')}.00</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2 items-start">
              {/* Left Columns: Earnings & Entitlements + Deductions */}
              <div className="lg:col-span-8 space-y-6">
                {/* Section 1: Earnings & Entitlements */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                      {isEmployee ? 'EARNINGS & ENTITLEMENTS (READ-ONLY)' : 'EARNINGS & ENTITLEMENTS (EDITABLE)'}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {isEmployee ? 'Current active cycle calculation' : 'Live calculation enabled'}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Base Salary */}
                    <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900">Base Monthly Salary (₹)</div>
                        <div className="text-[10px] text-slate-500 font-mono">Standard monthly compensation for 160.0 hours quota</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-500">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          disabled={isEmployee}
                          value={baseSalary}
                          onChange={(e) => setBaseSalary(e.target.value)}
                          className={`w-32 px-2.5 py-1.5 border rounded-lg text-xs font-mono font-bold text-slate-900 text-right ${
                            isEmployee ? 'bg-slate-100 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Hourly Base Rate */}
                    <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900">Standard Hourly Rate (₹/hr)</div>
                        <div className="text-[10px] text-slate-500 font-mono">Used to compute overtime at 1.5x multiplier</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-500">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          disabled={isEmployee}
                          value={hourlyRate}
                          onChange={(e) => setHourlyRate(e.target.value)}
                          className={`w-32 px-2.5 py-1.5 border rounded-lg text-xs font-mono font-bold text-slate-900 text-right ${
                            isEmployee ? 'bg-slate-100 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
                          }`}
                        />
                        <span className="text-[10px] font-mono text-slate-500">/hr</span>
                      </div>
                    </div>

                    {/* Approved Overtime */}
                    <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-emerald-900">Approved Overtime Hours</div>
                        <div className="text-[10px] text-emerald-700 font-mono">
                          1.5x Multiplier = ₹{Math.round(numHourlyRate * 1.5)}/hr • Total: ₹{overtimePay.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          disabled={isEmployee}
                          value={overtimeHours}
                          onChange={(e) => setOvertimeHours(e.target.value)}
                          className={`w-24 px-2.5 py-1.5 border rounded-lg text-xs font-mono font-bold text-emerald-900 text-right ${
                            isEmployee ? 'bg-white/80 border-emerald-200 cursor-not-allowed' : 'bg-white border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500'
                          }`}
                        />
                        <span className="text-[10px] font-mono text-emerald-700">hrs</span>
                        <span className="text-xs font-mono font-bold text-emerald-800 ml-2">
                          +₹{overtimePay.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Performance Bonus */}
                    <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-blue-900">Performance &amp; Punctuality Bonus</div>
                        <div className="text-[10px] text-blue-700 font-mono">Special attendance or milestone reward</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-blue-600">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          disabled={isEmployee}
                          value={performanceBonus}
                          onChange={(e) => setPerformanceBonus(e.target.value)}
                          className={`w-32 px-2.5 py-1.5 border rounded-lg text-xs font-mono font-bold text-blue-900 text-right ${
                            isEmployee ? 'bg-white/80 border-blue-200 cursor-not-allowed' : 'bg-white border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Deductions & Recoveries */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                      {isEmployee ? 'DEDUCTIONS & RECOVERIES (READ-ONLY)' : 'DEDUCTIONS & RECOVERIES (EDITABLE)'}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">Deducted from gross pay</span>
                  </div>

                  <div className="space-y-3">
                    {/* Advance Salary Deduction */}
                    <div className="p-3.5 bg-red-50/40 border border-red-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-red-900">Advance Salary Installment Recovery</div>
                        <div className="text-[10px] text-red-700 font-mono">Auto-scheduled or custom repayment for this billing cycle</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-red-600">-₹</span>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          disabled={isEmployee}
                          value={advanceDeduction}
                          onChange={(e) => setAdvanceDeduction(e.target.value)}
                          className={`w-32 px-2.5 py-1.5 border rounded-lg text-xs font-mono font-bold text-red-900 text-right ${
                            isEmployee ? 'bg-white/80 border-red-200 cursor-not-allowed' : 'bg-white border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Statutory Deductions */}
                    <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-800">Statutory Deductions (PF &amp; Taxes)</div>
                        <div className="text-[10px] text-slate-500 font-mono">Provident Fund, Professional Tax &amp; TDS estimate</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-red-600">-₹</span>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          disabled={isEmployee}
                          value={statutoryDeductions}
                          onChange={(e) => setStatutoryDeductions(e.target.value)}
                          className={`w-32 px-2.5 py-1.5 border rounded-lg text-xs font-mono font-bold text-slate-900 text-right ${
                            isEmployee ? 'bg-slate-100 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
                          }`}
                        />
                      </div>
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
                    <span className="font-mono font-bold text-slate-800">₹{numBaseSalary.toLocaleString('en-IN')}.00</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Overtime (+{numOvertimeHours} hrs):</span>
                    <span className="font-mono font-bold">+₹{overtimePay.toLocaleString('en-IN')}.00</span>
                  </div>
                  <div className="flex justify-between text-blue-700">
                    <span>Performance Incentive:</span>
                    <span className="font-mono font-bold">+₹{numPerformanceBonus.toLocaleString('en-IN')}.00</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2">
                    <span>Total Gross Payable:</span>
                    <span className="font-mono">₹{grossPay.toLocaleString('en-IN')}.00</span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 space-y-1.5">
                    <div className="flex justify-between text-red-600">
                      <span>Advance Salary Recovery:</span>
                      <span className="font-mono font-bold">-₹{numAdvanceDeduction.toLocaleString('en-IN')}.00</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>Taxes &amp; PF Deductions:</span>
                      <span className="font-mono font-bold">-₹{numStatutoryDeductions.toLocaleString('en-IN')}.00</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-700">
                      <span>Total Deductions:</span>
                      <span className="font-mono text-red-600">-₹{totalDeductions.toLocaleString('en-IN')}.00</span>
                    </div>
                  </div>
                </div>

                {/* Net Take-Home Highlight Card */}
                <div className="p-4 bg-white border-2 border-blue-500/80 rounded-xl shadow-xs text-center space-y-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase font-bold text-slate-400">
                      Net Take-Home
                    </div>
                    <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                      ₹{netTakeHome.toLocaleString('en-IN')}.00
                    </div>
                    <div className="text-[10px] text-emerald-600 font-bold mt-0.5 flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {isEmployee ? 'Calculated for Active Period' : 'Ready for Disbursement'}
                    </div>
                  </div>

                  {!isEmployee ? (
                    <>
                      <button
                        type="button"
                        onClick={handleDisburseSalary}
                        disabled={disbursing || payoutSuccess}
                        className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          payoutSuccess
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white active:scale-95 disabled:opacity-75'
                        }`}
                      >
                        {payoutSuccess ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Salary Credited &amp; Notified
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            {disbursing ? 'Processing Credit...' : 'Disburse & Credit Salary'}
                          </>
                        )}
                      </button>

                    </>
                  ) : (
                    <>
                      <div className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center gap-2">
                        <Banknote className="w-4 h-4 text-emerald-600" />
                        <span>Estimated Current Payout</span>
                      </div>

                      <div className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3 text-blue-500" />
                        Direct deposit upon monthly payroll settlement
                      </div>
                    </>
                  )}
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
                          {log.check_in_time || (log.check_in ? strTime(log.check_in) : '--:--')}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                          {log.check_out_time || (log.check_out ? strTime(log.check_out) : '--:--')}
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

          {/* Salary Payout History & Historical Payslips */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    {isEmployee ? 'My Salary Payout History & Official Payslips' : `Disbursed Salary History — ${selectedEmployee.first_name} ${selectedEmployee.last_name}`}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono font-bold text-[10px] border border-blue-200">
                    {payoutHistory.length} records
                  </span>
                </div>
              </div>

              {selectedEmployee && (
                <div className="text-xs text-slate-500 font-mono">
                  Employee Ref: <span className="font-bold text-slate-800">{selectedEmployee.employee_code || 'EMP'}</span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              {payoutHistory.length > 0 ? (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-mono uppercase text-slate-500 font-bold">
                      <th className="py-3 px-4">Payout ID / Date</th>
                      <th className="py-3 px-4">Billing Cycle</th>
                      <th className="py-3 px-4">Gross Earnings</th>
                      <th className="py-3 px-4">Deductions</th>
                      <th className="py-3 px-4">Net Credited Pay</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Official Payslip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payoutHistory.map((payout) => {
                      const gross = Number(payout.base_salary || 0) + Number(payout.overtime_pay || 0) + Number(payout.bonus || 0);
                      const deds = Number(payout.advance_deduction || 0) + Number(payout.statutory_deductions || 0);
                      const net = Number(payout.net_salary != null ? payout.net_salary : (payout.amount || 0));
                      const payDate = payout.disbursed_at || payout.created_at;

                      return (
                        <tr key={payout.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-mono font-bold text-slate-900">{payout.id}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {payDate ? new Date(payDate).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-800 whitespace-nowrap">
                            {payout.cycle || 'Monthly Settlement'}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-mono font-bold text-slate-800">₹{gross.toLocaleString('en-IN')}.00</span>
                            <div className="text-[10px] text-emerald-600 font-mono">Base: ₹{(payout.base_salary || 0).toLocaleString('en-IN')}</div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-mono font-bold text-red-600">-₹{deds.toLocaleString('en-IN')}.00</span>
                            {Number(payout.advance_deduction || 0) > 0 && (
                              <div className="text-[10px] text-red-500 font-mono">Adv: -₹{(payout.advance_deduction || 0).toLocaleString('en-IN')}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-emerald-700 text-sm">
                            ₹{net.toLocaleString('en-IN')}.00
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-mono font-bold text-[10px] border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {payout.status || 'PAID'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSlip(payout);
                                setSlipModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              View Payslip
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
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">
                    No historical salary disbursements on record
                  </h3>
                </div>
              )}
            </div>
          </div>

          {/* Official Printable Payslip Modal */}
          {slipModalOpen && selectedSlip && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in">
              <div className="bg-white w-full max-w-2xl rounded-xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
                {/* Modal Header Bar */}
                <div className="p-3 sm:p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold font-mono tracking-wider uppercase truncate">Official Salary Statement &amp; Payslip</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-2.5 sm:px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Print / PDF</span>
                      <span className="sm:hidden">Print</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSlipModalOpen(false);
                        setSelectedSlip(null);
                      }}
                      className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Printable Payslip Body (Scrollable on mobile) */}
                <div className="p-4 sm:p-8 space-y-5 sm:space-y-6 text-slate-800 bg-white overflow-y-auto flex-1">
                  {/* Header: Company & Title */}
                  <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
                    <div>
                      <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                        {organization?.name || 'Argus Technologies'}
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Automated Biometric Attendance &amp; Workforce Payroll Division
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono mt-1">
                        Registration / Org ID: {organization?.id || 'ARGUS-SYS-01'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-900 font-mono font-bold text-xs uppercase border border-slate-200">
                        CONFIDENTIAL PAYSLIP
                      </span>
                      <div className="text-[11px] font-mono text-slate-500 mt-2">
                        Slip Ref: <span className="font-bold text-slate-800">{selectedSlip.id}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        Cycle: <span className="font-bold text-slate-800">{selectedSlip.cycle || 'Monthly'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Employee & Payout Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <div className="text-[10px] uppercase font-mono font-bold text-slate-400">Employee Name</div>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {selectedSlip.employee_name || `${selectedEmployee.first_name} ${selectedEmployee.last_name}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-mono font-bold text-slate-400">Employee Code</div>
                      <div className="font-mono font-bold text-slate-900 mt-0.5">
                        {selectedSlip.employee_code || selectedEmployee.employee_code || 'EMP'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-mono font-bold text-slate-400">Employment Model</div>
                      <div className="font-bold text-blue-700 mt-0.5">
                        {(selectedSlip.employment_type || selectedEmployee?.employment_type || 'FULL_TIME').replace('_', ' ')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-mono font-bold text-slate-400">Disbursed On</div>
                      <div className="font-mono font-bold text-slate-900 mt-0.5">
                        {selectedSlip.disbursed_at 
                          ? new Date(selectedSlip.disbursed_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
                          : 'Authorized'}
                      </div>
                    </div>
                  </div>

                  {/* Itemized Calculation Basis Callout in Payslip */}
                  {(selectedSlip.calculation_basis || calculationBasis) && (
                    <div className="px-3.5 py-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="text-slate-700">
                        <span className="font-bold text-blue-950">Calculation Formula: </span>
                        <span className="font-mono font-semibold text-blue-800">{selectedSlip.calculation_basis || calculationBasis}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold uppercase text-blue-600 bg-white px-2 py-0.5 rounded border border-blue-200 self-start sm:self-auto">
                        System Verified
                      </span>
                    </div>
                  )}

                  {/* Two Column Table: Earnings vs Deductions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    {/* Earnings Section */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-100 p-2.5 font-bold font-mono text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200 flex justify-between">
                        <span>EARNINGS &amp; INCENTIVES</span>
                        <span>AMOUNT (₹)</span>
                      </div>
                      <div className="divide-y divide-slate-100 p-1">
                        <div className="flex justify-between py-2 px-3">
                          <div>
                            <span className="text-slate-800 font-semibold block">Earned Base / Standard Wages:</span>
                            {(selectedSlip.calculation_basis || calculationBasis) && (
                              <span className="text-[10px] text-slate-400 font-mono block">
                                {selectedSlip.calculation_basis || calculationBasis}
                              </span>
                            )}
                          </div>
                          <span className="font-mono font-bold text-slate-800">
                            ₹{(Number(selectedSlip.base_salary != null ? selectedSlip.base_salary : earnedBasePay) || 0).toLocaleString('en-IN')}.00
                          </span>
                        </div>
                        <div className="flex justify-between py-2 px-3 text-emerald-700">
                          <span>Overtime Compensation:</span>
                          <span className="font-mono font-bold">
                            +₹{(Number(selectedSlip.overtime_pay) || 0).toLocaleString('en-IN')}.00
                          </span>
                        </div>
                        <div className="flex justify-between py-2 px-3 text-blue-700">
                          <span>Performance &amp; Bonus:</span>
                          <span className="font-mono font-bold">
                            +₹{(Number(selectedSlip.bonus) || 0).toLocaleString('en-IN')}.00
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-2.5 border-t border-slate-200 font-bold flex justify-between text-slate-900">
                        <span>Total Gross Earnings:</span>
                        <span className="font-mono">
                          ₹{((Number(selectedSlip.base_salary != null ? selectedSlip.base_salary : earnedBasePay) || 0) + (Number(selectedSlip.overtime_pay) || 0) + (Number(selectedSlip.bonus) || 0)).toLocaleString('en-IN')}.00
                        </span>
                      </div>
                    </div>

                    {/* Deductions Section */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-100 p-2.5 font-bold font-mono text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200 flex justify-between">
                        <span>DEDUCTIONS &amp; RECOVERIES</span>
                        <span>AMOUNT (₹)</span>
                      </div>
                      <div className="divide-y divide-slate-100 p-1">
                        <div className="flex justify-between py-2 px-3 text-red-600">
                          <span>Advance Salary Recovery:</span>
                          <span className="font-mono font-bold">
                            -₹{(Number(selectedSlip.advance_deduction) || 0).toLocaleString('en-IN')}.00
                          </span>
                        </div>
                        <div className="flex justify-between py-2 px-3 text-red-600">
                          <span>Provident Fund &amp; Taxes:</span>
                          <span className="font-mono font-bold">
                            -₹{(Number(selectedSlip.statutory_deductions) || 0).toLocaleString('en-IN')}.00
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-2.5 border-t border-slate-200 font-bold flex justify-between text-slate-900">
                        <span>Total Deductions:</span>
                        <span className="font-mono text-red-600">
                          -₹{((Number(selectedSlip.advance_deduction) || 0) + (Number(selectedSlip.statutory_deductions) || 0)).toLocaleString('en-IN')}.00
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Net Payable Highlight Banner */}
                  <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-emerald-900">
                    <div>
                      <div className="text-[11px] uppercase font-mono font-bold text-emerald-700">NET SALARY DISBURSED TO BANK</div>
                      <div className="text-xs text-emerald-800 font-medium">Direct credit to verified employee salary account</div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-700">
                      ₹{(Number(selectedSlip.net_salary != null ? selectedSlip.net_salary : selectedSlip.amount) || 0).toLocaleString('en-IN')}.00
                    </div>
                  </div>

                  {/* Bottom Verification & Sign-off Footer */}
                  <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[11px] text-slate-500">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 font-semibold text-slate-700">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Digitally Verified by {selectedSlip.disbursed_by || 'Payroll Administrator'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        This document is a system generated payslip powered by Argus Biometrics and does not require a physical seal.
                      </div>
                    </div>
                    <div className="text-right sm:text-right w-full sm:w-auto">
                      <span className="inline-block border-b border-dashed border-slate-400 w-36 mb-1"></span>
                      <div className="text-[10px] uppercase font-mono font-bold text-slate-500">Authorized Signature</div>
                    </div>
                  </div>
                </div>

                {/* Modal Bottom Actions (Print and Close) */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setSlipModalOpen(false);
                      setSelectedSlip(null);
                    }}
                    className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-[#0052cc] hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    Print Official Statement
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

function strTime(isoOrTimeStr) {
  if (!isoOrTimeStr) return '--:--';
  if (typeof isoOrTimeStr === 'string' && !isoOrTimeStr.includes('T')) {
    return isoOrTimeStr;
  }
  try {
    const d = new Date(isoOrTimeStr);
    if (isNaN(d.getTime())) return String(isoOrTimeStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return String(isoOrTimeStr);
  }
}
