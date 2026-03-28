import React, { useEffect, useState } from 'react';
import { adminUsers } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { UserCog, Plus, Pencil, Trash2, Key, X, Save, Shield } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function UserManager() {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [changingPassword, setChangingPassword] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [myPasswordForm, setMyPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [myPasswordError, setMyPasswordError] = useState('');
  const [myPasswordSuccess, setMyPasswordSuccess] = useState('');
  const [myPasswordSaving, setMyPasswordSaving] = useState(false);

  const load = () => {
    setLoading(true);
    adminUsers.list().then(setAdmins).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setChangingPassword(null);
    setCreateForm({ name: '', email: '', password: '', confirmPassword: '' });
    setError('');
  };

  const startEdit = (a: any) => {
    setEditing(a.id);
    setCreating(false);
    setChangingPassword(null);
    setEditForm({ name: a.name, email: a.email });
    setError('');
  };

  const startChangePassword = (id: number) => {
    setChangingPassword(id);
    setCreating(false);
    setEditing(null);
    setPasswordForm({ password: '', confirmPassword: '' });
    setError('');
  };

  const cancel = () => {
    setCreating(false);
    setEditing(null);
    setChangingPassword(null);
    setError('');
  };

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password) {
      setError('All fields are required');
      return;
    }
    if (createForm.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (createForm.password !== createForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await adminUsers.create({ name: createForm.name, email: createForm.email, password: createForm.password });
      cancel();
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setError('Name and email are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await adminUsers.update(editing!, editForm);
      cancel();
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.password) {
      setError('Password is required');
      return;
    }
    if (passwordForm.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await adminUsers.changePassword(changingPassword!, passwordForm.password);
      cancel();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangeMyPassword = async () => {
    setMyPasswordError('');
    setMyPasswordSuccess('');
    if (!myPasswordForm.currentPassword || !myPasswordForm.newPassword) {
      setMyPasswordError('All fields are required');
      return;
    }
    if (myPasswordForm.newPassword.length < 6) {
      setMyPasswordError('New password must be at least 6 characters');
      return;
    }
    if (myPasswordForm.newPassword !== myPasswordForm.confirmNewPassword) {
      setMyPasswordError('New passwords do not match');
      return;
    }
    setMyPasswordSaving(true);
    try {
      await adminUsers.changeMyPassword(myPasswordForm.currentPassword, myPasswordForm.newPassword);
      setMyPasswordSuccess('Password changed successfully');
      setMyPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (err: any) {
      setMyPasswordError(err.message);
    } finally {
      setMyPasswordSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete admin "${name}"?`)) return;
    try {
      await adminUsers.delete(id);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
        <button onClick={startCreate} className="tb-btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Admin
        </button>
      </div>

      {/* Create Admin Form */}
      {creating && (
        <div className="tb-card border-primary-500/30 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">New Admin</h3>
          {error && <div className="mb-4 p-3 bg-status-expired-bg text-status-expired-text rounded-lg text-sm">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Name *</label>
              <input type="text" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} className="tb-input" placeholder="Full name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Email *</label>
              <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} className="tb-input" placeholder="admin@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Password * (min 6 chars)</label>
              <input type="password" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} className="tb-input" placeholder="Password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Confirm Password *</label>
              <input type="password" value={createForm.confirmPassword} onChange={e => setCreateForm(f => ({ ...f, confirmPassword: e.target.value }))} className="tb-input" placeholder="Confirm password" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={cancel} className="tb-btn-secondary flex items-center gap-1"><X className="w-4 h-4" /> Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="tb-btn-success flex items-center gap-1"><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      )}

      {/* Edit Admin Form */}
      {editing && (
        <div className="tb-card border-primary-500/30 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Edit Admin</h3>
          {error && <div className="mb-4 p-3 bg-status-expired-bg text-status-expired-text rounded-lg text-sm">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Name *</label>
              <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="tb-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Email *</label>
              <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="tb-input" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={cancel} className="tb-btn-secondary flex items-center gap-1"><X className="w-4 h-4" /> Cancel</button>
            <button onClick={handleEdit} disabled={saving} className="tb-btn-success flex items-center gap-1"><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      )}

      {/* Change Password Form */}
      {changingPassword && (
        <div className="tb-card border-primary-500/30 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Change Password</h3>
          {error && <div className="mb-4 p-3 bg-status-expired-bg text-status-expired-text rounded-lg text-sm">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">New Password * (min 6 chars)</label>
              <input type="password" value={passwordForm.password} onChange={e => setPasswordForm(f => ({ ...f, password: e.target.value }))} className="tb-input" placeholder="New password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Confirm Password *</label>
              <input type="password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))} className="tb-input" placeholder="Confirm password" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={cancel} className="tb-btn-secondary flex items-center gap-1"><X className="w-4 h-4" /> Cancel</button>
            <button onClick={handleChangePassword} disabled={saving} className="tb-btn-success flex items-center gap-1"><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      )}

      {/* Admin List */}
      <div className="space-y-2">
        {admins.map(a => (
          <div key={a.id} className="tb-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent-blue/20 rounded-lg flex items-center justify-center">
                <UserCog className="w-5 h-5 text-accent-blue" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900 dark:text-white">{a.name}</h3>
                  {currentUser && currentUser.id === a.id && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-accent-blue/20 text-accent-blue rounded-full">
                      <Shield className="w-3 h-3" /> You
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{a.email}</p>
                <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => startEdit(a)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-accent-blue hover:bg-black/10 dark:hover:bg-white/10 rounded-lg" title="Edit">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => startChangePassword(a.id)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-accent-amber hover:bg-black/10 dark:hover:bg-white/10 rounded-lg" title="Change Password">
                <Key className="w-4 h-4" />
              </button>
              {currentUser && currentUser.id !== a.id && (
                <button onClick={() => handleDelete(a.id, a.name)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-lg" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {admins.length === 0 && <div className="text-center py-12 tb-card text-gray-500">No admin users found.</div>}
      </div>

      {/* Change My Password Section */}
      <div className="mt-8">
        <div className="tb-card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Key className="w-5 h-5" /> Change My Password
          </h3>
          {myPasswordError && <div className="mb-4 p-3 bg-status-expired-bg text-status-expired-text rounded-lg text-sm">{myPasswordError}</div>}
          {myPasswordSuccess && <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm">{myPasswordSuccess}</div>}
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Current Password *</label>
              <input type="password" value={myPasswordForm.currentPassword} onChange={e => setMyPasswordForm(f => ({ ...f, currentPassword: e.target.value }))} className="tb-input" placeholder="Current password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">New Password * (min 6 chars)</label>
              <input type="password" value={myPasswordForm.newPassword} onChange={e => setMyPasswordForm(f => ({ ...f, newPassword: e.target.value }))} className="tb-input" placeholder="New password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Confirm New Password *</label>
              <input type="password" value={myPasswordForm.confirmNewPassword} onChange={e => setMyPasswordForm(f => ({ ...f, confirmNewPassword: e.target.value }))} className="tb-input" placeholder="Confirm new password" />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={handleChangeMyPassword} disabled={myPasswordSaving} className="tb-btn-primary flex items-center gap-1">
              <Save className="w-4 h-4" /> {myPasswordSaving ? 'Saving...' : 'Update Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
