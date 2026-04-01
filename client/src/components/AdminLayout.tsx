import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import {
  LayoutDashboard, Ticket, Users, Package, FolderOpen,
  HelpCircle, Wrench, UserCog, LogOut, ChevronLeft, Settings,
  UserCheck, MessageSquarePlus, Menu, X, AlertTriangle, Repeat, Clock, ShieldAlert,
  Keyboard, Activity
} from 'lucide-react';

const allNavItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true, roles: ['admin', 'engineer'] },
  { to: '/admin/tickets', icon: Ticket, label: 'Tickets', roles: ['admin', 'engineer'] },
  { to: '/admin/engineers', icon: Users, label: 'Support Specialists', roles: ['admin'] },
  { to: '/admin/customers', icon: UserCheck, label: 'Customers', roles: ['admin', 'engineer'] },
  { to: '/admin/products', icon: Package, label: 'Products', roles: ['admin'] },
  { to: '/admin/categories', icon: FolderOpen, label: 'Categories', roles: ['admin'] },
  { to: '/admin/questions', icon: HelpCircle, label: 'Questions', roles: ['admin'] },
  { to: '/admin/skills', icon: Wrench, label: 'Skills', roles: ['admin'] },
  { to: '/admin/canned-responses', icon: MessageSquarePlus, label: 'Canned Responses', roles: ['admin'] },
  { to: '/admin/escalations', icon: AlertTriangle, label: 'Escalations', roles: ['admin', 'engineer'] },
  { to: '/admin/recurring', icon: Repeat, label: 'Recurring', roles: ['admin'] },
  { to: '/admin/time-reports', icon: Clock, label: 'Time Reports', roles: ['admin', 'engineer'] },
  { to: '/admin/sla-dashboard', icon: ShieldAlert, label: 'SLA Dashboard', roles: ['admin', 'engineer'] },
  { to: '/admin/health', icon: Activity, label: 'System Health', roles: ['admin'] },
  { to: '/admin/setup', icon: Settings, label: 'Setup', roles: ['admin'] },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const userRole = user?.role || 'customer';
  const navItems = allNavItems.filter(item => item.roles.includes(userRole));

  const handleLogout = () => { logout(); navigate('/'); };

  // Close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

      // Escape always works - close modals/overlays
      if (e.key === 'Escape') {
        setShowShortcuts(false);
        setSidebarOpen(false);
        return;
      }

      // ? shortcut only when not focused on input
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
        return;
      }

      // Alt+key shortcuts
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'd':
            e.preventDefault();
            navigate('/admin');
            break;
          case 't':
            e.preventDefault();
            navigate('/admin/tickets');
            break;
          case 'n':
            e.preventDefault();
            navigate('/submit');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const isActive = (item: typeof navItems[0]) => {
    if (item.exact) return location.pathname === item.to;
    return location.pathname.startsWith(item.to);
  };

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/tb-logo-small.png" alt="TelcoBridges" className="h-6" />
          <span className="text-primary-500 dark:text-accent-blue font-bold text-sm">{userRole === 'engineer' ? 'Support Panel' : 'Admin'}</span>
        </Link>
        <div className="flex items-center gap-2">
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
            <span className="text-primary-500 dark:text-accent-blue font-bold text-sm">{userRole === 'engineer' ? 'Support Panel' : 'Admin'}</span>
          </Link>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>

      {/* Keyboard shortcut hint */}
      <button
        onClick={() => setShowShortcuts(true)}
        className="hidden lg:flex fixed bottom-4 right-4 items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-tb-card border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors z-30"
        title="Keyboard shortcuts"
      >
        <Keyboard className="w-3.5 h-3.5" />
        <span>Press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono">?</kbd> for shortcuts</span>
      </button>

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white dark:bg-tb-card rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-accent-blue" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Keyboard Shortcuts</h3>
              </div>
              <button onClick={() => setShowShortcuts(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              {[
                { keys: 'Alt + D', label: 'Go to Dashboard' },
                { keys: 'Alt + T', label: 'Go to Tickets' },
                { keys: 'Alt + N', label: 'New Ticket (submit page)' },
                { keys: 'Escape', label: 'Close modal / overlay' },
                { keys: '?', label: 'Toggle this help' },
              ].map(s => (
                <div key={s.keys} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-white/5">
                  <span className="text-sm text-gray-600 dark:text-gray-300">{s.label}</span>
                  <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-mono">{s.keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
