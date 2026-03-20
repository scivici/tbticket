import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tickets as ticketsApi } from '../../api/client';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import { RefreshCw } from 'lucide-react';

export default function TicketList() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v));
    ticketsApi.list(params)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">All Tickets</h1>
        <button onClick={load} className="p-2 text-gray-500 hover:text-primary-600">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select value={filters.status || ''} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">All Statuses</option>
          {['new', 'analyzing', 'assigned', 'in_progress', 'pending_info', 'resolved', 'closed'].map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select value={filters.priority || ''} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">All Priorities</option>
          {['low', 'medium', 'high', 'critical'].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Engineer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">AI</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data?.tickets?.map((t: any) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/admin/tickets/${t.id}`} className="text-sm font-mono text-primary-600 hover:underline">
                      {t.ticketNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm max-w-xs truncate">{t.subject}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{t.productName}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{t.engineerName || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {t.aiConfidence != null ? (
                      <span className={`font-medium ${t.aiConfidence >= 0.7 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {(t.aiConfidence * 100).toFixed(0)}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && (
            <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500">
              Showing {data.tickets.length} of {data.total} tickets (Page {data.page}/{data.totalPages})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
