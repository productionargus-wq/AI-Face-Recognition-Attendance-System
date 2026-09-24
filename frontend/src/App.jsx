import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/AppLayout';
import { Login } from './pages/Login';
import { RegisterOrg } from './pages/RegisterOrg';
import { KioskMode } from './pages/KioskMode';
import { AdminDashboard } from './pages/AdminDashboard';
import { EnrollmentPage } from './pages/EnrollmentPage';
import { EmployeePortal } from './pages/EmployeePortal';
import { ManualEntry } from './pages/ManualEntry';
import { AdvanceMoney } from './pages/AdvanceMoney';
import { LeaveApply } from './pages/LeaveApply';
import { PayrollReport } from './pages/PayrollReport';
import { OrgSettings } from './pages/OrgSettings';
import { LiveMapGeofence } from './pages/LiveMapGeofence';
import { PublicTerminal } from './pages/PublicTerminal';
import { AttendanceReports } from './pages/AttendanceReports';

const ProtectedRoute = ({ children, requiredPath = null }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-500 font-mono">Verifying credentials...</div>;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === 'org_admin' || user.role === 'super_admin') {
    return children;
  }
  // Employee permissions check
  if (requiredPath) {
    const perms = user.permissions || ['/admin', '/kiosk', '/attendance-reports', '/leave-apply', '/advance-money', '/payroll'];
    const hasPerm = perms.includes(requiredPath) || (requiredPath === '/admin' && (perms.includes('/admin') || perms.includes('/portal')));
    if (!hasPerm) {
      const fallback = perms.find(p => p !== requiredPath) || '/portal';
      return <Navigate to={fallback} replace />;
    }
  }
  return children;
};

const DashboardRouter = () => {
  const { user } = useAuth();
  if (user?.role === 'employee') {
    return <EmployeePortal />;
  }
  return <AdminDashboard />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Root page loads the newly redesigned Login interface directly */}
          <Route path="/" element={<Login />} />

          {/* Standalone Auth & Terminal Screens */}
          <Route path="/login" element={<Login />} />
          <Route path="/register-org" element={<RegisterOrg />} />
          <Route path="/terminal" element={<PublicTerminal />} />

          {/* Enterprise Suite Screens with AppLayout Shell */}
          <Route
            path="/kiosk"
            element={
              <AppLayout>
                <KioskMode />
              </AppLayout>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredPath="/admin">
                <AppLayout>
                  <DashboardRouter />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/attendance-reports"
            element={
              <ProtectedRoute requiredPath="/attendance-reports">
                <AppLayout>
                  <AttendanceReports />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/enrollment"
            element={
              <ProtectedRoute requiredPath="/enrollment">
                <AppLayout>
                  <EnrollmentPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/manual-entry"
            element={
              <ProtectedRoute requiredPath="/manual-entry">
                <AppLayout>
                  <ManualEntry />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/advance-money"
            element={
              <ProtectedRoute requiredPath="/advance-money">
                <AppLayout>
                  <AdvanceMoney />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/leave-apply"
            element={
              <ProtectedRoute requiredPath="/leave-apply">
                <AppLayout>
                  <LeaveApply />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/payroll"
            element={
              <ProtectedRoute requiredPath="/payroll">
                <AppLayout>
                  <PayrollReport />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute requiredPath="/settings">
                <AppLayout>
                  <OrgSettings />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/geofence"
            element={
              <ProtectedRoute requiredPath="/geofence">
                <AppLayout>
                  <LiveMapGeofence />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/portal"
            element={
              <ProtectedRoute requiredPath="/admin">
                <AppLayout>
                  <EmployeePortal />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;