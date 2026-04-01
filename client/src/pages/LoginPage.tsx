import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'admin' || user.role === 'engineer' ? '/admin' : '/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="tb-card p-8">
        <div className="flex items-center justify-center mb-6">
          <LogIn className="w-8 h-8 text-accent-blue" />
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-6">Sign In</h1>

        {error && (
          <div className="mb-4 p-3 bg-status-expired-bg text-status-expired-text rounded-lg text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="tb-input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="tb-input" />
          </div>
          <button type="submit" disabled={loading} className="w-full tb-btn-primary py-2.5">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Don't have an account? <Link to="/register" className="text-accent-blue hover:underline">Register</Link>
        </p>
        <p className="mt-2 text-center text-sm text-gray-300 dark:text-gray-600">
          Admin: admin@telcobridges.com / admin123
        </p>
      </div>
    </div>
  );
}
