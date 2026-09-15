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

const ProtectedAdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-500 font-mono">Verifying credentials...</div>;
  if (!user || user.role !== 'org_admin') {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const ProtectedEmployeeRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-500 font-mono">Verifying credentials...</div>;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Root page loads the newly redesigned Login interface directly */}
          <Route path="/" element={<Login />} />

          {/* Standalone Auth Screens (Screen 1 & Screen 2) */}
          <Route path="/login" element={<Login />} />
          <Route path="/register-org" element={<RegisterOrg />} />

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
              <ProtectedAdminRoute>
                <AppLayout>
                  <AdminDashboard />
                </AppLayout>
              </ProtectedAdminRoute>
            }
          />

          <Route
            path="/enrollment"
            element={
              <ProtectedAdminRoute>
                <AppLayout>
                  <EnrollmentPage />
                </AppLayout>
              </ProtectedAdminRoute>
            }
          />

          {/* 5 Newly Integrated Tabs from Uploaded Designs */}
          <Route
            path="/manual-entry"
            element={
              <ProtectedAdminRoute>
                <AppLayout>
                  <ManualEntry />
                </AppLayout>
              </ProtectedAdminRoute>
            }
          />

          <Route
            path="/advance-money"
            element={
              <ProtectedAdminRoute>
                <AppLayout>
                  <AdvanceMoney />
                </AppLayout>
              </ProtectedAdminRoute>
            }
          />

          <Route
            path="/leave-apply"
            element={
              <ProtectedEmployeeRoute>
                <AppLayout>
                  <LeaveApply />
                </AppLayout>
              </ProtectedEmployeeRoute>
            }
          />

          <Route
            path="/payroll"
            element={
              <ProtectedAdminRoute>
                <AppLayout>
                  <PayrollReport />
                </AppLayout>
              </ProtectedAdminRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedAdminRoute>
                <AppLayout>
                  <OrgSettings />
                </AppLayout>
              </ProtectedAdminRoute>
            }
          />

          <Route
            path="/portal"
            element={
              <ProtectedEmployeeRoute>
                <AppLayout>
                  <EmployeePortal />
                </AppLayout>
              </ProtectedEmployeeRoute>
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