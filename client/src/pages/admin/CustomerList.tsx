import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { admin } from '../../api/client';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import { Users, Search, ChevronDown, ChevronRight, Save, ExternalLink, Globe, FileText, Building2, User, Ticket, Plus, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface Customer {
  id: number;
  email: string;
  name: string;
  company: string | null;
  role: string;
  is_anonymous: boolean;
  created_at: string;
  ticket_count: number;
  last_ticket_at: string | null;
}

interface CompanyGroup {
  name: string;
  customers: Customer[];
  totalTickets: number;
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const specials = '!@#$%&*';
  let pw = '';
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  pw += specials[Math.floor(Math.random() * specials.length)];
  pw += String(Math.floor(Math.random() * 10));
  return pw;
}

export default function CustomerList() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [userTickets, setUserTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create customer form
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', name: '', company: '', password: '' });
  const [createSaving, setCreateSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loadCustomers = () => {
    admin.customers()
      .then(setCustomers)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCustomers(); }, []);

  const handleCreate = async () => {
    if (!createForm.email || !createForm.name || !createForm.password) {
      toast.error('Email, name, and password are required');
      return;
    }
    setCreateSaving(true);
    try {
      await admin.createCustomer({
        email: createForm.email,
        name: createForm.name,
        company: createForm.company || undefined,
        password: createForm.password,
      });
      toast.success('Customer created successfully');
      setCreating(false);
      setCreateForm({ email: '', name: '', company: '', password: '' });
      loadCustomers();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create customer');
    }
    setCreateSaving(false);
  };

  // Group customers by company
  const buildCompanyGroups = (): CompanyGroup[] => {
    const map = new Map<string, Customer[]>();
    const q = search.toLowerCase();

    for (const c of customers) {
      if (q && !(
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q)
      )) continue;

      const companyName = c.company?.trim() || 'No Company';
      if (!map.has(companyName)) map.set(companyName, []);
      map.get(companyName)!.push(c);
    }

    const groups: CompanyGroup[] = [];
    for (const [name, custs] of map) {
      groups.push({
        name,
        customers: custs.sort((a, b) => (b.ticket_count || 0) - (a.ticket_count || 0)),
        totalTickets: custs.reduce((sum, c) => sum + (c.ticket_count || 0), 0),
      });
    }

    // Sort: companies with tickets first, then alphabetically
    groups.sort((a, b) => {
      if (a.name === 'No Company') return 1;
      if (b.name === 'No Company') return -1;
      return b.totalTickets - a.totalTickets || a.name.localeCompare(b.name);
    });

    return groups;
  };

  const toggleCompany = (name: string) => {
    if (expandedCompany === name) {
      setExpandedCompany(null);
      setExpandedUser(null);
      setEditData(null);
      setUserTickets([]);
    } else {
      setExpandedCompany(name);
      setExpandedUser(null);
      setEditData(null);
      setUserTickets([]);
    }
  };

  const toggleUser = async (id: number) => {
    if (expandedUser === id) {
      setExpandedUser(null);
      setEditData(null);
      setUserTickets([]);
      return;
    }
    setExpandedUser(id);
    setTicketsLoading(true);
    try {
      const [detail, tickets] = await Promise.all([
        admin.getCustomer(id),
        admin.customerTickets(id),
      ]);
      setEditData({
        isCompanyAdmin: !!detail.is_company_admin,
        canCreateTickets: detail.can_create_tickets !== false,
        companyTicketVisibility: !!detail.company_ticket_visibility,
        environmentNotes: detail.environment_notes || '',
        externalLinks: detail.externalLinks || [],
        professionalServiceHours: detail.professional_service_hours || 0,
      });
      setUserTickets(tickets);
    } catch (err) { console.error(err); }
    setTicketsLoading(false);
  };

  const handleSave = async (id: number) => {
    if (!editData) return;
    setSaving(true);
    try {
      await admin.updateCustomer(id, editData);
      loadCustomers();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const addLink = () => {
    if (!editData) return;
    setEditData({ ...editData, externalLinks: [...editData.externalLinks, { label: '', url: '' }] });
  };

  const updateLink = (index: number, field: string, value: string) => {
    if (!editData) return;
    const links = [...editData.externalLinks];
    links[index] = { ...links[index], [field]: value };
    setEditData({ ...editData, externalLinks: links });
  };

  const removeLink = (index: number) => {
    if (!editData) return;
    setEditData({ ...editData, externalLinks: editData.externalLinks.filter((_: any, i: number) => i !== index) });
  };

  const companyGroups = buildCompanyGroups();

  if (loading) return <div className="text-center py-12 text-gray-500">Loading customers...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-accent-blue" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Companies & Customers</h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ({companyGroups.length} companies, {customers.filter(c => c.role === 'customer').length} users)
          </span>
        </div>
        <button
          onClick={() => { setCreating(!creating); setCreateForm({ email: '', name: '', company: '', password: '' }); setShowPassword(false); }}
          className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/80 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      {/* Create Customer Form */}
      {creating && (
        <div className="tb-card p-5 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">New Customer</h3>
          <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Name *</label>
              <input type="text" value={createForm.name}
                onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Full name" className="tb-input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Email *</label>
              <input type="email" value={createForm.email}
                onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="email@company.com" className="tb-input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Company</label>
              <input type="text" value={createForm.company}
                onChange={e => setCreateForm({ ...createForm, company: e.target.value })}
                placeholder="Company name (optional)" className="tb-input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Password *</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input type={showPassword ? 'text' : 'password'} value={createForm.password}
                    onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Min 8 chars, upper+lower+number" className="tb-input w-full pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button type="button" onClick={() => { setCreateForm({ ...createForm, password: generatePassword() }); setShowPassword(true); }}
                  className="flex items-center gap-1 px-3 py-2 text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
                  title="Generate password">
                  <RefreshCw className="w-3.5 h-3.5" /> Generate
                </button>
              </div>
            </div>
            <div className="col-span-2 flex gap-3 justify-end mt-2">
              <button onClick={() => setCreating(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={createSaving}
                className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/80 disabled:opacity-50 transition-colors">
                <Plus className="w-4 h-4" />
                {createSaving ? 'Creating...' : 'Create Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or company..."
            className="tb-input w-full pl-10"
          />
        </div>
      </div>

      <div className="space-y-3">
        {companyGroups.length === 0 ? (
          <div className="tb-card p-8 text-center text-gray-500 dark:text-gray-400">
            {search ? 'No companies match your search.' : 'No customers found.'}
          </div>
        ) : (
          companyGroups.map(group => (
            <div key={group.name} className="tb-card overflow-hidden">
              {/* Company Header */}
              <button
                onClick={() => toggleCompany(group.name)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
              >
                {expandedCompany === group.name
                  ? <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                  : <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                }
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Building2 className="w-5 h-5 text-accent-blue shrink-0" />
                  <span className="font-semibold text-gray-900 dark:text-white truncate">
                    {group.name}
                  </span>
                </div>
                <div className="flex items-center gap-6 shrink-0 text-sm">
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                    <Users className="w-4 h-4" />
                    <span>{group.customers.length} user{group.customers.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                    <Ticket className="w-4 h-4" />
                    <span>{group.totalTickets} ticket{group.totalTickets !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </button>

              {/* Expanded: Users List */}
              {expandedCompany === group.name && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  {group.customers.map(c => (
                    <div key={c.id}>
                      {/* User Row */}
                      <button
                        onClick={() => toggleUser(c.id)}
                        className="w-full flex items-center gap-4 px-5 py-3 pl-12 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left border-b border-gray-100 dark:border-gray-800"
                      >
                        {expandedUser === c.id
                          ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                          : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                        }
                        <User className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0 flex items-center gap-3">
                          <span className="font-medium text-gray-900 dark:text-white text-sm">
                            {c.name || 'Unknown'}
                          </span>
                          {c.is_anonymous && (
                            <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-[10px] rounded font-medium">
                              Anonymous
                            </span>
                          )}
                          <span className="text-xs text-gray-400 truncate">{c.email}</span>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 text-sm text-gray-500 dark:text-gray-400">
                          <span>{c.ticket_count || 0} ticket{(c.ticket_count || 0) !== 1 ? 's' : ''}</span>
                          <span className="text-xs">
                            {c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}
                          </span>
                        </div>
                      </button>

                      {/* Expanded User Detail */}
                      {expandedUser === c.id && (
                        <div className="bg-gray-50 dark:bg-white/5 px-5 py-4 pl-20 border-b border-gray-100 dark:border-gray-800">
                          {ticketsLoading ? (
                            <div className="text-sm text-gray-400 py-2">Loading...</div>
                          ) : (
                            <div className="space-y-5">
                              {/* User Tickets */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
                                  <Ticket className="w-4 h-4 text-accent-blue" />
                                  Tickets ({userTickets.length})
                                </h4>
                                {userTickets.length === 0 ? (
                                  <p className="text-xs text-gray-400">No tickets.</p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                          <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-500">Ticket</th>
                                          <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-500">Subject</th>
                                          <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-500">Product</th>
                                          <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-500">Priority</th>
                                          <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-500">Status</th>
                                          <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-500">Created</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {userTickets.map((t: any) => (
                                          <tr key={t.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-white dark:hover:bg-white/5 transition-colors">
                                            <td className="py-1.5 px-2">
                                              <Link to={`/admin/tickets/${t.id}`} className="text-accent-blue hover:underline font-mono text-xs">
                                                {t.ticket_number}
                                              </Link>
                                            </td>
                                            <td className="py-1.5 px-2 text-gray-700 dark:text-gray-200 max-w-xs truncate text-xs">{t.subject}</td>
                                            <td className="py-1.5 px-2 text-gray-500 text-xs">{t.product_name || '-'}</td>
                                            <td className="py-1.5 px-2"><PriorityBadge priority={t.priority} /></td>
                                            <td className="py-1.5 px-2"><StatusBadge status={t.status} /></td>
                                            <td className="py-1.5 px-2 text-gray-500 text-xs">
                                              {t.created_at ? new Date(t.created_at).toLocaleDateString() : '-'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>

                              {/* User Settings */}
                              {editData && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Settings</h4>
                                  <div className="grid md:grid-cols-2 gap-4 max-w-4xl">
                                    {/* Company Admin */}
                                    <div className="col-span-2">
                                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={editData.isCompanyAdmin || false}
                                          onChange={e => setEditData({ ...editData, isCompanyAdmin: e.target.checked })}
                                          className="rounded border-gray-300 dark:border-gray-600 text-purple-500 focus:ring-purple-500" />
                                        <span className="text-gray-700 dark:text-gray-200">Company Administrator</span>
                                      </label>
                                      <p className="text-xs text-gray-500 ml-6 mt-1">
                                        Can manage users and permissions for <strong>{c.company || 'their company'}</strong>.
                                      </p>
                                    </div>

                                    {/* Can Create Tickets */}
                                    <div className="col-span-2">
                                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={editData.canCreateTickets !== false}
                                          onChange={e => setEditData({ ...editData, canCreateTickets: e.target.checked })}
                                          className="rounded border-gray-300 dark:border-gray-600 text-accent-blue focus:ring-accent-blue" />
                                        <span className="text-gray-700 dark:text-gray-200">Can create tickets</span>
                                      </label>
                                      <p className="text-xs text-gray-500 ml-6 mt-1">
                                        Allow this user to submit new support tickets.
                                      </p>
                                    </div>

                                    {/* Company Ticket Visibility */}
                                    <div className="col-span-2">
                                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={editData.companyTicketVisibility}
                                          onChange={e => setEditData({ ...editData, companyTicketVisibility: e.target.checked })}
                                          className="rounded border-gray-300 dark:border-gray-600 text-accent-blue focus:ring-accent-blue" />
                                        <span className="text-gray-700 dark:text-gray-200">View all company tickets</span>
                                      </label>
                                      <p className="text-xs text-gray-500 ml-6 mt-1">
                                        When enabled, this user can view all tickets from <strong>{c.company || 'their company'}</strong>.
                                      </p>
                                    </div>

                                    {/* Professional Service Hours */}
                                    <div className="col-span-2">
                                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Professional Service Hours</label>
                                      <div className="flex items-center gap-3">
                                        <input type="number" min="0" step="0.5" value={editData.professionalServiceHours}
                                          onChange={e => setEditData({ ...editData, professionalServiceHours: parseFloat(e.target.value) || 0 })}
                                          className="tb-input w-32" />
                                        <span className="text-sm text-gray-500">hours allocated</span>
                                      </div>
                                    </div>

                                    {/* Environment Notes */}
                                    <div>
                                      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                                        <FileText className="w-3.5 h-3.5" /> Environment Notes
                                      </label>
                                      <textarea value={editData.environmentNotes}
                                        onChange={e => setEditData({ ...editData, environmentNotes: e.target.value })}
                                        rows={4} placeholder="Technical environment info, OS, network setup..."
                                        className="tb-input w-full text-sm" />
                                    </div>

                                    {/* External Links */}
                                    <div>
                                      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                                        <Globe className="w-3.5 h-3.5" /> External Links
                                      </label>
                                      <div className="space-y-2">
                                        {editData.externalLinks.map((link: any, i: number) => (
                                          <div key={i} className="flex gap-2">
                                            <input type="text" value={link.label} onChange={e => updateLink(i, 'label', e.target.value)}
                                              placeholder="Label" className="tb-input flex-1 text-sm" />
                                            <input type="url" value={link.url} onChange={e => updateLink(i, 'url', e.target.value)}
                                              placeholder="URL" className="tb-input flex-1 text-sm" />
                                            <button onClick={() => removeLink(i)} className="text-gray-400 hover:text-red-400 text-sm">Remove</button>
                                          </div>
                                        ))}
                                        <button onClick={addLink} className="text-xs text-accent-blue hover:underline">+ Add Link</button>
                                      </div>
                                    </div>

                                    {/* Save */}
                                    <div className="col-span-2 flex justify-end">
                                      <button onClick={() => handleSave(c.id)} disabled={saving}
                                        className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/80 disabled:opacity-50 transition-colors">
                                        <Save className="w-4 h-4" />
                                        {saving ? 'Saving...' : 'Save Changes'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
