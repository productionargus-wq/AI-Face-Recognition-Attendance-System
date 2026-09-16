import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  ScanFace, 
  Fingerprint, 
  CalendarCheck,
  Banknote,
  CalendarDays,
  CreditCard, 
  Settings as SettingsIcon, 
  ShieldCheck, 
  LogOut, 
  Menu, 
  X,
  ChevronRight
} from 'lucide-react';

export const AppLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, organization, logout } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const navItems = [
    {
      name: 'Admin Dashboard',
      path: '/admin',
      icon: LayoutDashboard,
      roles: ['org_admin', 'super_admin']
    },
    {
      name: 'Attendance Capture',
      path: '/kiosk',
      icon: ScanFace,
      roles: ['all']
    },
    {
      name: 'Biometric Enrollment',
      path: '/enrollment',
      icon: Fingerprint,
      roles: ['org_admin', 'super_admin']
    },
    {
      name: 'Manual Entry',
      path: '/manual-entry',
      icon: CalendarCheck,
      roles: ['org_admin', 'super_admin']
    },
    {
      name: 'Advance Money',
      path: '/advance-money',
      icon: Banknote,
      roles: ['org_admin', 'super_admin']
    },
    {
      name: 'Leave Apply',
      path: '/leave-apply',
      icon: CalendarDays,
      roles: ['all']
    },
    {
      name: 'Salary & Payroll',
      path: '/payroll',
      icon: CreditCard,
      roles: ['org_admin', 'super_admin']
    },
    {
      name: 'Settings',
      path: '/settings',
      icon: SettingsIcon,
      roles: ['org_admin', 'super_admin']
    }
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="h-screen bg-[#f8fbff] flex flex-col md:flex-row text-slate-800 font-sans overflow-hidden">
      {/* Desktop Left Sidebar - Fixed in place */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0 z-30 h-full overflow-y-auto">
        {/* Brand Header */}
        <div className="h-16 border-b border-slate-100 flex items-center px-5 gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#0080ff] flex items-center justify-center text-white shadow-sm font-bold">
            <ScanFace className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-black tracking-wider text-slate-900 uppercase">
              ARGUS
            </div>
            <div className="text-[10px] tracking-tight text-blue-600 font-bold -mt-0.5 uppercase">
              AI ATTENDANCE SUITE
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-bold border-l-4 border-blue-600 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-bold">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer / Org Details */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
            Current Tenant
          </div>
          <div className="text-xs font-bold text-slate-800 truncate">
            {organization?.name || 'Argus Technologies'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
            ID: {organization?.slug || 'ARGUS-MAIN'}
          </div>
        </div>
      </aside>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
        {/* Top Header Bar - Sticky */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0 sticky top-0 z-20">
          {/* Mobile Menu Button & Brand */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-[#0080ff] flex items-center justify-center text-white font-bold">
                <ScanFace className="w-4 h-4" />
              </div>
              <span className="text-xs font-black tracking-wide">ARGUS AI</span>
            </div>
          </div>

          <div className="hidden md:block">
            {/* Context breadcrumb or subtle tenant title */}
            <div className="text-xs font-semibold text-slate-500">
              {organization?.name || 'Argus Technologies'}
            </div>
          </div>

          {/* Right User & Role Info Header */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Admin Role Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>{user?.role === 'org_admin' ? 'ADMIN ROLE' : 'EMPLOYEE'}</span>
            </div>

            {/* Profile Avatar & Name */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {user?.name || user?.email?.split('@')[0] || 'Administrator'}
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {user?.role === 'org_admin' || user?.role === 'super_admin' ? 'Chief Executive Officer' : 'Staff Member'}
                </div>
              </div>

              {/* Avatar Photo */}
              <div className="w-9 h-9 rounded-full ring-2 ring-blue-500/20 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs overflow-hidden">
                {(user?.name || user?.email || 'AD').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
              </div>

              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Sidebar Dropdown Drawer */}
        {mobileSidebarOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-1 shadow-md z-30">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold ${
                    isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-blue-600" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] font-mono px-1 bg-slate-100 text-slate-500 rounded">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* Main Body */}
        <main className="flex-1 overflow-x-hidden p-4 sm:p-8 bg-[#f8fbff] bg-blueprint">
          {children}
        </main>
      </div>
    </div>
  );
};
