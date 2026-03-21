import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, LogOut, LogIn, UserPlus } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/'); };

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
              <Link to="/submit" className="text-gray-600 dark:text-gray-300 hover:text-primary-500 dark:hover:text-accent-blue hover:bg-gray-100 dark:hover:bg-tb-bg px-3 py-2 rounded-lg text-sm font-medium transition-colors">
                Submit Ticket
              </Link>
              <Link to="/track" className="text-gray-600 dark:text-gray-300 hover:text-primary-500 dark:hover:text-accent-blue hover:bg-gray-100 dark:hover:bg-tb-bg px-3 py-2 rounded-lg text-sm font-medium transition-colors">
                Track Ticket
              </Link>
              {user && (
                <Link to="/my-tickets" className="text-gray-600 dark:text-gray-300 hover:text-primary-500 dark:hover:text-accent-blue hover:bg-gray-100 dark:hover:bg-tb-bg px-3 py-2 rounded-lg text-sm font-medium transition-colors">
                  My Tickets
                </Link>
              )}
              {isAdmin && (
                <Link to="/admin" className="text-gray-600 dark:text-gray-300 hover:text-primary-500 dark:hover:text-accent-blue hover:bg-gray-100 dark:hover:bg-tb-bg px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 transition-colors">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Admin</span>
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <ThemeToggle />
            {user ? (
              <>
                <span className="text-sm text-gray-500 dark:text-gray-400">{user.name}</span>
                {user.role === 'admin' && (
                  <span className="px-2 py-0.5 bg-status-role-bg text-white text-xs font-medium rounded-full">Admin</span>
                )}
                <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-2 transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="flex items-center space-x-1 text-gray-600 dark:text-gray-300 hover:text-primary-500 dark:hover:text-accent-blue text-sm font-medium transition-colors">
                  <LogIn className="w-4 h-4" /><span>Login</span>
                </Link>
                <Link to="/register" className="flex items-center space-x-1 bg-primary-500 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary-400 transition-colors">
                  <UserPlus className="w-4 h-4" /><span>Register</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
