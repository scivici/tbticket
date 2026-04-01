import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, LogOut, LogIn, Menu, X, Users } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, logout, isAdmin, isCompanyAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); setMobileOpen(false); };
  const closeMobile = () => setMobileOpen(false);

  const canCreateTickets = !user || user.canCreateTickets !== false;

  const navLinks = (
    <>
      {canCreateTickets && (
        <Link to="/submit" onClick={closeMobile} className="text-gray-600 dark:text-gray-300 hover:text-primary-500 dark:hover:text-accent-blue hover:bg-gray-100 dark:hover:bg-tb-bg px-3 py-2 rounded-lg text-sm font-medium transition-colors">
          Submit Ticket
        </Link>
      )}
      <Link to="/track" onClick={closeMobile} className="text-gray-600 dark:text-gray-300 hover:text-primary-500 dark:hover:text-accent-blue hover:bg-gray-100 dark:hover:bg-tb-bg px-3 py-2 rounded-lg text-sm font-medium transition-colors">
        Track Ticket
      </Link>
      <Link to="/knowledge-base" onClick={closeMobile} className="text-gray-600 dark:text-gray-300 hover:text-primary-500 dark:hover:text-accent-blue hover:bg-gray-100 dark:hover:bg-tb-bg px-3 py-2 rounded-lg text-sm font-medium transition-colors">
        Knowledge Base
      </Link>
      {user && (
        <Link to="/my-tickets" onClick={closeMobile} className="text-gray-600 dark:text-gray-300 hover:text-primary-500 dark:hover:text-accent-blue hover:bg-gray-100 dark:hover:bg-tb-bg px-3 py-2 rounded-lg text-sm font-medium transition-colors">
          My Tickets
        </Link>
      )}
      {isCompanyAdmin && (
        <Link to="/company/users" onClick={closeMobile} className="text-gray-600 dark:text-gray-300 hover:text-primary-500 dark:hover:text-accent-blue hover:bg-gray-100 dark:hover:bg-tb-bg px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 transition-colors">
          <Users className="w-4 h-4" /><span>Manage Users</span>
        </Link>
      )}
      {isAdmin && (
        <Link to="/admin" onClick={closeMobile} className="text-gray-600 dark:text-gray-300 hover:text-primary-500 dark:hover:text-accent-blue hover:bg-gray-100 dark:hover:bg-tb-bg px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 transition-colors">
          <LayoutDashboard className="w-4 h-4" />
          <span>Admin</span>
        </Link>
      )}
    </>
  );

  return (
    <nav className="bg-white dark:bg-tb-card border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-3">
              <img src="/tb-logo-small.png" alt="TelcoBridges" className="h-7" />
              <span className="text-primary-500 dark:text-accent-blue font-bold text-lg hidden sm:inline">Support</span>
            </Link>
            <div className="hidden sm:flex space-x-1">
              {navLinks}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {user && <NotificationBell />}
            <ThemeToggle />
            {user ? (
              <>
                <Link to="/profile" className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-accent-blue transition-colors hidden sm:inline">{user.name}</Link>
                {user.role === 'admin' && (
                  <span className="px-2 py-0.5 bg-status-role-bg text-white text-xs font-medium rounded-full hidden sm:inline">Admin</span>
                )}
                <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-2 transition-colors hidden sm:block">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <Link to="/login" className="hidden sm:flex items-center space-x-1 bg-primary-500 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary-400 transition-colors">
                <LogIn className="w-4 h-4" /><span>Login</span>
              </Link>
            )}
            {/* Mobile hamburger */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="sm:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-tb-card px-4 py-3 space-y-1">
          {navLinks}
          {user ? (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2 space-y-1">
              <Link to="/profile" onClick={closeMobile} className="block text-sm text-gray-600 dark:text-gray-300 hover:text-primary-500 px-3 py-2 rounded-lg transition-colors">
                {user.name}
              </Link>
              <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-red-500 px-3 py-2 rounded-lg w-full transition-colors">
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2 space-y-1">
              <Link to="/login" onClick={closeMobile} className="flex items-center gap-2 text-sm bg-primary-500 text-white px-3 py-2 rounded-lg font-medium hover:bg-primary-400 transition-colors">
                <LogIn className="w-4 h-4" />Login
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
