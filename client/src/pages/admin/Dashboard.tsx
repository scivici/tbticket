import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { admin } from '../../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Ticket, Users, CheckCircle, Clock } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'];

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    admin.dashboard()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading dashboard...</div>;
  if (!stats) return <div className="text-center py-12 text-red-500">Failed to load dashboard</div>;

  const statusData = Object.entries(stats.ticketsByStatus || {}).map(([name, value]) => ({ name: name.replace('_', ' '), value }));
  const productData = stats.ticketsByProduct || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="flex gap-3">
          <Link to="/admin/tickets" className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
            View All Tickets
          </Link>
          <Link to="/admin/engineers" className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            Manage Engineers
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Ticket className="w-5 h-5" />} label="Total Tickets" value={stats.totalTickets} color="blue" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Open Tickets" value={stats.openTickets} color="yellow" />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Resolved" value={stats.resolvedTickets} color="green" />
        <StatCard icon={<Users className="w-5 h-5" />} label="Avg Resolution (hrs)" value={stats.avgResolutionTime || '—'} color="purple" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold mb-4">Tickets by Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-center py-12">No ticket data yet</p>}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold mb-4">Tickets by Product</h3>
          {productData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={productData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="productName" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-center py-12">No ticket data yet</p>}
        </div>
      </div>

      {/* Engineer Workloads */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold mb-4">Engineer Workloads</h3>
        <div className="space-y-3">
          {(stats.engineerWorkloads || []).map((eng: any, i: number) => (
            <div key={i} className="flex items-center gap-4">
              <span className="w-32 text-sm font-medium truncate">{eng.engineer_name}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${eng.current / eng.max > 0.8 ? 'bg-red-500' : eng.current / eng.max > 0.5 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min((eng.current / eng.max) * 100, 100)}%` }}
                />
              </div>
              <span className="text-sm text-gray-500 w-12 text-right">{eng.current}/{eng.max}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: any; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
