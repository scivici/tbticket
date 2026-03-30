import React, { useEffect, useState } from 'react';
import { admin } from '../../api/client';
import {
  Activity, Database, Brain, Mail, MessageSquare, Video,
  ExternalLink, Server, Clock, Ticket, Users, Timer,
  CheckCircle, XCircle, RefreshCw
} from 'lucide-react';

interface HealthData {
  database: boolean;
  uptime: number;
  nodeVersion: string;
  stats: {
    tickets: number;
    customers: number;
    engineers: number;
    activeTimers: number;
  };
  services: {
    claude: { configured: boolean; mode: string };
    smtp: { configured: boolean; host?: string };
    slack: { configured: boolean };
    teams: { configured: boolean };
    jira: { configured: boolean };
  };
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  return parts.join(' ');
}

function StatusIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle className="w-5 h-5 text-green-500" />
    : <XCircle className="w-5 h-5 text-red-400" />;
}

export default function HealthDashboard() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await admin.healthDashboard();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      admin.healthDashboard().then(setData).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading system health...</div>;
  if (error) return <div className="text-center py-12 text-red-400">Failed to load: {error}</div>;
  if (!data) return null;

  const serviceCards = [
    {
      label: 'Database',
      icon: Database,
      ok: data.database,
      detail: data.database ? 'Connected' : 'Disconnected',
    },
    {
      label: 'Claude AI',
      icon: Brain,
      ok: data.services.claude.configured,
      detail: data.services.claude.configured ? `Mode: ${data.services.claude.mode}` : 'Not configured',
    },
    {
      label: 'SMTP Email',
      icon: Mail,
      ok: data.services.smtp.configured,
      detail: data.services.smtp.configured ? data.services.smtp.host || 'Configured' : 'Not configured',
    },
    {
      label: 'Slack Webhook',
      icon: MessageSquare,
      ok: data.services.slack.configured,
      detail: data.services.slack.configured ? 'Configured' : 'Not configured',
    },
    {
      label: 'Teams Webhook',
      icon: Video,
      ok: data.services.teams.configured,
      detail: data.services.teams.configured ? 'Configured' : 'Not configured',
    },
    {
      label: 'Jira',
      icon: ExternalLink,
      ok: data.services.jira.configured,
      detail: data.services.jira.configured ? 'Configured' : 'Not configured',
    },
  ];

  const statCards = [
    { label: 'Uptime', icon: Clock, value: formatUptime(data.uptime) },
    { label: 'Node.js', icon: Server, value: data.nodeVersion },
    { label: 'Total Tickets', icon: Ticket, value: String(data.stats.tickets) },
    { label: 'Customers', icon: Users, value: String(data.stats.customers) },
    { label: 'Support Specialists', icon: Users, value: String(data.stats.engineers) },
    { label: 'Active Timers', icon: Timer, value: String(data.stats.activeTimers) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-7 h-7 text-primary-500 dark:text-accent-blue" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Health</h1>
        </div>
        <button onClick={load} className="tb-btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Service Status Cards */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Service Status</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {serviceCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="tb-card p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <StatusIcon ok={card.ok} />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{card.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.detail}</p>
            </div>
          );
        })}
      </div>

      {/* System Info */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">System Info</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="tb-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{card.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
