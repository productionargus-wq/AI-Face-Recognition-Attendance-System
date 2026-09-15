import React, { useState } from 'react';
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
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const ManualEntry = () => {
  const { user } = useAuth();
  const [filterTab, setFilterTab] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [submittedMessage, setSubmittedMessage] = useState('');

  const [formData, setFormData] = useState({
    employee: 'Marcus Vance (EMP-1049) — Tactical Security Operations',
    logDate: '2024-10-26',
    shift: 'General Shift (09:00 AM – 05:30 PM • 8.5h)',
    punchIn: '09:00',
    punchOut: '17:30',
    reason: 'Hardware Incident: Biometric Terminal 04 Unresponsive',
    confirmed: true
  });

  const [records, setRecords] = useState([
    {
      id: 'OVR-101',
      name: 'Marcus Vance',
      empCode: 'EMP-1049',
      dept: 'Tactical Sec',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      date: '26 Oct 2024',
      punchIn: '08:52 AM',
      punchOut: '05:15 PM',
      hours: '8.4 hrs',
      reason: 'Forgot Face Scan',
      authorizedBy: 'Dir. S. Jenkins\nToday 10:14 AM',
      status: 'Approved & Synced',
      statusType: 'success'
    },
    {
      id: 'OVR-102',
      name: 'Priya Ramanathan',
      empCode: 'EMP-1052',
      dept: 'Data Gov',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80',
      date: '25 Oct 2024',
      punchIn: '09:12 AM',
      punchOut: '06:45 PM',
      hours: '9.5 hrs',
      reason: 'On-site Field Duty',
      authorizedBy: 'SecOps Controller #02\n25 Oct 07:10 PM',
      status: 'Approved & Synced',
      statusType: 'success'
    },
    {
      id: 'OVR-103',
      name: 'Devraj Anand',
      empCode: 'EMP-1088',
      dept: 'Node Eng',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
      date: '25 Oct 2024',
      punchIn: '07:45 AM',
      punchOut: '04:00 PM',
      hours: '8.2 hrs',
      reason: 'Kiosk Calibration',
      authorizedBy: 'Dir. S. Jenkins\n25 Oct 04:30 PM',
      status: 'Pending Audit',
      statusType: 'pending'
    },
    {
      id: 'OVR-104',
      name: 'Ananya Sharma',
      empCode: 'EMP-1090',
      dept: 'Compliance',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80',
      date: '24 Oct 2024',
      punchIn: '09:05 AM',
      punchOut: '05:35 PM',
      hours: '8.5 hrs',
      reason: 'Biometric Kiosk Offline',
      authorizedBy: 'SecOps Central Auto\n24 Oct 08:00 PM',
      status: 'Approved & Synced',
      statusType: 'success'
    }
  ]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.confirmed) {
      alert('Please confirm the compliance protocol before submitting.');
      return;
    }

    const newRecord = {
      id: `OVR-${Date.now().toString().slice(-4)}`,
      name: formData.employee.split(' (')[0],
      empCode: formData.employee.includes('(') ? formData.employee.split('(')[1].split(')')[0] : 'EMP-2024',
      dept: 'Operations',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80',
      date: new Date(formData.logDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      punchIn: formData.punchIn + ' AM',
      punchOut: formData.punchOut + ' PM',
      hours: '8.5 hrs',
      reason: formData.reason.split(':')[0],
      authorizedBy: `${user?.name || 'Admin'}\nJust now`,
      status: 'Approved & Synced',
      statusType: 'success'
    };

    setRecords([newRecord, ...records]);
    setSubmittedMessage('Attendance punch override verified and synced to ledger.');
    setTimeout(() => setSubmittedMessage(''), 4000);
  };

  const handleClear = () => {
    setFormData({
      employee: 'Marcus Vance (EMP-1049) — Tactical Security Operations',
      logDate: new Date().toISOString().split('T')[0],
      shift: 'General Shift (09:00 AM – 05:30 PM • 8.5h)',
      punchIn: '09:00',
      punchOut: '17:30',
      reason: 'Hardware Incident: Biometric Terminal 04 Unresponsive',
      confirmed: false
    });
  };

  const handleDelete = (id) => {
    setRecords(records.filter(r => r.id !== id));
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.empCode.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterTab === 'Pending Audit') return matchesSearch && r.statusType === 'pending';
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
            Authoritative punch correction and biometric audit override ledger.
          </p>
        </div>

        <button
          type="button"
          onClick={() => alert('Exporting override logs to CSV...')}
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
              Employee Identification &amp; Selection
            </label>
            <select
              value={formData.employee}
              onChange={(e) => setFormData({ ...formData, employee: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Marcus Vance (EMP-1049) — Tactical Security Operations">Marcus Vance (EMP-1049) — Tactical Security Operations</option>
              <option value="Priya Ramanathan (EMP-1052) — Data Governance & Quality">Priya Ramanathan (EMP-1052) — Data Governance & Quality</option>
              <option value="Devraj Anand (EMP-1088) — Node Engineering Systems">Devraj Anand (EMP-1088) — Node Engineering Systems</option>
              <option value="Ananya Sharma (EMP-1090) — Compliance & Audit">Ananya Sharma (EMP-1090) — Compliance & Audit</option>
            </select>
          </div>

          {/* Row: Date & Shift */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Log Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={formData.logDate}
                  onChange={(e) => setFormData({ ...formData, logDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Duty Shift Assignment
              </label>
              <select
                value={formData.shift}
                onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="General Shift (09:00 AM – 05:30 PM • 8.5h)">General Shift (09:00 AM – 05:30 PM • 8.5h)</option>
                <option value="Morning Shift (06:00 AM – 02:30 PM • 8.5h)">Morning Shift (06:00 AM – 02:30 PM • 8.5h)</option>
                <option value="Night Shift (09:00 PM – 05:30 AM • 8.5h)">Night Shift (09:00 PM – 05:30 AM • 8.5h)</option>
              </select>
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
                value={formData.punchOut}
                onChange={(e) => setFormData({ ...formData, punchOut: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Justification dropdown */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Justification / Exception Reason
            </label>
            <select
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Hardware Incident: Biometric Terminal 04 Unresponsive">Hardware Incident: Biometric Terminal 04 Unresponsive</option>
              <option value="On-site Field Duty: Client Facility Deployment">On-site Field Duty: Client Facility Deployment</option>
              <option value="Forgot Face Scan: Verified by Floor Supervisor">Forgot Face Scan: Verified by Floor Supervisor</option>
              <option value="Kiosk Calibration: Scheduled Sensor Maintenance">Kiosk Calibration: Scheduled Sensor Maintenance</option>
              <option value="Network Disconnection: Offline Terminal Cache Failure">Network Disconnection: Offline Terminal Cache Failure</option>
            </select>
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
              className="px-5 py-2.5 rounded-xl bg-[#0052cc] hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Submit &amp; Verify Punch
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
              Audit log of authoritative punch adjustments.
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
                <th className="py-3 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50/60 transition-colors">
                  {/* Employee */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={record.avatar}
                        alt={record.name}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200"
                      />
                      <div>
                        <div className="font-bold text-slate-900">{record.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {record.empCode} • {record.dept}
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
                    {record.punchIn}
                  </td>

                  {/* Punch Out */}
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                    {record.punchOut}
                  </td>

                  {/* Total Hours */}
                  <td className="py-3.5 px-4">
                    <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-bold text-[11px] border border-blue-200">
                      {record.hours}
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
                    {record.authorizedBy}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {record.statusType === 'success' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-mono font-bold text-[10px] border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {record.status}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono font-bold text-[10px] border border-indigo-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        {record.status}
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1 text-slate-400">
                      <button
                        type="button"
                        onClick={() => alert(`Editing adjustment for ${record.name}`)}
                        className="p-1 hover:text-slate-700 rounded cursor-pointer"
                        title="Edit Record"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(record.id)}
                        className="p-1 hover:text-red-600 rounded cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>Showing {filteredRecords.length} of 148 override transactions</span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="text-emerald-700 font-medium">Cryptographic Hash Sync: Synchronous</span>
          </div>

          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              className="px-2.5 py-1 border border-slate-200 rounded text-[11px] font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              disabled
            >
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
    </div>
  );
};
