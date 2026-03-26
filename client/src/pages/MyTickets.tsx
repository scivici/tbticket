import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tickets as ticketsApi } from '../api/client';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { Search } from 'lucide-react';

export default function MyTickets() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (status) params.status = status;
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    ticketsApi.list(params)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [search, status, fromDate, toDate]);

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Please <Link to="/login" className="text-accent-blue hover:underline">sign in</Link> to view your tickets.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">My Tickets</h1>

      {/* Search & Filters */}
      <div className="tb-card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by subject, description, or ticket number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="tb-input w-full pl-10"
            />
          </div>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="tb-select"
          >
            <option value="">All Statuses</option>
            {['new', 'analyzing', 'assigned', 'in_progress', 'pending_info', 'escalated_to_jira', 'resolved', 'closed'].map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="tb-input"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">To</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="tb-input"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading tickets...</div>
      ) : !data?.tickets?.length ? (
        <div className="text-center py-12 tb-card">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {search || status || fromDate || toDate
              ? 'No tickets match your filters.'
              : "You haven't submitted any tickets yet."}
          </p>
          {!search && !status && !fromDate && !toDate && (
            <Link to="/submit" className="text-accent-blue hover:underline font-medium">Submit your first ticket</Link>
          )}
        </div>
      ) : (
        <div className="tb-card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-tb-card-inner/10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ticket</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.tickets.map((ticket: any) => (
                <tr key={ticket.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                  <td className="px-6 py-4 text-sm font-mono"><Link to={`/my-tickets/${ticket.id}`} className="text-accent-blue hover:underline">{ticket.ticketNumber}</Link></td>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-200">{ticket.subject}</td>
                  <td className="px-6 py-4"><StatusBadge status={ticket.status} /></td>
                  <td className="px-6 py-4"><PriorityBadge priority={ticket.priority} /></td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{new Date(ticket.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
