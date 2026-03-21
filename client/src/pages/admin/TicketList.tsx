import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tickets as ticketsApi } from '../../api/client';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import { RefreshCw, Download } from 'lucide-react';

export default function TicketList() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v));
    ticketsApi.list(params).then(setData).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters]);

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

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="tb-card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-black/5 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ticket</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Engineer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">AI</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data?.tickets?.map((t: any) => (
                <tr key={t.id} className="hover:bg-black/5 dark:hover:bg-white/5">
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
