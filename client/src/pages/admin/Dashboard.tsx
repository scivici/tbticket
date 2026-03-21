import React, { useEffect, useState } from 'react';
import { admin } from '../../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Ticket, Users, CheckCircle, Clock } from 'lucide-react';

const COLORS = ['#0ea5e9', '#059669', '#D39340', '#832d2d', '#8b5cf6', '#ec4899', '#6b7280'];

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    admin.dashboard().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading dashboard...</div>;
  if (!stats) return <div className="text-center py-12 text-red-400">Failed to load dashboard</div>;

  const statusData = Object.entries(stats.ticketsByStatus || {}).map(([name, value]) => ({ name: name.replace('_', ' '), value }));
  const productData = stats.ticketsByProduct || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Ticket className="w-5 h-5" />} label="Total Tickets" value={stats.totalTickets} color="blue" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Open Tickets" value={stats.openTickets} color="amber" />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Resolved" value={stats.resolvedTickets} color="green" />
        <StatCard icon={<Users className="w-5 h-5" />} label="Avg Resolution (hrs)" value={stats.avgResolutionTime || '—'} color="purple" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="tb-card p-6">
          <h3 className="font-semibold text-white mb-4">Tickets by Status</h3>
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
          <h3 className="font-semibold text-white mb-4">Tickets by Product</h3>
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

      <div className="tb-card p-6">
        <h3 className="font-semibold text-white mb-4">Engineer Workloads</h3>
        <div className="space-y-3">
          {(stats.engineerWorkloads || []).map((eng: any, i: number) => (
            <div key={i} className="flex items-center gap-4">
              <span className="w-32 text-sm font-medium text-gray-300 truncate">{eng.engineer_name}</span>
              <div className="flex-1 bg-gray-700 rounded-full h-3">
                <div className={`h-3 rounded-full ${eng.current / eng.max > 0.8 ? 'bg-red-500' : eng.current / eng.max > 0.5 ? 'bg-accent-amber' : 'bg-accent-green'}`}
                  style={{ width: `${Math.min((eng.current / eng.max) * 100, 100)}%` }} />
              </div>
              <span className="text-sm text-gray-400 w-12 text-right">{eng.current}/{eng.max}</span>
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
  };
  return (
    <div className="tb-card p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}
