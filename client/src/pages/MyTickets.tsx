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
        <p className="text-gray-500">Please <Link to="/login" className="text-primary-600 hover:underline">sign in</Link> to view your tickets.</p>
      </div>
    );
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading tickets...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Tickets</h1>

      {!data?.tickets?.length ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-500 mb-4">You haven't submitted any tickets yet.</p>
          <Link to="/submit" className="text-primary-600 hover:underline font-medium">Submit your first ticket</Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.tickets.map((ticket: any) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono text-primary-600">
                    <Link to={`/track`} className="hover:underline">{ticket.ticketNumber}</Link>
                  </td>
                  <td className="px-6 py-4 text-sm">{ticket.subject}</td>
                  <td className="px-6 py-4"><StatusBadge status={ticket.status} /></td>
                  <td className="px-6 py-4"><PriorityBadge priority={ticket.priority} /></td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(ticket.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
