import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { EnrollEmployeeModal } from '../components/EnrollEmployeeModal';
import { 
  Users, UserCheck, Clock, AlertTriangle, Download, Plus, Search, 
  Building2, Calendar, FileSpreadsheet, ShieldAlert, CheckCircle2 
} from 'lucide-react';

export const AdminDashboard = () => {
  const { organization } = useAuth();
  const [activeTab, setActiveTab] = useState('attendance');

  const [todayData, setTodayData] = useState({ summary: {}, records: [] });
  const [employees, setEmployees] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [activeTab]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'attendance') {
        const res = await api.get('/attendance/today');
        setTodayData(res.data);
      } else if (activeTab === 'employees') {
        const res = await api.get('/employees/');
        setEmployees(res.data);
      } else if (activeTab === 'audit') {
        const res = await api.get('/organizations/audit-logs');
        setAuditLogs(res.data);
      }
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

  return (
    <div className="min-h-[calc(100vh-4rem)] py-6 sm:py-8 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <span className="text-[11px] sm:text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md uppercase">
            {organization?.name || 'Organization'}
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">Admin Attendance Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Shift: {organization?.work_hours?.start_time || '09:00'} - {organization?.work_hours?.end_time || '18:00'} (Grace: {organization?.work_hours?.late_grace_minutes || 15}m)
          </p>
        </div>

        {/* Action Buttons Responsive Grid */}
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add & Enroll Employee
          </button>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export Excel
            </button>

            <button
              onClick={handleExportCSV}
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Responsive Stat Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="text-[11px] sm:text-xs text-slate-500 font-medium">Total Staff</div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{todayData.summary?.total_employees || employees.length || 0}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="text-[11px] sm:text-xs text-slate-500 font-medium">Present</div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-600">{todayData.summary?.present || 0}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="text-[11px] sm:text-xs text-slate-500 font-medium">Late</div>
            <div className="text-xl sm:text-2xl font-bold text-amber-600">{todayData.summary?.late || 0}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="text-[11px] sm:text-xs text-slate-500 font-medium">Absent</div>
            <div className="text-xl sm:text-2xl font-bold text-slate-700">{todayData.summary?.absent || 0}</div>
          </div>
        </div>
      </div>

      {/* Main Tabs Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 sm:px-6 pt-3 flex items-center gap-4 sm:gap-6 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'attendance'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            Today Feed ({todayData.records?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('employees')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'employees'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Employees ({employees.length})
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'audit'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Audit Logs
          </button>
        </div>

        {activeTab === 'attendance' && (
          <div className="p-3 sm:p-6">
            {todayData.records?.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs sm:text-sm">
                No attendance punches logged yet for today. Use the Kiosk terminal to check in!
              </div>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="w-full text-left text-xs text-slate-600 min-w-[600px]">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Employee</th>
                      <th className="p-3">Code</th>
                      <th className="p-3">Department</th>
                      <th className="p-3">Check In</th>
                      <th className="p-3">Check Out</th>
                      <th className="p-3">Hours</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {todayData.records?.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-semibold text-slate-900 whitespace-nowrap">{rec.employee_name}</td>
                        <td className="p-3 font-mono text-slate-500 whitespace-nowrap">{rec.employee_code}</td>
                        <td className="p-3 whitespace-nowrap">{rec.department}</td>
                        <td className="p-3 text-slate-800 font-medium whitespace-nowrap">
                          {rec.check_in ? new Date(rec.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="p-3 text-slate-800 font-medium whitespace-nowrap">
                          {rec.check_out ? new Date(rec.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                        </td>
                        <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">{rec.total_hours || 0} hrs</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            rec.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' :
                            rec.status === 'LATE' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'employees' && (
          <div className="p-3 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {employees.map((emp) => (
                <div key={emp.id} className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-[10px] text-slate-400 font-bold block">{emp.employee_code}</span>
                    <h4 className="font-bold text-slate-900 text-sm truncate">{emp.first_name} {emp.last_name}</h4>
                    <p className="text-xs text-slate-500 truncate">{emp.designation} • {emp.department}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{emp.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {emp.has_biometric ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Enrolled
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                        Pending Face
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="p-3 sm:p-6 divide-y divide-slate-100">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-bold text-[10px]">
                    {log.action}
                  </span>
                  <div>
                    <span className="font-semibold text-slate-800">{log.actor_name}</span>
                    <span className="text-slate-500"> on </span>
                    <span className="font-medium text-slate-700">{log.target_resource}</span>
                  </div>
                </div>
                <div className="text-slate-400 text-[10px] sm:text-[11px] self-end sm:self-auto">
                  {new Date(log.timestamp).toLocaleString()}
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
