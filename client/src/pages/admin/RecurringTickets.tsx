import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { admin } from '../../api/client';
import { Repeat, Search } from 'lucide-react';

export default function RecurringTickets() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [minCount, setMinCount] = useState(2);
  const [daysBack, setDaysBack] = useState(90);

  const load = () => {
    setLoading(true);
    admin.recurringTickets(minCount, daysBack)
      .then(setData)
      .catch(err => { console.error(err); setData([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleFilter = () => { load(); };

  const getCountColor = (count: number) => {
    if (count >= 5) return 'bg-red-500/20 text-red-500';
    if (count >= 3) return 'bg-orange-500/20 text-orange-500';
    return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recurring Tickets</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Detect customers with multiple tickets on the same product/category.</p>
      </div>

      {/* Filter Controls */}
      <div className="tb-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Min Ticket Count</label>
            <input
              type="number"
              min={2}
              value={minCount}
              onChange={e => setMinCount(Math.max(2, parseInt(e.target.value) || 2))}
              className="tb-input w-28"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Days Back</label>
            <input
              type="number"
              min={1}
              value={daysBack}
              onChange={e => setDaysBack(Math.max(1, parseInt(e.target.value) || 90))}
              className="tb-input w-28"
            />
          </div>
          <button onClick={handleFilter} className="tb-btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            <Search className="w-4 h-4" /> Search
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading recurring patterns...</div>
      ) : data.length === 0 ? (
        <div className="tb-card p-8 text-center">
          <Repeat className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No recurring patterns detected.</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting the filters above.</p>
        </div>
      ) : (
        <div className="tb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Count</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last Ticket</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tickets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.map((row: any, i: number) => {
                  const count = row.ticketCount || row.ticket_count || 0;
                  const ticketNumbers = row.ticketNumbers || row.ticket_numbers || [];
                  const ticketIds = row.ticketIds || row.ticket_ids || [];
                  return (
                    <tr key={i} className="hover:bg-black/5 dark:hover:bg-white/5">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {row.customerName || row.customer_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                        {row.company || '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                        {row.productName || row.product_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                        {row.categoryName || row.category_name}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getCountColor(count)}`}>
                          {count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                        {row.lastTicketDate || row.last_ticket_date
                          ? new Date(row.lastTicketDate || row.last_ticket_date).toLocaleDateString()
                          : '\u2014'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(ticketNumbers) ? ticketNumbers : []).map((tn: string, j: number) => (
                            <Link
                              key={j}
                              to={`/admin/tickets/${Array.isArray(ticketIds) ? ticketIds[j] : ''}`}
                              className="text-xs font-mono text-accent-blue hover:underline"
                            >
                              {tn}
                            </Link>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
