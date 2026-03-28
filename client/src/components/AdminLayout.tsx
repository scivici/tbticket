import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import {
  LayoutDashboard, Ticket, Users, Package, FolderOpen,
  HelpCircle, Wrench, UserCog, LogOut, ChevronLeft, Settings,
  UserCheck, MessageSquarePlus, Menu, X, AlertTriangle, Repeat, Clock, ShieldAlert, SlidersHorizontal
} from 'lucide-react';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/admin/tickets', icon: Ticket, label: 'Tickets' },
  { to: '/admin/engineers', icon: Users, label: 'Engineers' },
  { to: '/admin/customers', icon: UserCheck, label: 'Customers' },
  { to: '/admin/products', icon: Package, label: 'Products' },
  { to: '/admin/categories', icon: FolderOpen, label: 'Categories' },
  { to: '/admin/questions', icon: HelpCircle, label: 'Questions' },
  { to: '/admin/skills', icon: Wrench, label: 'Skills' },
  { to: '/admin/canned-responses', icon: MessageSquarePlus, label: 'Canned Responses' },
  { to: '/admin/escalations', icon: AlertTriangle, label: 'Escalations' },
  { to: '/admin/recurring', icon: Repeat, label: 'Recurring' },
  { to: '/admin/time-reports', icon: Clock, label: 'Time Reports' },
  { to: '/admin/sla-dashboard', icon: ShieldAlert, label: 'SLA Dashboard' },
  { to: '/admin/custom-fields', icon: SlidersHorizontal, label: 'Custom Fields' },
  { to: '/admin/setup', icon: Settings, label: 'Setup' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };

  // Close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const isActive = (item: typeof navItems[0]) => {
    if (item.exact) return location.pathname === item.to;
    return location.pathname.startsWith(item.to);
  };

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/tb-logo-small.png" alt="TelcoBridges" className="h-6" />
          <span className="text-primary-500 dark:text-accent-blue font-bold text-sm">Admin</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const active = isActive(item);
          return (
            <Link key={item.to} to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-accent-blue'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
              }`}>
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
        <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
          <ChevronLeft className="w-4 h-4" /><span>Back to Site</span>
        </Link>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm text-gray-900 dark:text-white truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{user?.email}</p>
          </div>
          <button onClick={handleLogout} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#f2f2f2] dark:bg-tb-bg flex transition-colors">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-56 bg-white dark:bg-tb-card border-r border-gray-200 dark:border-gray-700 flex-col fixed h-full transition-colors">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          {/* Sidebar panel */}
          <aside className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-tb-card border-r border-gray-200 dark:border-gray-700 flex flex-col z-50 shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      <main className="flex-1 lg:ml-56">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-tb-card border-b border-gray-200 dark:border-gray-700">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <img src="/tb-logo-small.png" alt="TelcoBridges" className="h-5" />
            <span className="text-primary-500 dark:text-accent-blue font-bold text-sm">Admin</span>
          </Link>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
