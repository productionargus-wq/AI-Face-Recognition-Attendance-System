import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AppLayout } from './components/AppLayout';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { RegisterOrg } from './pages/RegisterOrg';
import { KioskMode } from './pages/KioskMode';
import { AdminDashboard } from './pages/AdminDashboard';
import { EnrollmentPage } from './pages/EnrollmentPage';
import { EmployeePortal } from './pages/EmployeePortal';

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
          {/* Public Landing Page */}
          <Route
            path="/"
            element={
              <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
                <Navbar />
                <main className="flex-1">
                  <Home />
                </main>
              </div>
            }
          />

          {/* Standalone Auth Screens (Screen 1 & Screen 2) */}
          <Route path="/login" element={<Login />} />
          <Route path="/register-org" element={<RegisterOrg />} />

          {/* Enterprise Suite Screens with AppLayout Shell (Screens 3, 4, 5) */}
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