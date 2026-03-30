import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { admin } from '../../api/client';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ShieldAlert, AlertTriangle, CheckCircle, Clock, Pencil, Save, X } from 'lucide-react';

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#D39340',
  medium: '#0ea5e9',
  low: '#059669',
};

export default function SlaDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingPolicy, setEditingPolicy] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ response: number; resolution: number }>({ response: 0, resolution: 0 });
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    admin.slaDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const startEdit = (policy: any) => {
    setEditingPolicy(policy.priority);
    setEditValues({ response: policy.response_time_hours, resolution: policy.resolution_time_hours });
  };

  const cancelEdit = () => {
    setEditingPolicy(null);
  };

  const savePolicy = async () => {
    if (!editingPolicy || editValues.response < 1 || editValues.resolution < 1) return;
    setSaving(true);
    try {
      await admin.updateSlaPolicy(editingPolicy, editValues.response, editValues.resolution);
      setEditingPolicy(null);
      loadData();
    } catch (err) {
      console.error('Failed to update SLA policy', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading SLA dashboard...</div>;
  if (!data) return <div className="text-center py-12 text-red-400">Failed to load SLA dashboard</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="w-6 h-6 text-accent-blue" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SLA Dashboard</h1>
      </div>

      {/* Compliance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.complianceCards.map((card: any) => {
          const complianceAvg = card.total > 0
            ? Math.round((card.responseCompliance + card.resolutionCompliance) / 2)
            : 100;
          const color = complianceAvg >= 90 ? 'text-green-500' : complianceAvg >= 70 ? 'text-yellow-500' : 'text-red-500';
          const bgColor = complianceAvg >= 90 ? 'bg-green-500/10' : complianceAvg >= 70 ? 'bg-yellow-500/10' : 'bg-red-500/10';

          return (
            <div key={card.priority} className="tb-card p-5">
              <div className="flex items-center justify-between mb-3">
                <PriorityBadge priority={card.priority} />
                <span className={`text-2xl font-bold ${color}`}>
                  {complianceAvg}%
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Response SLA</span>
                  <span className={`font-medium ${card.responseCompliance >= 90 ? 'text-green-500' : card.responseCompliance >= 70 ? 'text-yellow-500' : 'text-red-500'}`}>
                    {card.responseCompliance}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Resolution SLA</span>
                  <span className={`font-medium ${card.resolutionCompliance >= 90 ? 'text-green-500' : card.resolutionCompliance >= 70 ? 'text-yellow-500' : 'text-red-500'}`}>
                    {card.resolutionCompliance}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Avg Response</span>
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {card.avgResponseHours !== null ? `${card.avgResponseHours}h` : 'N/A'}
                    {card.targetResponseHours && <span className="text-gray-400 ml-1">/ {card.targetResponseHours}h</span>}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tickets</span>
                  <span className="font-medium text-gray-700 dark:text-gray-200">{card.total}</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${complianceAvg >= 90 ? 'bg-green-500' : complianceAvg >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${complianceAvg}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* SLA Breaches Trend Chart */}
      <div className="tb-card p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          SLA Breaches - Last 30 Days
        </h3>
        {data.trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickFormatter={(val: string) => {
                  const d = new Date(val);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                interval={2}
              />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                labelFormatter={(val: string) => new Date(val).toLocaleDateString()}
              />
              <Bar dataKey="breaches" fill="#ef4444" radius={[4, 4, 0, 0]} name="Breaches" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-500">No trend data available.</p>
        )}
      </div>

      {/* Currently Breached Tickets */}
      <div className="tb-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-red-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Currently Breached Tickets</h3>
          <span className="ml-auto px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
            {data.breachedTickets.length}
          </span>
        </div>
        {data.breachedTickets.length === 0 ? (
          <div className="flex items-center gap-2 text-green-500 text-sm">
            <CheckCircle className="w-4 h-4" />
            All tickets are within SLA targets.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Ticket</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Subject</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Priority</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Status</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Engineer</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Breach Type</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {data.breachedTickets.map((t: any) => (
                  <tr key={t.ticketId} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-2 px-3">
                      <Link to={`/admin/tickets/${t.ticketId}`} className="text-accent-blue hover:underline font-mono text-xs">
                        {t.ticketNumber}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200 max-w-xs truncate">{t.subject}</td>
                    <td className="py-2 px-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="py-2 px-3"><StatusBadge status={t.status} /></td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-300">{t.engineerName || 'Unassigned'}</td>
                    <td className="py-2 px-3">
                      <div className="flex gap-1">
                        {t.responseBreached && <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-[10px] font-medium">Response</span>}
                        {t.resolutionBreached && <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded text-[10px] font-medium">Resolution</span>}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-red-500">{t.overdueHours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SLA Policies - Editable */}
      <div className="tb-card p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-accent-blue" />
          SLA Policies
          <span className="text-xs font-normal text-gray-400 ml-2">Click edit to adjust targets</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Priority</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Response Time (hours)</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Resolution Time (hours)</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.policies.map((p: any) => (
                <tr key={p.priority} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 px-3"><PriorityBadge priority={p.priority} /></td>
                  {editingPolicy === p.priority ? (
                    <>
                      <td className="py-3 px-3 text-right">
                        <input
                          type="number"
                          min={1}
                          value={editValues.response}
                          onChange={(e) => setEditValues(v => ({ ...v, response: Number(e.target.value) }))}
                          className="w-20 px-2 py-1 text-right rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-accent-blue focus:border-transparent"
                        />
                      </td>
                      <td className="py-3 px-3 text-right">
                        <input
                          type="number"
                          min={1}
                          value={editValues.resolution}
                          onChange={(e) => setEditValues(v => ({ ...v, resolution: Number(e.target.value) }))}
                          className="w-20 px-2 py-1 text-right rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-accent-blue focus:border-transparent"
                        />
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={savePolicy}
                            disabled={saving}
                            className="p-1.5 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                            title="Save"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded-md bg-gray-500/10 text-gray-600 dark:text-gray-400 hover:bg-gray-500/20 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-3 text-right font-medium text-gray-700 dark:text-gray-200">{p.response_time_hours}h</td>
                      <td className="py-3 px-3 text-right font-medium text-gray-700 dark:text-gray-200">{p.resolution_time_hours}h</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => startEdit(p)}
                          className="p-1.5 rounded-md bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 transition-colors"
                          title="Edit SLA policy"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
