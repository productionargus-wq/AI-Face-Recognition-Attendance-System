import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { EnrollEmployeeModal } from '../components/EnrollEmployeeModal';
import { 
  Users, 
  UserCheck, 
  Clock, 
  AlertTriangle, 
  Download, 
  Plus, 
  Search, 
  Building2, 
  Calendar, 
  FileSpreadsheet, 
  ShieldAlert, 
  CheckCircle2,
  Trash2,
  Edit2,
  Filter,
  BarChart3,
  TrendingUp,
  X
} from 'lucide-react';

export const AdminDashboard = () => {
  const { organization } = useAuth();
  const [timeRange, setTimeRange] = useState('TODAY'); // 'TODAY', 'WEEKLY', 'MONTHLY'
  const [selectedDept, setSelectedDept] = useState('All Departments');
  const [searchQuery, setSearchQuery] = useState('');

  const [todayData, setTodayData] = useState({ summary: {}, records: [] });
  const [employees, setEmployees] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [attRes, empRes] = await Promise.all([
        api.get('/attendance/today'),
        api.get('/employees/')
      ]);
      setTodayData(attRes.data);
      setEmployees(empRes.data);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    window.open(api.defaults.baseURL + '/reports/export-csv', '_blank');
  };

  const handleExportExcel = () => {
    window.open(api.defaults.baseURL + '/reports/export-excel', '_blank');
  };

  const handleDeleteEmployee = async (empId) => {
    if (!window.confirm('Revoke access and remove this employee?')) return;
    try {
      await api.delete(`/employees/${empId}`);
      fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to remove employee');
    }
  };

  // Real metrics computation (no mock fallbacks)
  const totalEmployees = todayData.summary?.total_employees ?? employees.length ?? 0;
  const totalRoster = totalEmployees;
  const presentCount = todayData.summary?.present ?? 0;
  const lateCount = todayData.summary?.late ?? 0;
  const absentCount = todayData.summary?.absent ?? Math.max(0, totalRoster - presentCount);

  const presentRate = totalRoster > 0 ? ((presentCount / totalRoster) * 100).toFixed(1) : '0.0';
  const onTimeRate = totalRoster > 0 ? (((presentCount - lateCount) / totalRoster) * 100).toFixed(1) : '0.0';
  const lateRate = totalRoster > 0 ? ((lateCount / totalRoster) * 100).toFixed(1) : '0.0';
  const absentRate = totalRoster > 0 ? ((absentCount / totalRoster) * 100).toFixed(1) : '0.0';

  // Live records only
  const records = todayData.records || [];

  // Filtering records by department & search
  const filteredRecords = records.filter(r => {
    const matchesDept = selectedDept === 'All Departments' || r.department?.toLowerCase() === selectedDept.toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesQuery = !query || 
      r.employee_name?.toLowerCase().includes(query) || 
      r.employee_code?.toLowerCase().includes(query) ||
      r.department?.toLowerCase().includes(query);
    return matchesDept && matchesQuery;
  });

  // Dynamic department attendance ratios based on actual enrolled employees
  const departmentStats = React.useMemo(() => {
    if (!employees || employees.length === 0) return [];
    const deptMap = {};
    employees.forEach(emp => {
      const dept = emp.department || 'General';
      if (!deptMap[dept]) deptMap[dept] = { total: 0, present: 0 };
      deptMap[dept].total += 1;
    });
    records.forEach(rec => {
      const dept = rec.department || 'General';
      if (deptMap[dept]) deptMap[dept].present += 1;
    });
    return Object.entries(deptMap).map(([dept, data]) => {
      const pct = data.total > 0 ? Math.round((data.present / data.total) * 100) : 0;
      return { dept, present: data.present, total: data.total, pct };
    });
  }, [employees, records]);

  return (
    <div className="space-y-6">
      {/* Top Banner Header: Title + Export (Matches Image 1) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">
              ANALYTICS ATTENDANCE DASHBOARD
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Real-time biometric workforce tracking & compliance ratios
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setIsModalOpen(true)}
            className="py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>CSV EXPORT</span>
          </button>
        </div>
      </div>

      {/* 4 Stat Cards Row (Matches Image 1) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Workforce */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              TOTAL WORKFORCE
            </span>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-3xl font-black text-slate-900">{presentCount}</span>
            <span className="text-xs text-slate-400 font-semibold">/ {totalRoster}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-semibold mb-2">
            <span className="text-emerald-700 font-bold">{presentCount} Active today</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-mono font-bold">
              {presentRate}% Rate
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${presentRate}%` }} />
          </div>
        </div>

        {/* Card 2: On-Time Arrivals */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              ON-TIME ARRIVALS
            </span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-3xl font-black text-emerald-600">{presentCount - lateCount}</span>
            <span className="text-xs text-slate-400 font-semibold">/ {presentCount}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-semibold mb-2">
            <span className="text-slate-500">Punctual Check-ins</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-mono font-bold">
              {onTimeRate}% Rate
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${onTimeRate}%` }} />
          </div>
        </div>

        {/* Card 3: Late Arrivals */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              LATE ARRIVALS
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-3xl font-black text-amber-500">{lateCount}</span>
            <span className="text-xs text-slate-400 font-semibold">/ {presentCount}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-semibold mb-2">
            <span className="text-slate-500">Grace Exceeded</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-mono font-bold">
              {lateRate}% Rate
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${lateRate}%` }} />
          </div>
        </div>

        {/* Card 4: Absent / On Leave */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              ABSENT / ON LEAVE
            </span>
            <Calendar className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-3xl font-black text-red-500">{absentCount}</span>
            <span className="text-xs text-slate-400 font-semibold">/ {totalRoster}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-semibold mb-2">
            <span className="text-slate-500">Unaccounted / Off</span>
            <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-mono font-bold">
              {absentRate}% Rate
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-red-500 h-full rounded-full" style={{ width: `${absentRate}%` }} />
          </div>
        </div>
      </div>

      {/* Filter Toolbar (Matches Image 1) */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Range Pills & Department Dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Time Range Pills */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase">
            <span>RANGE:</span>
            <div className="inline-flex bg-slate-100 p-0.5 rounded-lg">
              {['TODAY', 'WEEKLY', 'MONTHLY'].map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    timeRange === range
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {/* Department Select Dropdown */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase">
            <span>DEPT:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="All Departments">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="R&D Lab">R&D Lab</option>
              <option value="Operations">Operations</option>
              <option value="Field Ops">Field Ops</option>
              <option value="Product Dev">Product Dev</option>
            </select>
          </div>
        </div>

        {/* Right: Search Input + Clear */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, biometric ID, or badge..."
            className="w-full md:w-80 pl-9 pr-14 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-[10px] font-bold font-mono text-slate-400 hover:text-slate-700 bg-slate-200/70 px-1.5 py-0.5 rounded cursor-pointer"
            >
              CLEAR
            </button>
          )}
        </div>
      </div>

      {/* Main Attendance Data Table (Matches Image 1) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 min-w-[700px]">
            <thead className="bg-slate-50/80 text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5">EMPLOYEE & ID</th>
                <th className="p-3.5">PUNCH-IN</th>
                <th className="p-3.5">PUNCH-OUT</th>
                <th className="p-3.5">DEPT</th>
                <th className="p-3.5">SHIFT STATUS</th>
                <th className="p-3.5">STATUS</th>
                <th className="p-3.5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Clock className="w-8 h-8 text-slate-300 stroke-1" />
                      <p className="text-xs font-bold text-slate-600">
                        No attendance records logged for today.
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-sm">
                        Live punches from the attendance kiosk will appear here in real-time as employees verify their face.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Employee & ID */}
                  <td className="p-3.5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {rec.avatar_init || rec.employee_name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{rec.employee_name}</div>
                      <div className="text-[10px] font-mono text-slate-400 font-semibold">{rec.employee_code}</div>
                    </div>
                  </td>

                  {/* Punch In */}
                  <td className="p-3.5 font-mono text-xs font-bold text-blue-600">
                    {rec.check_in_time || (rec.check_in ? (typeof rec.check_in === 'string' && rec.check_in.includes('T') ? new Date(rec.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : rec.check_in) : '—')}
                  </td>

                  {/* Punch Out */}
                  <td className="p-3.5 font-mono text-xs text-slate-700">
                    {rec.check_out_time || (rec.check_out ? (
                      typeof rec.check_out === 'string' && rec.check_out.includes('T')
                        ? new Date(rec.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : rec.check_out
                    ) : (
                      rec.status === 'PRESENT' ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold font-mono">
                          ACTIVE (IN SHIFT)
                        </span>
                      ) : '—'
                    ))}
                  </td>

                  {/* Dept */}
                  <td className="p-3.5 text-xs text-slate-700">
                    {rec.department}
                  </td>

                  {/* Shift Status */}
                  <td className="p-3.5">
                    {rec.shift_status === 'ON-TIME' ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-mono font-bold">
                        ON-TIME
                      </span>
                    ) : rec.shift_status?.includes('LATE') ? (
                      <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-mono font-bold">
                        {rec.shift_status}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="p-3.5">
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${
                      rec.status === 'PRESENT' 
                        ? 'bg-emerald-50/60 border-emerald-300 text-emerald-800' 
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                      {rec.status}
                    </span>
                  </td>

                  {/* Action Icons */}
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-2 text-slate-400">
                      <button className="hover:text-blue-600 p-1 cursor-pointer">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteEmployee(rec.id)} 
                        className="hover:text-red-600 p-1 cursor-pointer"
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

        {/* Table Pagination Footer */}
        <div className="border-t border-slate-100 p-3.5 flex items-center justify-between text-xs text-slate-500 font-medium">
          <div>
            Showing <strong className="text-slate-800">1 to {filteredRecords.length}</strong> of {totalEmployees} punch logs
          </div>
          <div className="flex items-center gap-1 font-mono text-[11px]">
            <button className="px-2.5 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 cursor-pointer">
              PREVIOUS
            </button>
            <button className="px-2.5 py-1 bg-blue-600 text-white rounded font-bold">
              1
            </button>
            <button className="px-2.5 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 cursor-pointer">
              2
            </button>
            <button className="px-2.5 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 cursor-pointer">
              3
            </button>
            <button className="px-2.5 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 cursor-pointer">
              NEXT
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Analytics Breakdown Panel: Department Attendance Ratios (Matches Image 1) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            DEPARTMENT ATTENDANCE RATIOS
          </div>
          <div className="text-xs font-mono font-bold text-slate-700">
            OVERALL ATTENDANCE: <span className="text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">{presentCount}/{totalRoster} Total ({presentRate}%)</span>
          </div>
        </div>

        {departmentStats.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            No departments or employees registered yet. Enrolled department attendance ratios will appear here automatically.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-semibold text-slate-700">
            {departmentStats.map((ds) => (
              <div key={ds.dept} className="space-y-1.5">
                <div className="flex justify-between">
                  <span>{ds.dept}</span>
                  <span className="font-mono text-blue-600 font-bold">
                    {ds.present}/{ds.total} ({ds.pct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full rounded-full transition-all duration-300" 
                    style={{ width: `${ds.pct}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EnrollEmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEmployeeCreated={() => {
          fetchDashboardData();
        }}
      />
    </div>
  );
};
