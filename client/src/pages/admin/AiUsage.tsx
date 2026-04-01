import React, { useEffect, useState } from 'react';
import { admin } from '../../api/client';
import { Brain, Sparkles, BookOpen, Clock, Zap, BarChart3, RefreshCw, TrendingUp, AlertTriangle } from 'lucide-react';

export default function AiUsage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [daysBack, setDaysBack] = useState(30);

  const load = () => {
    setLoading(true);
    admin.aiUsage(daysBack).then(setData).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [daysBack]);

  if (loading && !data) return <div className="text-center py-12 text-gray-500"><RefreshCw className="w-5 h-5 animate-spin inline mr-2" />Loading AI usage data...</div>;
  if (!data) return <div className="text-center py-12 text-gray-500">Failed to load data.</div>;

  const { summary, dailyTrend, recentActivities, reanalyzed } = data;

  // Chart: simple bar visualization
  const maxCount = Math.max(...dailyTrend.map((d: any) => d.count), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-purple-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Usage Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <select value={daysBack} onChange={e => setDaysBack(parseInt(e.target.value))} className="tb-select text-sm">
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button onClick={load} className="p-2 text-gray-500 hover:text-accent-blue transition-colors" title="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="tb-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Analyses</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalAnalyses}</p>
          <p className="text-xs text-gray-400 mt-1">{summary.periodAnalyses} in last {daysBack} days</p>
        </div>

        <div className="tb-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Suggest Replies</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.suggestReplies}</p>
          <p className="text-xs text-gray-400 mt-1">AI-generated reply suggestions</p>
        </div>

        <div className="tb-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">AI Coverage</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.aiCoveragePercent}%</p>
          <p className="text-xs text-gray-400 mt-1">{summary.ticketsWithAi} of {summary.totalTickets} tickets</p>
        </div>

        <div className="tb-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Avg Analysis Time</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.avgExecutionSeconds ? `${summary.avgExecutionSeconds}s` : 'N/A'}</p>
          <p className="text-xs text-gray-400 mt-1">KB articles created: {summary.kbArticles}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Daily Trend Chart */}
        <div className="tb-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-accent-blue" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Daily AI Usage</h3>
          </div>
          {dailyTrend.length > 0 ? (
            <div className="flex items-end gap-1 h-40">
              {dailyTrend.map((d: any, i: number) => {
                const height = Math.max((d.count / maxCount) * 100, 4);
                const dateStr = new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      {dateStr}: {d.count} calls
                    </div>
                    <div
                      className="w-full bg-purple-500/80 hover:bg-purple-500 rounded-t transition-colors cursor-pointer min-w-[6px]"
                      style={{ height: `${height}%` }}
                    />
                    {dailyTrend.length <= 14 && (
                      <span className="text-[9px] text-gray-400 truncate w-full text-center">{new Date(d.date).getDate()}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data for this period</div>
          )}
        </div>

        {/* Re-analyzed Tickets */}
        <div className="tb-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Most Re-analyzed Tickets</h3>
          </div>
          {reanalyzed.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {reanalyzed.map((r: any) => (
                <a key={r.ticketId} href={`/admin/tickets/${r.ticketId}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-accent-blue">{r.ticketNumber}</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{r.subject}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-bold shrink-0">
                    {r.analysisCount}x
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No re-analyzed tickets</div>
          )}
        </div>
      </div>

      {/* Recent AI Activities */}
      <div className="tb-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-purple-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Recent AI Activity</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Time</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Ticket</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Action</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Details</th>
              </tr>
            </thead>
            <tbody>
              {recentActivities.map((a: any) => (
                <tr key={a.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5">
                  <td className="py-2 px-3 text-gray-400 whitespace-nowrap">
                    {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                    {new Date(a.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2 px-3">
                    <a href={`/admin/tickets/${a.ticketId}`} className="text-accent-blue hover:underline font-mono text-xs">{a.ticketNumber}</a>
                    <p className="text-xs text-gray-500 truncate max-w-[200px]">{a.subject}</p>
                  </td>
                  <td className="py-2 px-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                      a.action === 'ai_analysis' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                      a.action === 'ai_suggest_reply' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    }`}>
                      {a.action === 'ai_analysis' && <><Sparkles className="w-3 h-3" /> Analysis</>}
                      {a.action === 'ai_suggest_reply' && <><Zap className="w-3 h-3" /> Suggest Reply</>}
                      {a.action === 'kb_article_created' && <><BookOpen className="w-3 h-3" /> KB Article</>}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-500 dark:text-gray-400 text-xs truncate max-w-[300px]">{a.details}</td>
                </tr>
              ))}
              {recentActivities.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400">No AI activity recorded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
