import React, { useState } from 'react';
import { tickets } from '../api/client';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { Search } from 'lucide-react';

export default function TicketTracker() {
  const [ticketNumber, setTicketNumber] = useState('');
  const [ticket, setTicket] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketNumber.trim()) return;
    setError('');
    setTicket(null);
    setLoading(true);
    try {
      const result = await tickets.track(ticketNumber.trim());
      setTicket(result);
    } catch {
      setError('Ticket not found. Please check the ticket number.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Track Your Ticket</h1>

      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input type="text" value={ticketNumber} onChange={e => setTicketNumber(e.target.value)}
            placeholder="Enter ticket number (e.g., TKT-...)"
            className="tb-input pl-10" />
        </div>
        <button type="submit" disabled={loading} className="tb-btn-primary px-6">
          {loading ? 'Searching...' : 'Track'}
        </button>
      </form>

      {error && <div className="p-4 bg-status-expired-bg text-status-expired-text rounded-lg">{error}</div>}

      {ticket && (
        <div className="tb-card p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500 font-mono">{ticket.ticketNumber}</p>
              <h2 className="text-xl font-semibold text-white mt-1">{ticket.subject}</h2>
            </div>
            <div className="flex gap-2">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div>
              <p className="text-sm text-gray-500">Product</p>
              <p className="font-medium text-white">{ticket.productName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Category</p>
              <p className="font-medium text-white">{ticket.categoryName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Assigned Engineer</p>
              <p className="font-medium text-white">{ticket.engineerName || 'Pending assignment'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Created</p>
              <p className="font-medium text-white">{new Date(ticket.createdAt).toLocaleString()}</p>
            </div>
            {ticket.resolvedAt && (
              <div>
                <p className="text-sm text-gray-500">Resolved</p>
                <p className="font-medium text-white">{new Date(ticket.resolvedAt).toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
