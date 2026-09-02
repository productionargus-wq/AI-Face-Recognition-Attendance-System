import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { RegisterOrg } from './pages/RegisterOrg';
import { KioskMode } from './pages/KioskMode';
import { AdminDashboard } from './pages/AdminDashboard';
import { EmployeePortal } from './pages/EmployeePortal';

const ProtectedAdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-500">Loading portal...</div>;
  if (!user || user.role !== 'org_admin') {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const ProtectedEmployeeRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-500">Loading portal...</div>;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register-org" element={<RegisterOrg />} />
              <Route path="/kiosk" element={<KioskMode />} />
              <Route
                path="/admin"
                element={
                  <ProtectedAdminRoute>
                    <AdminDashboard />
                  </ProtectedAdminRoute>
                }
              />
              <Route
                path="/portal"
                element={
                  <ProtectedEmployeeRoute>
                    <EmployeePortal />
                  </ProtectedEmployeeRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;