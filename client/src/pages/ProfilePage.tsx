import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth, tickets as ticketsApi } from '../api/client';
import { User, Lock, Ticket, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [ticketStats, setTicketStats] = useState({ total: 0, open: 0, resolved: 0 });

  useEffect(() => {
    if (!user) return;
    auth.me().then((p: any) => {
      setProfile(p);
      setName(p.name || '');
      setCompany(p.company || '');
    }).catch(console.error);

    ticketsApi.list().then((data: any) => {
      const tickets = data.tickets || [];
      setTicketStats({
        total: data.total || tickets.length,
        open: tickets.filter((t: any) => !['resolved', 'closed'].includes(t.status)).length,
        resolved: tickets.filter((t: any) => t.status === 'resolved').length,
      });
    }).catch(console.error);
  }, [user]);

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Please <Link to="/login" className="text-accent-blue hover:underline">sign in</Link> to view your profile.</p>
      </div>
    );
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg('');
    setProfileError('');
    try {
      await auth.updateProfile({ name: name || undefined, company: company || undefined });
      setProfileMsg('Profile updated successfully.');
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg('');
    setPwError('');
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    setSavingPw(true);
    try {
      await auth.changePassword(currentPassword, newPassword);
      setPwMsg('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err.message || 'Failed to change password');
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">My Profile</h1>

      {/* Ticket Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="tb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-500/20 text-accent-blue">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{ticketStats.total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Tickets</p>
            </div>
          </div>
        </div>
        <div className="tb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-amber/20 text-accent-amber">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{ticketStats.open}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Open</p>
            </div>
          </div>
        </div>
        <div className="tb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-green/20 text-accent-green">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{ticketStats.resolved}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Resolved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="tb-card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-accent-blue" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Profile Information</h3>
        </div>
        <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Email: <span className="text-gray-900 dark:text-white font-medium">{profile?.email || user.email}</span>
        </div>
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="tb-input w-full"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company</label>
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              className="tb-input w-full"
              placeholder="Company name"
            />
          </div>
          {profileMsg && <p className="text-sm text-accent-green">{profileMsg}</p>}
          {profileError && <p className="text-sm text-red-500">{profileError}</p>}
          <button type="submit" disabled={savingProfile} className="tb-btn-primary">
            {savingProfile ? 'Saving...' : 'Update Profile'}
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="tb-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-accent-amber" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Change Password</h3>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="tb-input w-full"
              placeholder="Enter current password"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="tb-input w-full"
              placeholder="Enter new password (min 6 chars)"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="tb-input w-full"
              placeholder="Confirm new password"
              required
            />
          </div>
          {pwMsg && <p className="text-sm text-accent-green">{pwMsg}</p>}
          {pwError && <p className="text-sm text-red-500">{pwError}</p>}
          <button type="submit" disabled={savingPw} className="tb-btn-primary">
            {savingPw ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
