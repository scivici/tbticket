import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { companyApi } from '../api/client';
import { Users, UserPlus, Shield, ShieldCheck, Ticket, Eye, EyeOff, Trash2, KeyRound, X, Check } from 'lucide-react';

interface CompanyUser {
  id: number;
  email: string;
  name: string;
  is_company_admin: boolean;
  can_create_tickets: boolean;
  company_ticket_visibility: boolean;
  created_at: string;
}

export default function CompanyUsers() {
  const { user, isCompanyAdmin } = useAuth();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newCanCreate, setNewCanCreate] = useState(true);
  const [newCanViewAll, setNewCanViewAll] = useState(false);
  const [newIsAdmin, setNewIsAdmin] = useState(false);

  // Reset password
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const load = () => {
    setLoading(true);
    companyApi.listUsers()
      .then(setUsers)
      .catch(() => setError('Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (!isCompanyAdmin) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
        <p className="text-gray-500">Only company administrators can manage users.</p>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await companyApi.createUser({
        email: newEmail,
        name: newName,
        password: newPassword,
        canCreateTickets: newCanCreate,
        companyTicketVisibility: newCanViewAll,
        isCompanyAdmin: newIsAdmin,
      });
      setSuccess(`User "${newName}" created successfully`);
      setShowCreate(false);
      setNewName(''); setNewEmail(''); setNewPassword('');
      setNewCanCreate(true); setNewCanViewAll(false); setNewIsAdmin(false);
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    }
  };

  const handleToggle = async (userId: number, field: string, value: boolean) => {
    setError(''); setSuccess('');
    try {
      await companyApi.updateUser(userId, { [field]: value });
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    }
  };

  const handleDelete = async (u: CompanyUser) => {
    if (!confirm(`Remove "${u.name}" (${u.email})? They will lose access but their ticket history will be preserved.`)) return;
    setError(''); setSuccess('');
    try {
      await companyApi.deleteUser(u.id);
      setSuccess(`User "${u.name}" removed`);
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to remove user');
    }
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !resetPassword) return;
    setError(''); setSuccess('');
    try {
      await companyApi.resetPassword(resetUserId, resetPassword);
      setSuccess('Password reset successfully');
      setResetUserId(null);
      setResetPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-accent-blue" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Company Users</h1>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 tb-btn-primary px-4 py-2">
          <UserPlus className="w-4 h-4" /> Add User
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-lg text-sm">{success}</div>}

      {/* Create User Form */}
      {showCreate && (
        <div className="tb-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New User</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Full Name *</label>
                <input type="text" required value={newName} onChange={e => setNewName(e.target.value)} className="tb-input" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Email *</label>
                <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} className="tb-input" placeholder="john@company.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Password *</label>
              <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="tb-input" placeholder="Min 8 chars, uppercase, lowercase, number" />
            </div>

            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Permissions</h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={newCanCreate} onChange={e => setNewCanCreate(e.target.checked)}
                  className="w-4 h-4 text-accent-blue rounded border-gray-300 focus:ring-accent-blue" />
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Can Create Tickets</span>
                  <p className="text-xs text-gray-500">Allow this user to submit new support tickets</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={newCanViewAll} onChange={e => setNewCanViewAll(e.target.checked)}
                  className="w-4 h-4 text-accent-blue rounded border-gray-300 focus:ring-accent-blue" />
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">View All Company Tickets</span>
                  <p className="text-xs text-gray-500">See all tickets from the company, not just their own</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={newIsAdmin} onChange={e => setNewIsAdmin(e.target.checked)}
                  className="w-4 h-4 text-accent-blue rounded border-gray-300 focus:ring-accent-blue" />
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Company Administrator</span>
                  <p className="text-xs text-gray-500">Can manage users and permissions for this company</p>
                </div>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="tb-btn-primary px-6 py-2">Create User</button>
              <button type="button" onClick={() => setShowCreate(false)} className="tb-btn-secondary px-4 py-2">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : users.length === 0 ? (
        <div className="tb-card p-8 text-center">
          <Users className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No users found. Create the first user for your company.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <div key={u.id} className="tb-card p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 dark:text-white">{u.name}</span>
                    {u.is_company_admin && (
                      <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">Admin</span>
                    )}
                    {u.id === user?.id && (
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">You</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{u.email}</p>
                  <p className="text-xs text-gray-400 mt-1">Joined {new Date(u.created_at).toLocaleDateString()}</p>
                </div>

                {/* Permission toggles */}
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => handleToggle(u.id, 'canCreateTickets', !u.can_create_tickets)}
                      disabled={u.id === user?.id}
                      className={`p-2 rounded-lg transition-colors ${u.can_create_tickets ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'} ${u.id === user?.id ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
                      title={u.can_create_tickets ? 'Can create tickets' : 'Cannot create tickets'}>
                      <Ticket className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] text-gray-500">Create</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => handleToggle(u.id, 'companyTicketVisibility', !u.company_ticket_visibility)}
                      disabled={u.id === user?.id}
                      className={`p-2 rounded-lg transition-colors ${u.company_ticket_visibility ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'} ${u.id === user?.id ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
                      title={u.company_ticket_visibility ? 'Can see all company tickets' : 'Can only see own tickets'}>
                      {u.company_ticket_visibility ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <span className="text-[10px] text-gray-500">View All</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => handleToggle(u.id, 'isCompanyAdmin', !u.is_company_admin)}
                      disabled={u.id === user?.id}
                      className={`p-2 rounded-lg transition-colors ${u.is_company_admin ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'} ${u.id === user?.id ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
                      title={u.is_company_admin ? 'Company administrator' : 'Regular user'}>
                      {u.is_company_admin ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                    </button>
                    <span className="text-[10px] text-gray-500">Admin</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-2 border-l border-gray-200 dark:border-gray-700 pl-3">
                    <button onClick={() => { setResetUserId(u.id); setResetPassword(''); }}
                      disabled={u.id === user?.id}
                      className="p-2 text-gray-400 hover:text-amber-500 transition-colors disabled:opacity-30"
                      title="Reset password">
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(u)}
                      disabled={u.id === user?.id}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30"
                      title="Remove user">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Reset password inline form */}
              {resetUserId === u.id && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
                  <input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)}
                    placeholder="New password (min 8 chars)" className="tb-input flex-1 text-sm" />
                  <button onClick={handleResetPassword} disabled={resetPassword.length < 8}
                    className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg disabled:opacity-30 transition-colors">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setResetUserId(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
