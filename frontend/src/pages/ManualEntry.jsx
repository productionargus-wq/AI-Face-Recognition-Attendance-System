import React, { useState, useEffect } from 'react';
import { 
  FileEdit, 
  Download, 
  ShieldCheck, 
  Clock, 
  Calendar, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  Lock,
  ArrowDownLeft,
  ArrowUpRight,
  UserPlus,
  Inbox
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export const ManualEntry = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filterTab, setFilterTab] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [submittedMessage, setSubmittedMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [formData, setFormData] = useState({
    employeeId: '',
    logDate: new Date().toISOString().split('T')[0],
    shift: 'General Shift (09:00 AM – 05:30 PM • 8.5h)',
    shiftStart: '09:00',
    shiftEnd: '17:30',
    punchIn: '09:00',
    punchOut: '17:30',
    reason: 'Hardware Incident: Biometric Terminal 04 Unresponsive',
    confirmed: true
  });

  const formatTime12h = (time24) => {
    if (!time24) return '';
    try {
      const [h, m] = time24.split(':').map(Number);
      const suffix = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
    } catch {
      return time24;
    }
  };

  const calculateHours = (inTime, outTime) => {
    if (!inTime || !outTime) return 8.5;
    try {
      const [h1, m1] = inTime.split(':').map(Number);
      const [h2, m2] = outTime.split(':').map(Number);
      let diffMins = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diffMins < 0) diffMins += 24 * 60; // Overnight
      return Math.round((diffMins / 60) * 10) / 10;
    } catch {
      return 8.5;
    }
  };

  const computedHours = calculateHours(formData.punchIn, formData.punchOut);
  const scheduledHours = calculateHours(formData.shiftStart, formData.shiftEnd);

  const handleShiftPresetChange = (preset) => {
    let start = '09:00';
    let end = '17:30';
    if (preset.includes('Morning')) {
      start = '06:00';
      end = '14:30';
    } else if (preset.includes('Evening')) {
      start = '14:00';
      end = '22:30';
    } else if (preset.includes('Night')) {
      start = '21:00';
      end = '05:30';
    } else if (preset.includes('General')) {
      start = '09:00';
      end = '17:30';
    } else if (preset.includes('Entered')) {
      start = formData.punchIn;
      end = formData.punchOut;
    }
    const hrs = calculateHours(start, end);
    const label = preset.includes('Entered') 
      ? `Custom Shift (${formatTime12h(start)} – ${formatTime12h(end)} • ${hrs}h)`
      : `${preset.split('(')[0].trim()} (${formatTime12h(start)} – ${formatTime12h(end)} • ${hrs}h)`;
    setFormData(prev => ({
      ...prev,
      shift: label,
      shiftStart: start,
      shiftEnd: end
    }));
  };

  const handleCustomShiftTimeChange = (type, val) => {
    const start = type === 'start' ? val : formData.shiftStart;
    const end = type === 'end' ? val : formData.shiftEnd;
    const hrs = calculateHours(start, end);
    const formatted = `Custom Shift (${formatTime12h(start)} – ${formatTime12h(end)} • ${hrs}h)`;
    setFormData(prev => ({
      ...prev,
      [type === 'start' ? 'shiftStart' : 'shiftEnd']: val,
      shift: formatted
    }));
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [empRes, ovrRes] = await Promise.all([
        api.get('/employees/').catch(() => ({ data: [] })),
        api.get('/attendance/manual').catch(() => ({ data: [] }))
      ]);

      setEmployees(empRes.data || []);
      if (empRes.data && empRes.data.length > 0) {
        const first = empRes.data[0];
        setFormData(prev => ({
          ...prev,
          employeeId: first.id,
          shift: first.assigned_shift || prev.shift,
          shiftStart: first.shift_start || prev.shiftStart,
          shiftEnd: first.shift_end || prev.shiftEnd
        }));
      }
      setRecords(ovrRes.data || []);
    } catch (err) {
      console.error('Failed to load manual entry data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.employeeId) {
      setErrorMessage('Please select an employee first. If no employees are enrolled, add them under Biometric Enrollment.');
      return;
    }
    if (!formData.confirmed) {
      setErrorMessage('Please confirm the compliance protocol before submitting.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      const hoursToSave = calculateHours(formData.punchIn, formData.punchOut);
      const res = await api.post('/attendance/manual', {
        employee_id: formData.employeeId,
        log_date: formData.logDate,
        shift: formData.shift || dynamicEnteredShift,
        punch_in: formData.punchIn,
        punch_out: formData.punchOut,
        reason: formData.reason,
        hours: hoursToSave
      });

      setRecords(prev => [res.data, ...prev]);
      setSubmittedMessage('Attendance punch override verified and synced to ledger in database.');
      setTimeout(() => setSubmittedMessage(''), 4000);
    } catch (err) {
      setErrorMessage(err.response?.data?.detail || 'Failed to submit manual override.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    setFormData({
      employeeId: employees.length > 0 ? employees[0].id : '',
      logDate: new Date().toISOString().split('T')[0],
      shift: 'General Shift (09:00 AM – 05:30 PM • 8.5h)',
      shiftStart: '09:00',
      shiftEnd: '17:30',
      punchIn: '09:00',
      punchOut: '17:30',
      reason: 'Hardware Incident: Biometric Terminal 04 Unresponsive',
      confirmed: false
    });
  };

  const filteredRecords = records.filter(r => {
    const name = r.employee_name || r.name || '';
    const code = r.employee_code || r.empCode || '';
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          code.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterTab === 'Pending Audit') return matchesSearch && (r.status_type === 'pending' || r.statusType === 'pending');
    return matchesSearch;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Manual Attendance Entry
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-mono font-bold">
              <Lock className="w-3 h-3 text-slate-500" />
              ADMIN OVERRIDE CONSOLE
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative punch correction and biometric audit override ledger for your enrolled workforce.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (records.length === 0) {
              alert('No manual override records to export yet.');
              return;
            }
            window.open(api.defaults.baseURL + '/reports/export-csv', '_blank');
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-all self-start sm:self-auto cursor-pointer"
        >
          <Download className="w-4 h-4 text-slate-500" />
          Export Logs
        </button>
      </div>

      {submittedMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{submittedMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* No Employees Notice */}
      {!loading && employees.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-amber-900">No employees enrolled in your organisation yet</div>
              <div className="text-[11px] text-amber-700">Enroll your workforce to enable facial recognition and manual punch corrections.</div>
            </div>
          </div>
          <Link
            to="/enrollment"
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs whitespace-nowrap self-start sm:self-auto"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Enroll First Employee
          </Link>
        </div>
      )}

      {/* Form Card: New Override Record */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-7">
        <div className="flex items-center gap-2.5 mb-6 pb-3 border-b border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
            <FileEdit className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            New Override Record
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee dropdown */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Employee Identification &amp; Selection *
            </label>
            {employees.length > 0 ? (
              <select
                required
                value={formData.employeeId}
                onChange={(e) => {
                  const empId = e.target.value;
                  const selectedEmp = employees.find(emp => emp.id === empId);
                  setFormData(prev => ({
                    ...prev,
                    employeeId: empId,
                    shift: selectedEmp?.assigned_shift || prev.shift,
                    shiftStart: selectedEmp?.shift_start || prev.shiftStart,
                    shiftEnd: selectedEmp?.shift_end || prev.shiftEnd
                  }));
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.employee_code || 'EMP'}) — {emp.department || 'General'}
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full px-3.5 py-2.5 bg-slate-100 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 flex items-center justify-between">
                <span>No enrolled employees found.</span>
                <Link to="/enrollment" className="font-bold text-blue-600 hover:underline">
                  + Enroll Employee
                </Link>
              </div>
            )}
          </div>

          {/* Row: Date & Shift */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Log Date
              </label>
              <input
                type="date"
                required
                value={formData.logDate}
                onChange={(e) => setFormData({ ...formData, logDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Duty Shift Assignment
                </label>
                <span className="text-[10px] text-blue-600 font-bold font-mono">
                  {scheduledHours} hrs scheduled
                </span>
              </div>
              
              <div className="space-y-2">
                <select
                  value={formData.shift}
                  onChange={(e) => handleShiftPresetChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value={`Custom Shift (${formatTime12h(formData.shiftStart)} – ${formatTime12h(formData.shiftEnd)} • ${scheduledHours}h)`}>
                    ⏱️ Custom Shift ({formatTime12h(formData.shiftStart)} – ${formatTime12h(formData.shiftEnd)} • ${scheduledHours}h)
                  </option>
                  <option value={`Custom Shift (${formatTime12h(formData.punchIn)} – ${formatTime12h(formData.punchOut)} • ${computedHours}h)`}>
                    🔄 Match Punch Timings ({formatTime12h(formData.punchIn)} – {formatTime12h(formData.punchOut)} • ${computedHours}h)
                  </option>
                  <option value="General Shift (09:00 AM – 05:30 PM • 8.5h)">General Shift (09:00 AM – 05:30 PM • 8.5h)</option>
                  <option value="Morning Shift (06:00 AM – 02:30 PM • 8.5h)">Morning Shift (06:00 AM – 02:30 PM • 8.5h)</option>
                  <option value="Evening Shift (02:00 PM – 10:30 PM • 8.5h)">Evening Shift (02:00 PM – 10:30 PM • 8.5h)</option>
                  <option value="Night Shift (09:00 PM – 05:30 AM • 8.5h)">Night Shift (09:00 PM – 05:30 AM • 8.5h)</option>
                  <option value="Flexible Shift (8.0h)">Flexible Shift (8.0h)</option>
                </select>

                {/* Explicit Shift Timing Pickers */}
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-blue-50/40 rounded-xl border border-blue-100">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                      Shift Start Time
                    </label>
                    <input
                      type="time"
                      value={formData.shiftStart}
                      onChange={(e) => handleCustomShiftTimeChange('start', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                      Shift End Time
                    </label>
                    <input
                      type="time"
                      value={formData.shiftEnd}
                      onChange={(e) => handleCustomShiftTimeChange('end', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formData.shift}
                    onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                    placeholder="Custom shift description or working hours..."
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 pointer-events-none">
                    EDITABLE
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Row: Punch-In & Punch-Out */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5 text-emerald-700">
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                Punch-In
              </label>
              <input
                type="time"
                required
                value={formData.punchIn}
                onChange={(e) => setFormData({ ...formData, punchIn: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5 text-blue-700">
                <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                Punch-Out
              </label>
              <input
                type="time"
                required
                value={formData.punchOut}
                onChange={(e) => setFormData({ ...formData, punchOut: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Justification dropdown & custom text */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Justification / Exception Reason
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                Select preset or type custom reason
              </span>
            </div>

            <div className="space-y-2">
              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="Hardware Incident: Biometric Terminal 04 Unresponsive">Hardware Incident: Biometric Terminal 04 Unresponsive</option>
                <option value="On-site Field Duty: Client Facility Deployment">On-site Field Duty: Client Facility Deployment</option>
                <option value="Forgot Face Scan: Verified by Floor Supervisor">Forgot Face Scan: Verified by Floor Supervisor</option>
                <option value="Kiosk Calibration: Scheduled Sensor Maintenance">Kiosk Calibration: Scheduled Sensor Maintenance</option>
                <option value="Network Disconnection: Offline Terminal Cache Failure">Network Disconnection: Offline Terminal Cache Failure</option>
                <option value="Official External Client Meeting / Field Visit">Official External Client Meeting / Field Visit</option>
                <option value="Approved Manager Overtime Permission">Approved Manager Overtime Permission</option>
              </select>

              <div className="relative">
                <input
                  type="text"
                  required
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Type custom justification or exception reason..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 pointer-events-none">
                  EDITABLE
                </span>
              </div>
            </div>
          </div>

          {/* Compliance Checkbox */}
          <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl flex items-start gap-3">
            <input
              type="checkbox"
              id="compliance-check"
              checked={formData.confirmed}
              onChange={(e) => setFormData({ ...formData, confirmed: e.target.checked })}
              className="mt-1 w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="compliance-check" className="text-xs text-slate-700 leading-relaxed cursor-pointer">
              I confirm that this attendance override adheres to regulatory protocol. Overriding this entry will directly calculate into the final monthly remuneration ledger in Indian Rupee (<span className="font-bold">₹ INR</span>) and notify the biometric governance compliance committee.
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Clear Form
            </button>
            <button
              type="submit"
              disabled={submitting || employees.length === 0}
              className="px-5 py-2.5 rounded-xl bg-[#0052cc] hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? 'Verifying & Syncing...' : 'Submit & Verify Punch'}
            </button>
          </div>
        </form>
      </div>

      {/* Table Card: Recent Manual Attendance Adjustments */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Recent Manual Attendance Adjustments
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live audit log of authoritative punch adjustments for your organisation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search employee or badge..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-56"
              />
            </div>

            {/* Filter Pills */}
            <div className="inline-flex rounded-lg p-0.5 bg-slate-100 text-xs font-semibold text-slate-600">
              {['All', 'Today', 'This Week', 'Pending Audit'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterTab(tab)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                    filterTab === tab ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              Filter
            </button>
          </div>
        </div>

        {/* Table Viewport */}
        <div className="overflow-x-auto">
          {filteredRecords.length > 0 ? (
            <table className="w-full text-left text-xs text-slate-600 border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">EMPLOYEE &amp; ID</th>
                  <th className="py-3 px-4">DATE</th>
                  <th className="py-3 px-4">PUNCH-IN</th>
                  <th className="py-3 px-4">PUNCH-OUT</th>
                  <th className="py-3 px-4">TOTAL HOURS</th>
                  <th className="py-3 px-4">OVERRIDE REASON</th>
                  <th className="py-3 px-4">AUTHORIZED BY</th>
                  <th className="py-3 px-4">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((record) => {
                  const empName = record.employee_name || record.name || 'Employee';
                  const empCode = record.employee_code || record.empCode || 'EMP';
                  const dept = record.department || record.dept || 'Operations';
                  const initials = empName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();

                  return (
                    <tr key={record.id} className="hover:bg-slate-50/60 transition-colors">
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

                      {/* Date */}
                      <td className="py-3.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                        {record.date}
                      </td>

                      {/* Punch In */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                        {record.punch_in || record.punchIn}
                      </td>

                      {/* Punch Out */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                        {record.punch_out || record.punchOut}
                      </td>

                      {/* Total Hours */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-bold text-[11px] border border-blue-200">
                          {record.hours || '8.5 hrs'}
                        </span>
                      </td>

                      {/* Reason */}
                      <td className="py-3.5 px-4">
                        <span className="flex items-center gap-1.5 font-medium text-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          {record.reason}
                        </span>
                      </td>

                      {/* Authorized By */}
                      <td className="py-3.5 px-4 text-[11px] leading-tight text-slate-700 whitespace-pre-line font-medium">
                        {record.authorized_by || record.authorizedBy || 'System Admin'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-mono font-bold text-[10px] border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {record.status || 'Approved & Synced'}
                        </span>
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
                No manual override records found
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Any manual attendance adjustments submitted above will appear here in your organisation's audit ledger.
              </p>
            </div>
          )}
        </div>

        {/* Table Footer */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>Showing {filteredRecords.length} override records</span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="text-emerald-700 font-medium">Cryptographic Hash Sync: Synchronous</span>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            Tenant Partitioned Storage
          </div>
        </div>
      </div>
    </div>
  );
};
