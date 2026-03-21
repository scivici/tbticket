import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Ticket, Users, Package, FolderOpen,
  HelpCircle, Wrench, LogOut, ChevronLeft
} from 'lucide-react';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/admin/tickets', icon: Ticket, label: 'Tickets' },
  { to: '/admin/engineers', icon: Users, label: 'Engineers' },
  { to: '/admin/products', icon: Package, label: 'Products' },
  { to: '/admin/categories', icon: FolderOpen, label: 'Categories' },
  { to: '/admin/questions', icon: HelpCircle, label: 'Questions' },
  { to: '/admin/skills', icon: Wrench, label: 'Skills' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/'); };

  const isActive = (item: typeof navItems[0]) => {
    if (item.exact) return location.pathname === item.to;
    return location.pathname.startsWith(item.to);
  };

  return (
    <div className="min-h-screen bg-tb-bg flex">
      {/* Sidebar */}
      <aside className="w-56 bg-tb-card border-r border-gray-700 flex flex-col fixed h-full">
        {/* Logo */}
        <div className="p-4 border-b border-gray-700">
          <Link to="/" className="flex items-center gap-2">
            <img src="/tb-logo-small.png" alt="TelcoBridges" className="h-6" />
            <span className="text-accent-blue font-bold text-sm">Admin</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const active = isActive(item);
            return (
              <Link key={item.to} to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary-500/20 text-accent-blue'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}>
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 space-y-2">
          <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Site</span>
          </Link>
          <div className="flex items-center justify-between px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button onClick={handleLogout} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-56">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
