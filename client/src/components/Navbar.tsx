import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TicketIcon, LayoutDashboard, LogOut, LogIn, UserPlus } from 'lucide-react';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2 text-primary-600 font-bold text-lg">
              <TicketIcon className="w-6 h-6" />
              <span>TB Support</span>
            </Link>
            <div className="hidden sm:flex space-x-4">
              <Link to="/submit" className="text-gray-600 hover:text-primary-600 px-3 py-2 text-sm font-medium">
                Submit Ticket
              </Link>
              <Link to="/track" className="text-gray-600 hover:text-primary-600 px-3 py-2 text-sm font-medium">
                Track Ticket
              </Link>
              {user && (
                <Link to="/my-tickets" className="text-gray-600 hover:text-primary-600 px-3 py-2 text-sm font-medium">
                  My Tickets
                </Link>
              )}
              {isAdmin && (
                <Link to="/admin" className="text-gray-600 hover:text-primary-600 px-3 py-2 text-sm font-medium flex items-center space-x-1">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Admin</span>
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {user ? (
              <>
                <span className="text-sm text-gray-500">{user.name}</span>
                {user.role === 'admin' && (
                  <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">Admin</span>
                )}
                <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 p-2">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="flex items-center space-x-1 text-gray-600 hover:text-primary-600 text-sm font-medium">
                  <LogIn className="w-4 h-4" />
                  <span>Login</span>
                </Link>
                <Link to="/register" className="flex items-center space-x-1 bg-primary-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary-700">
                  <UserPlus className="w-4 h-4" />
                  <span>Register</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
