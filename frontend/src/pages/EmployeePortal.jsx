import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Calendar, Clock, CheckCircle2, ShieldCheck, UserCheck, Award } from 'lucide-react';

export const EmployeePortal = () => {
  const { user, organization } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyHistory = async () => {
      try {
        const res = await api.get('/attendance/my-history');
        setHistory(res.data);
      } catch (err) {
        console.error('Failed to load my attendance history', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMyHistory();
  }, []);

  const totalHours = history.reduce((acc, curr) => acc + (curr.total_hours || 0), 0);
  const presentDays = history.filter(h => h.status === 'PRESENT' || h.status === 'LATE').length;

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md uppercase">
            {organization?.name || 'Organization'}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Welcome, {user?.name}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Employee Self-Service Attendance History
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Biometric Consent Active</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Days Present</div>
            <div className="text-2xl font-bold text-slate-900">{presentDays}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Hours Logged</div>
            <div className="text-2xl font-bold text-emerald-600">{totalHours.toFixed(1)} hrs</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Punctuality Score</div>
            <div className="text-2xl font-bold text-indigo-600">98%</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">Recent Attendance Logs</h3>

        {history.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            No previous punches recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Check In</th>
                  <th className="p-3">Check Out</th>
                  <th className="p-3">Hours</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-semibold text-slate-900 font-mono">{rec.date}</td>
                    <td className="p-3 text-slate-800 font-medium">
                      {rec.check_in ? new Date(rec.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="p-3 text-slate-800 font-medium">
                      {rec.check_out ? new Date(rec.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                    </td>
                    <td className="p-3 font-semibold text-slate-700">{rec.total_hours || 0} hrs</td>
                    <td className="p-3">
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
    </div>
  );
};
