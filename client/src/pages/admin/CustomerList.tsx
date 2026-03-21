import React, { useEffect, useState } from 'react';
import { admin } from '../../api/client';
import { Users, Search } from 'lucide-react';

export default function CustomerList() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    admin.customers()
      .then(setCustomers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  {search ? 'No customers match your search.' : 'No customers found.'}
                </td>
              </tr>
            ) : (
              filtered.map((c: any) => (
                <tr key={c.id} className="hover:bg-black/5 dark:hover:bg-white/5">
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
