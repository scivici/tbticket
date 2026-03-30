import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { admin, tickets as ticketsApi } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Ticket, Users, CheckCircle, Clock, AlertTriangle, Star } from 'lucide-react';

const COLORS = ['#0ea5e9', '#059669', '#D39340', '#832d2d', '#8b5cf6', '#ec4899', '#6b7280'];

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [breached, setBreached] = useState<any[]>([]);
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [escalationAlerts, setEscalationAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      admin.dashboard(),
      admin.slaBreached().catch(() => []),
      ticketsApi.list({ limit: '5' }).catch(() => ({ tickets: [] })),
      admin.escalationAlerts().catch(() => []),
    ]).then(([s, b, rt, ea]) => {
      setStats(s);
      setBreached(b);
      setRecentTickets(rt.tickets || []);
      setEscalationAlerts(ea || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading dashboard...</div>;
  if (!stats) return <div className="text-center py-12 text-red-400">Failed to load dashboard</div>;

  const statusData = Object.entries(stats.ticketsByStatus || {}).map(([name, value]) => ({ name: name.replace('_', ' '), value }));
  const productData = stats.ticketsByProduct || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard icon={<Ticket className="w-5 h-5" />} label="Total Tickets" value={stats.totalTickets} color="blue" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Open Tickets" value={stats.openTickets} color="amber" />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Resolved" value={stats.resolvedTickets} color="green" />
        <StatCard icon={<Users className="w-5 h-5" />} label="Avg Resolution (hrs)" value={stats.avgResolutionTime || '\u2014'} color="purple" />
        <StatCard icon={<Star className="w-5 h-5" />} label="Avg Satisfaction" value={stats.avgSatisfaction ? `${Number(stats.avgSatisfaction).toFixed(1)} / 5` : '\u2014'} color="amber" />
        <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="Escalation Alerts" value={escalationAlerts.length} color={escalationAlerts.length > 0 ? 'red' : 'green'} />
      </div>

      {/* Recent Tickets */}
      {recentTickets.length > 0 && (
        <div className="tb-card p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Recent Tickets</h3>
            <Link to="/admin/tickets" className="text-sm text-accent-blue hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ticket</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subject</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {recentTickets.map((t: any) => (
                  <tr key={t.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                    <td className="px-4 py-2">
                      <Link to={`/admin/tickets/${t.id}`} className="text-sm font-mono text-accent-blue hover:underline">{t.ticketNumber}</Link>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 max-w-xs truncate">{t.subject}</td>
                    <td className="px-4 py-2"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">{timeAgo(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="tb-card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Tickets by Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#353535', border: '1px solid #555', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-500 text-center py-12">No ticket data yet</p>}
        </div>
        <div className="tb-card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Tickets by Product</h3>
          {productData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={productData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="productName" tick={{ fill: '#999', fontSize: 12 }} />
                <YAxis tick={{ fill: '#999' }} />
                <Tooltip contentStyle={{ backgroundColor: '#353535', border: '1px solid #555', color: '#fff' }} />
                <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-500 text-center py-12">No ticket data yet</p>}
        </div>
      </div>

      {/* Weekly Trend Chart */}
      <div className="tb-card p-6 mb-8">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Weekly Ticket Trend (Last 7 Days)</h3>
        {(stats.weeklyTrend || []).length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={stats.weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="day" tick={{ fill: '#999', fontSize: 12 }} />
              <YAxis tick={{ fill: '#999' }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#353535', border: '1px solid #555', color: '#fff' }} />
              <Line type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2} dot={{ fill: '#0ea5e9', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="text-gray-500 text-center py-12">No ticket data for the last 7 days</p>}
      </div>

      {/* SLA Breaches Panel */}
      <div className="tb-card p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">SLA Breaches</h3>
          <span className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold ${
            breached.length > 0 ? 'bg-red-500/20 text-red-400' : 'bg-accent-green/20 text-accent-green'
          }`}>
            {breached.length}
          </span>
        </div>
        {breached.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No SLA breaches. All tickets are within SLA targets.</p>
        ) : (
          <div className="space-y-2">
            {breached.map((t: any) => (
              <div key={t.ticketId} className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Ticket #{t.ticketId}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Priority: {t.priority}</span>
                </div>
                <div className="flex gap-3 text-xs">
                  {t.responseBreached && (
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded font-medium">Response Breached</span>
                  )}
                  {t.resolutionBreached && (
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded font-medium">Resolution Breached</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Support Specialist Performance Table */}
      <div className="tb-card p-6 mb-8">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Support Specialist Performance</h3>
        {(stats.engineerPerformance || []).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Support Specialist</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Resolved Tickets</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Avg Resolution Time (hrs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {stats.engineerPerformance.map((eng: any, i: number) => (
                  <tr key={i} className="hover:bg-black/5 dark:hover:bg-white/5">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{eng.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{eng.resolved}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{eng.avgHours !== null ? eng.avgHours : '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-gray-500 text-center py-6">No support specialist performance data yet</p>}
      </div>

      <div className="tb-card p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Support Specialist Workloads</h3>
        <div className="space-y-3">
          {(stats.engineerWorkloads || []).map((eng: any, i: number) => (
            <div key={i} className="flex items-center gap-4">
              <span className="w-32 text-sm font-medium text-gray-600 dark:text-gray-300 truncate">{eng.engineer_name}</span>
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div className={`h-3 rounded-full ${eng.current / eng.max > 0.8 ? 'bg-red-500' : eng.current / eng.max > 0.5 ? 'bg-accent-amber' : 'bg-accent-green'}`}
                  style={{ width: `${Math.min((eng.current / eng.max) * 100, 100)}%` }} />
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400 w-12 text-right">{eng.current}/{eng.max}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: any; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-primary-500/20 text-accent-blue',
    green: 'bg-accent-green/20 text-accent-green',
    amber: 'bg-accent-amber/20 text-accent-amber',
    purple: 'bg-purple-500/20 text-purple-400',
    red: 'bg-red-500/20 text-red-500',
  };
  return (
    <div className="tb-card p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}
