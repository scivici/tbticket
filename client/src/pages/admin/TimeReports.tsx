import React, { useEffect, useState } from 'react';
import { admin, engineers as engineersApi, products as productsApi } from '../../api/client';
import { Clock, Download, Filter, BarChart3 } from 'lucide-react';

const ACTIVITY_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'investigation', label: 'Investigation' },
  { value: 'configuration', label: 'Configuration' },
  { value: 'testing', label: 'Testing' },
  { value: 'customer_call', label: 'Customer Call' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'internal_meeting', label: 'Internal Meeting' },
  { value: 'escalation', label: 'Escalation' },
];

type Tab = 'engineer' | 'customer' | 'activity';

export default function TimeReports() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [engineers, setEngineers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('engineer');
  const [sortAsc, setSortAsc] = useState(false);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [engineerId, setEngineerId] = useState('');
  const [productId, setProductId] = useState('');
  const [activityType, setActivityType] = useState('');

  useEffect(() => {
    Promise.all([
      engineersApi.list().catch(() => []),
      productsApi.list().catch(() => []),
    ]).then(([eng, prod]) => {
      setEngineers(eng);
      setProducts(prod);
    });
    loadReport();
  }, []);

  const loadReport = (filters?: any) => {
    setLoading(true);
    const f = filters || { fromDate, toDate, engineerId, productId, activityType };
    // Strip empty values
    const clean: any = {};
    Object.entries(f).forEach(([k, v]) => { if (v) clean[k] = v; });
    admin.timeReport(clean)
      .then(setReport)
      .catch(err => { console.error(err); setReport(null); })
      .finally(() => setLoading(false));
  };

  const handleApply = () => loadReport();
  const handleClear = () => {
    setFromDate('');
    setToDate('');
    setEngineerId('');
    setProductId('');
    setActivityType('');
    loadReport({});
  };

  const sortedEntries = report?.entries
    ? [...report.entries].sort((a: any, b: any) => {
        const cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
        return sortAsc ? cmp : -cmp;
      })
    : [];

  const exportCSV = () => {
    if (!sortedEntries.length) return;
    const headers = ['Date', 'Ticket#', 'Subject', 'Support Specialist', 'Activity Type', 'Hours', 'Chargeable', 'Description'];
    const rows = sortedEntries.map((e: any) => [
      e.date,
      e.ticket_number || '',
      `"${(e.subject || '').replace(/"/g, '""')}"`,
      e.engineer_name || '',
      e.activity_type || 'general',
      e.hours,
      e.is_chargeable ? 'Yes' : 'No',
      `"${(e.description || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const overall = report?.overall || { total_hours: 0, chargeable_hours: 0, non_chargeable_hours: 0, ticket_count: 0 };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'engineer', label: 'By Support Specialist' },
    { key: 'customer', label: 'By Customer' },
    { key: 'activity', label: 'By Activity' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Time Reports</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Analyze time entries across support specialists, customers, and activities.</p>
        </div>
        <button onClick={exportCSV} disabled={!sortedEntries.length}
          className="tb-btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="tb-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-accent-blue" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Filters</span>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="tb-input w-40" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="tb-input w-40" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Support Specialist</label>
            <select value={engineerId} onChange={e => setEngineerId(e.target.value)} className="tb-select w-44">
              <option value="">All Support Specialists</option>
              {engineers.map((eng: any) => (
                <option key={eng.id} value={eng.id}>{eng.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Product</label>
            <select value={productId} onChange={e => setProductId(e.target.value)} className="tb-select w-44">
              <option value="">All Products</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Activity Type</label>
            <select value={activityType} onChange={e => setActivityType(e.target.value)} className="tb-select w-44">
              <option value="">All Activities</option>
              {ACTIVITY_TYPES.map(at => (
                <option key={at.value} value={at.value}>{at.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleApply} className="tb-btn-primary flex items-center gap-2 px-4 py-2 text-sm">
              <BarChart3 className="w-4 h-4" /> Apply
            </button>
            <button onClick={handleClear} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
              Clear
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading report...</div>
      ) : !report ? (
        <div className="text-center py-12 text-red-400">Failed to load report data.</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard icon={<Clock className="w-5 h-5" />} label="Total Hours" value={Number(overall.total_hours || 0).toFixed(1)} color="blue" />
            <SummaryCard icon={<Clock className="w-5 h-5" />} label="Chargeable Hours" value={Number(overall.chargeable_hours || 0).toFixed(1)} color="green" />
            <SummaryCard icon={<Clock className="w-5 h-5" />} label="Non-Chargeable Hours" value={Number(overall.non_chargeable_hours || 0).toFixed(1)} color="amber" />
            <SummaryCard icon={<BarChart3 className="w-5 h-5" />} label="Tickets" value={overall.ticket_count || 0} color="purple" />
          </div>

          {/* Tabs */}
          <div className="tb-card">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab.key
                      ? 'border-accent-blue text-accent-blue'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="p-4 overflow-x-auto">
              {activeTab === 'engineer' && (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Support Specialist</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Hours</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Chargeable</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tickets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {(report.engineerReport || []).map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{row.engineer_name || row.name}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-200">{Number(row.total_hours || 0).toFixed(1)}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-200">{Number(row.chargeable_hours || 0).toFixed(1)}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-200">{row.ticket_count || 0}</td>
                      </tr>
                    ))}
                    {(report.engineerReport || []).length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">No data for selected filters.</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'customer' && (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Customer</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Company</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Hours</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Chargeable</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Non-Chargeable</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tickets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {(report.customerReport || []).map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{row.customer_name || row.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">{row.company || '-'}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-200">{Number(row.total_hours || 0).toFixed(1)}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-200">{Number(row.chargeable_hours || 0).toFixed(1)}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-200">{Number(row.non_chargeable_hours || 0).toFixed(1)}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-200">{row.ticket_count || 0}</td>
                      </tr>
                    ))}
                    {(report.customerReport || []).length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">No data for selected filters.</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'activity' && (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Activity Type</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Hours</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Entry Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {(report.activityReport || []).map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white capitalize">{(row.activity_type || 'general').replace('_', ' ')}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-200">{Number(row.total_hours || 0).toFixed(1)}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-200">{row.entry_count || 0}</td>
                      </tr>
                    ))}
                    {(report.activityReport || []).length === 0 && (
                      <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">No data for selected filters.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Entries Table */}
          <div className="tb-card">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Time Entries ({sortedEntries.length})</h3>
              <button onClick={() => setSortAsc(!sortAsc)} className="text-xs text-gray-500 dark:text-gray-400 hover:text-accent-blue transition-colors">
                Sort by date {sortAsc ? '\u2191' : '\u2193'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ticket#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subject</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Support Specialist</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Activity</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Hours</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Chargeable</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedEntries.map((entry: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 whitespace-nowrap">{entry.date}</td>
                      <td className="px-4 py-2 text-sm text-accent-blue font-medium whitespace-nowrap">{entry.ticket_number || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 max-w-[200px] truncate">{entry.subject || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 whitespace-nowrap">{entry.engineer_name || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 capitalize whitespace-nowrap">{(entry.activity_type || 'general').replace('_', ' ')}</td>
                      <td className="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-200">{Number(entry.hours).toFixed(1)}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          entry.is_chargeable
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {entry.is_chargeable ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500 max-w-[250px] truncate">{entry.description || '-'}</td>
                    </tr>
                  ))}
                  {sortedEntries.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">No time entries found for the selected filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-500 bg-blue-500/10',
    green: 'text-green-500 bg-green-500/10',
    amber: 'text-amber-500 bg-amber-500/10',
    purple: 'text-purple-500 bg-purple-500/10',
  };
  const cls = colorMap[color] || colorMap.blue;
  return (
    <div className="tb-card p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${cls}`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
