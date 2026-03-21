import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus } from 'lucide-react';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, name);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="tb-card p-8">
        <div className="flex items-center justify-center mb-6">
          <UserPlus className="w-8 h-8 text-accent-blue" />
        </div>
        <h1 className="text-2xl font-bold text-center text-white mb-6">Create Account</h1>

        {error && (
          <div className="mb-4 p-3 bg-status-expired-bg text-status-expired-text rounded-lg text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)} className="tb-input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="tb-input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="tb-input" />
          </div>
          <button type="submit" disabled={loading} className="w-full tb-btn-primary py-2.5">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account? <Link to="/login" className="text-accent-blue hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
