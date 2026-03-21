import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tickets as ticketsApi } from '../api/client';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';

export default function MyTickets() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    ticketsApi.list()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Please <Link to="/login" className="text-accent-blue hover:underline">sign in</Link> to view your tickets.</p>
      </div>
    );
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading tickets...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">My Tickets</h1>

      {!data?.tickets?.length ? (
        <div className="text-center py-12 tb-card">
          <p className="text-gray-400 mb-4">You haven't submitted any tickets yet.</p>
          <Link to="/submit" className="text-accent-blue hover:underline font-medium">Submit your first ticket</Link>
        </div>
      ) : (
        <div className="tb-card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-tb-card-inner/10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Ticket</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {data.tickets.map((ticket: any) => (
                <tr key={ticket.id} className="hover:bg-white/5">
                  <td className="px-6 py-4 text-sm font-mono text-accent-blue">{ticket.ticketNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-200">{ticket.subject}</td>
                  <td className="px-6 py-4"><StatusBadge status={ticket.status} /></td>
                  <td className="px-6 py-4"><PriorityBadge priority={ticket.priority} /></td>
                  <td className="px-6 py-4 text-sm text-gray-400">{new Date(ticket.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
