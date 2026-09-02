import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ScanFace, LogOut, Building2, UserCircle, LayoutDashboard, Calendar, ShieldCheck } from 'lucide-react';

export const Navbar = () => {
  const { user, organization, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <ScanFace className="w-6 h-6" />
          </div>
          <div>
            <span className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              ARGUS <span className="text-blue-600 font-semibold text-sm px-1.5 py-0.5 bg-blue-50 rounded border border-blue-200">AI</span>
            </span>
            <span className="text-xs text-slate-500 block -mt-1">Face Attendance Platform</span>
          </div>
        </Link>

        {/* Center / Navigation Links */}
        <div className="hidden md:flex items-center space-x-1">
          <Link
            to="/kiosk"
            className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg transition-colors flex items-center gap-2"
          >
            <ScanFace className="w-4 h-4 text-blue-600" />
            Kiosk Terminal
          </Link>

          {user && user.role === 'org_admin' && (
            <Link
              to="/admin"
              className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg transition-colors flex items-center gap-2"
            >
              <LayoutDashboard className="w-4 h-4 text-blue-600" />
              Admin Dashboard
            </Link>
          )}

          {user && (
            <Link
              to="/portal"
              className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg transition-colors flex items-center gap-2"
            >
              <Calendar className="w-4 h-4 text-blue-600" />
              My Attendance
            </Link>
          )}
        </div>

        {/* Right side Org Badge & User Info */}
        <div className="flex items-center space-x-3">
          {organization && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="max-w-[130px] truncate">{organization.name}</span>
            </div>
          )}

          {user ? (
            <div className="flex items-center space-x-2">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-900 leading-tight">{user.name}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider capitalize">
                  {user.role === 'org_admin' ? 'Organization Admin' : 'Employee'}
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Logout"
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                className="px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register-org"
                className="px-3.5 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm rounded-lg transition-colors"
              >
                Register Org
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};