import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tickets as ticketsApi, engineers as engineersApi } from '../../api/client';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import { RefreshCw, Download, Trash2, CheckSquare } from 'lucide-react';

export default function TicketList() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [engineers, setEngineers] = useState<any[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkEngineer, setBulkEngineer] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = () => {
    setLoading(true);
    setSelected(new Set());
    const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v));
    Promise.all([
      ticketsApi.list(params),
      engineersApi.list(),
    ]).then(([d, e]) => { setData(d); setEngineers(e); })
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters]);

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data?.tickets) return;
    const allIds = data.tickets.map((t: any) => t.id);
    if (selected.size === allIds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  };

  const handleBulkStatus = async () => {
    if (!bulkStatus || selected.size === 0) return;
    setActionLoading(true);
    try {
      await ticketsApi.bulkStatus(Array.from(selected), bulkStatus);
      setBulkStatus('');
      load();
    } catch (err) { console.error(err); }
    setActionLoading(false);
  };

  const handleBulkAssign = async () => {
    if (!bulkEngineer || selected.size === 0) return;
    setActionLoading(true);
    try {
      await ticketsApi.bulkAssign(Array.from(selected), parseInt(bulkEngineer));
      setBulkEngineer('');
      load();
    } catch (err) { console.error(err); }
    setActionLoading(false);
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} selected ticket(s)? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      await ticketsApi.bulkDelete(Array.from(selected));
      load();
    } catch (err) { console.error(err); }
    setActionLoading(false);
  };

  const handleDelete = async (id: number, ticketNumber: string) => {
    if (!window.confirm(`Delete ticket ${ticketNumber}? This cannot be undone.`)) return;
    try {
      await ticketsApi.delete(id);
      load();
    } catch (err) { console.error(err); }
  };

  const exportCSV = () => {
    if (!data?.tickets?.length) return;
    const headers = ['Ticket Number', 'Subject', 'Product', 'Status', 'Priority', 'Engineer', 'AI Confidence', 'Created'];
    const rows = data.tickets.map((t: any) => [
      t.ticketNumber, t.subject, t.productName, t.status, t.priority,
      t.engineerName || '', t.aiConfidence != null ? (t.aiConfidence * 100).toFixed(0) + '%' : '',
      new Date(t.createdAt).toLocaleDateString()
    ]);
    const csv = [headers, ...rows].map(r => r.map((c: string) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Tickets</h1>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} disabled={!data?.tickets?.length} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-accent-blue border border-gray-300 dark:border-gray-600 rounded-lg hover:border-accent-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button onClick={load} className="p-2 text-gray-500 dark:text-gray-400 hover:text-accent-blue transition-colors">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <select value={filters.status || ''} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="tb-select">
          <option value="">All Statuses</option>
          {['new', 'analyzing', 'assigned', 'in_progress', 'pending_info', 'resolved', 'closed'].map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select value={filters.priority || ''} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))} className="tb-select">
          <option value="">All Priorities</option>
          {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-accent-blue/10 border border-accent-blue/30 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium text-accent-blue">
            <CheckSquare className="w-4 h-4" />
            {selected.size} selected
          </div>
          <div className="flex items-center gap-2 ml-4">
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} className="tb-select text-sm">
              <option value="">Change Status...</option>
              {['new', 'analyzing', 'assigned', 'in_progress', 'pending_info', 'resolved', 'closed'].map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
            <button onClick={handleBulkStatus} disabled={!bulkStatus || actionLoading}
              className="px-3 py-1.5 text-sm font-medium bg-accent-blue text-white rounded-lg hover:bg-accent-blue/80 disabled:opacity-50 transition-colors">
              Apply
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select value={bulkEngineer} onChange={e => setBulkEngineer(e.target.value)} className="tb-select text-sm">
              <option value="">Assign to...</option>
              {engineers.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <button onClick={handleBulkAssign} disabled={!bulkEngineer || actionLoading}
              className="px-3 py-1.5 text-sm font-medium bg-accent-blue text-white rounded-lg hover:bg-accent-blue/80 disabled:opacity-50 transition-colors">
              Assign
            </button>
          </div>
          <button onClick={handleBulkDelete} disabled={actionLoading}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 disabled:opacity-50 transition-colors">
            <Trash2 className="w-4 h-4" />
            Delete Selected
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="tb-card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-black/5 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox"
                    checked={data?.tickets?.length > 0 && selected.size === data.tickets.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 dark:border-gray-600 text-accent-blue focus:ring-accent-blue"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ticket</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Engineer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">AI</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data?.tickets?.map((t: any) => (
                <tr key={t.id} className={`hover:bg-black/5 dark:hover:bg-white/5 ${selected.has(t.id) ? 'bg-accent-blue/5' : ''}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggleSelect(t.id)}
                      className="rounded border-gray-300 dark:border-gray-600 text-accent-blue focus:ring-accent-blue"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/tickets/${t.id}`} className="text-sm font-mono text-accent-blue hover:underline">{t.ticketNumber}</Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 max-w-xs truncate">{t.subject}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{t.productName}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{t.engineerName || '\u2014'}</td>
                  <td className="px-4 py-3 text-sm">
                    {t.aiConfidence != null ? (
                      <span className={`font-medium ${t.aiConfidence >= 0.7 ? 'text-accent-green' : 'text-accent-amber'}`}>
                        {(t.aiConfidence * 100).toFixed(0)}%
                      </span>
                    ) : '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(t.id, t.ticketNumber)} title="Delete ticket"
                      className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && (
            <div className="px-4 py-3 bg-black/5 dark:bg-white/5 text-sm text-gray-500">
              Showing {data.tickets.length} of {data.total} tickets (Page {data.page}/{data.totalPages})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
