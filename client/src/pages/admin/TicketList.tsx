import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tickets as ticketsApi, engineers as engineersApi, products as productsApi } from '../../api/client';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import { RefreshCw, Download, Trash2, CheckSquare, Search, Filter, X } from 'lucide-react';

const STATUS_OPTIONS = ['new', 'analyzing', 'assigned', 'in_progress', 'pending_info', 'escalated_to_jira', 'resolved', 'closed'];

export default function TicketList() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({ excludeStatus: 'closed' });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [engineers, setEngineers] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkEngineer, setBulkEngineer] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const load = () => {
    setLoading(true);
    setSelected(new Set());
    const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v));
    Promise.all([
      ticketsApi.list(params),
      engineersApi.list(),
      productsApi.list(),
    ]).then(([d, e, p]) => { setData(d); setEngineers(e); setProductsList(p); })
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(f => ({ ...f, search: searchText || '' }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(f => ({ ...f, customerSearch: customerSearch || '' }));
    }, 400);
    return () => clearTimeout(timer);
  }, [customerSearch]);

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

  const clearFilters = () => {
    setFilters({ excludeStatus: 'closed' });
    setSearchText('');
    setCustomerSearch('');
  };

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && k !== 'excludeStatus' && k !== 'search' && k !== 'customerSearch').length;

  const exportCSV = () => {
    if (!data?.tickets?.length) return;
    const headers = ['Ticket Number', 'Subject', 'Product', 'Customer', 'Status', 'Priority', 'Engineer', 'AI Confidence', 'Created'];
    const rows = data.tickets.map((t: any) => [
      t.ticketNumber, t.subject, t.productName, t.customerName || '', t.status, t.priority,
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

      {/* Search & Filter Bar */}
      <div className="space-y-3 mb-6">
        <div className="flex gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Search tickets (subject, description, ticket number)..."
              className="tb-input w-full pl-10"
            />
          </div>

          {/* Status filter */}
          <select
            value={filters.status ? filters.status : (filters.excludeStatus === 'closed' ? '_not_closed' : '')}
            onChange={e => {
              const val = e.target.value;
              if (val === '_not_closed') {
                setFilters(f => { const { status, ...rest } = f; return { ...rest, excludeStatus: 'closed' }; });
              } else if (val === '') {
                setFilters(f => { const { status, excludeStatus, ...rest } = f; return rest; });
              } else {
                setFilters(f => { const { excludeStatus, ...rest } = f; return { ...rest, status: val }; });
              }
            }}
            className="tb-select"
          >
            <option value="">All Statuses</option>
            <option value="_not_closed">All Except Closed</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>

          {/* Priority filter */}
          <select value={filters.priority || ''} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))} className="tb-select">
            <option value="">All Priorities</option>
            {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-lg transition-colors ${
              showAdvanced || activeFilterCount > 0
                ? 'border-accent-blue text-accent-blue bg-accent-blue/5'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-accent-blue hover:text-accent-blue'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-accent-blue text-white rounded-full">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="flex flex-wrap gap-3 p-4 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-gray-700">
            {/* Customer search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Customer / Company</label>
              <input
                type="text"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                placeholder="Search by name, email, company..."
                className="tb-input w-full text-sm"
              />
            </div>

            {/* Engineer filter */}
            <div className="min-w-[180px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Assigned Engineer</label>
              <select value={filters.engineerId || ''} onChange={e => setFilters(f => ({ ...f, engineerId: e.target.value }))} className="tb-select w-full text-sm">
                <option value="">All Engineers</option>
                {engineers.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>

            {/* Product filter */}
            <div className="min-w-[180px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Product</label>
              <select value={filters.productId || ''} onChange={e => setFilters(f => ({ ...f, productId: e.target.value }))} className="tb-select w-full text-sm">
                <option value="">All Products</option>
                {productsList.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Tag filter */}
            <div className="min-w-[150px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tag</label>
              <input
                type="text"
                value={filters.tag || ''}
                onChange={e => setFilters(f => ({ ...f, tag: e.target.value }))}
                placeholder="Filter by tag..."
                className="tb-input w-full text-sm"
              />
            </div>

            {/* Date range */}
            <div className="min-w-[150px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From Date</label>
              <input type="date" value={filters.fromDate || ''} onChange={e => setFilters(f => ({ ...f, fromDate: e.target.value }))} className="tb-input w-full text-sm" />
            </div>
            <div className="min-w-[150px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To Date</label>
              <input type="date" value={filters.toDate || ''} onChange={e => setFilters(f => ({ ...f, toDate: e.target.value }))} className="tb-input w-full text-sm" />
            </div>

            {/* Clear button */}
            <div className="flex items-end">
              <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-500 hover:text-red-500 transition-colors">
                <X className="w-4 h-4" />
                Clear All
              </button>
            </div>
          </div>
        )}
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
              {STATUS_OPTIONS.map(s => (
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Customer</th>
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
              {data?.tickets?.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No tickets found matching your filters.</td></tr>
              ) : data?.tickets?.map((t: any) => (
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
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    <div className="truncate max-w-[120px]" title={`${t.customerName} (${t.customerEmail})`}>{t.customerName}</div>
                  </td>
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
            <div className="px-4 py-3 bg-black/5 dark:bg-white/5 flex items-center justify-between text-sm text-gray-500">
              <span>Showing {data.tickets.length} of {data.total} tickets (Page {data.page}/{data.totalPages})</span>
              {data.totalPages > 1 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilters(f => ({ ...f, page: String(Math.max(1, data.page - 1)) }))}
                    disabled={data.page <= 1}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setFilters(f => ({ ...f, page: String(Math.min(data.totalPages, data.page + 1)) }))}
                    disabled={data.page >= data.totalPages}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
