import React, { useEffect, useState } from 'react';
import { admin } from '../../api/client';
import { Users, Search, ChevronDown, ChevronUp, Save, ExternalLink, Globe, FileText } from 'lucide-react';

export default function CustomerList() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const loadCustomers = () => {
    admin.customers()
      .then(setCustomers)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCustomers(); }, []);

  const handleExpand = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); setEditData(null); return; }
    setExpandedId(id);
    try {
      const data = await admin.getCustomer(id);
      setEditData({
        companyTicketVisibility: !!data.company_ticket_visibility,
        environmentNotes: data.environment_notes || '',
        externalLinks: data.externalLinks || [],
        professionalServiceHours: data.professional_service_hours || 0,
      });
    } catch (err) { console.error(err); }
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

  const filtered = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q)
    );
  });

  if (loading) return <div className="text-center py-12 text-gray-500">Loading customers...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-accent-blue" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers</h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">({customers.length})</span>
        </div>
      </div>

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

      <div className="tb-card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Company</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tickets</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last Ticket</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Registered</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  {search ? 'No customers match your search.' : 'No customers found.'}
                </td>
              </tr>
            ) : (
              filtered.map((c: any) => (
                <React.Fragment key={c.id}>
                  <tr className="hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer" onClick={() => handleExpand(c.id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{c.name || 'Unknown'}</span>
                        {c.isAnonymous && (
                          <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded font-medium">
                            Anonymous
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{c.company || '\u2014'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{c.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 font-medium">{c.ticketCount ?? 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {c.lastTicketAt ? new Date(c.lastTicketAt).toLocaleDateString() : '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '\u2014'}
                    </td>
                    <td className="px-4 py-3">
                      {expandedId === c.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </td>
                  </tr>
                  {expandedId === c.id && editData && (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 bg-gray-50 dark:bg-white/5">
                        <div className="grid md:grid-cols-2 gap-4 max-w-4xl">
                          {/* Company Ticket Visibility */}
                          <div className="col-span-2">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input type="checkbox" checked={editData.companyTicketVisibility}
                                onChange={e => setEditData({ ...editData, companyTicketVisibility: e.target.checked })}
                                className="rounded border-gray-300 dark:border-gray-600 text-accent-blue focus:ring-accent-blue" />
                              <span className="text-gray-700 dark:text-gray-200">Allow this customer to see all company-wide tickets</span>
                            </label>
                            <p className="text-xs text-gray-500 ml-6 mt-1">When enabled, this customer can view tickets from all users in their company ({c.company || 'no company set'}).</p>
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
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
