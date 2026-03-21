import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { tickets as ticketsApi, engineers as engineersApi } from '../../api/client';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import { Brain, FileText, RefreshCw } from 'lucide-react';

export default function TicketDetail() {
  const { id } = useParams();
  const [ticket, setTicket] = useState<any>(null);
  const [engineers, setEngineers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([ticketsApi.get(parseInt(id!)), engineersApi.list()])
      .then(([t, e]) => { setTicket(t); setEngineers(e); })
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleStatusChange = async (status: string) => {
    setActionLoading('status');
    await ticketsApi.updateStatus(parseInt(id!), status).catch(console.error);
    load(); setActionLoading('');
  };

  const handleAssign = async (engineerId: number) => {
    setActionLoading('assign');
    await ticketsApi.assign(parseInt(id!), engineerId).catch(console.error);
    load(); setActionLoading('');
  };

  const handleReanalyze = async () => {
    setActionLoading('analyze');
    await ticketsApi.analyze(parseInt(id!)).catch(console.error);
    setTimeout(load, 2000); setActionLoading('');
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading ticket...</div>;
  if (!ticket) return <div className="text-center py-12 text-red-400">Ticket not found</div>;

  const aiAnalysis = ticket.aiAnalysis ? JSON.parse(ticket.aiAnalysis) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-mono">{ticket.ticketNumber}</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{ticket.subject}</h1>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="tb-card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Description</h3>
            <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {ticket.answers?.length > 0 && (
            <div className="tb-card p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Questionnaire Responses</h3>
              <div className="space-y-3">
                {ticket.answers.map((a: any) => (
                  <div key={a.id}>
                    <p className="text-sm text-gray-500">{a.question_text}</p>
                    <p className="font-medium text-gray-700 dark:text-gray-200">{a.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ticket.attachments?.length > 0 && (
            <div className="tb-card p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Attachments</h3>
              <div className="space-y-2">
                {ticket.attachments.map((att: any) => (
                  <a key={att.id} href={`/uploads/${att.filename}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-accent-blue hover:underline text-sm">
                    <FileText className="w-4 h-4" />
                    {att.original_name} ({(att.size / 1024).toFixed(1)} KB)
                  </a>
                ))}
              </div>
            </div>
          )}

          {aiAnalysis && (
            <div className="tb-card border-purple-500/30 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">AI Analysis</h3>
                <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
                  ticket.aiConfidence >= 0.7 ? 'bg-status-active-bg text-status-active-text' : 'bg-status-warn-bg text-status-warn-text'
                }`}>Confidence: {(ticket.aiConfidence * 100).toFixed(0)}%</span>
              </div>
              <div className="space-y-3 text-sm">
                <div><p className="text-gray-500">Classification</p><p className="font-medium text-gray-700 dark:text-gray-200">{aiAnalysis.classification}</p></div>
                <div><p className="text-gray-500">Severity</p><PriorityBadge priority={aiAnalysis.severity} /></div>
                <div><p className="text-gray-500">Root Cause Hypothesis</p><p className="font-medium text-gray-700 dark:text-gray-200">{aiAnalysis.rootCauseHypothesis}</p></div>
                <div><p className="text-gray-500">Recommended Engineer</p><p className="font-medium text-gray-700 dark:text-gray-200">{aiAnalysis.recommendedEngineerName}</p></div>
                <div><p className="text-gray-500">Reasoning</p><p className="text-gray-600 dark:text-gray-300">{aiAnalysis.reasoning}</p></div>
                {aiAnalysis.suggestedSkills?.length > 0 && (
                  <div>
                    <p className="text-gray-500">Required Skills</p>
                    <div className="flex gap-1 mt-1">
                      {aiAnalysis.suggestedSkills.map((s: string) => (
                        <span key={s} className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div><p className="text-gray-500">Estimated Complexity</p><p className="font-medium text-gray-700 dark:text-gray-200 capitalize">{aiAnalysis.estimatedComplexity}</p></div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="tb-card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Details</h3>
            <div className="space-y-3 text-sm">
              <div><p className="text-gray-500">Product</p><p className="font-medium text-gray-700 dark:text-gray-200">{ticket.product.name} ({ticket.product.model})</p></div>
              <div><p className="text-gray-500">Category</p><p className="font-medium text-gray-700 dark:text-gray-200">{ticket.category.name}</p></div>
              <div><p className="text-gray-500">Customer</p><p className="font-medium text-gray-700 dark:text-gray-200">{ticket.customer.name}</p><p className="text-gray-500">{ticket.customer.email}</p></div>
              <div><p className="text-gray-500">Assigned Engineer</p><p className="font-medium text-gray-700 dark:text-gray-200">{ticket.assignedEngineer?.name || 'Unassigned'}</p></div>
              <div><p className="text-gray-500">Created</p><p className="font-medium text-gray-700 dark:text-gray-200">{new Date(ticket.createdAt).toLocaleString()}</p></div>
            </div>
          </div>

          <div className="tb-card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Actions</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Change Status</label>
                <select value={ticket.status} onChange={e => handleStatusChange(e.target.value)} disabled={!!actionLoading} className="tb-select w-full">
                  {['new', 'analyzing', 'assigned', 'in_progress', 'pending_info', 'resolved', 'closed'].map(s => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Assign Engineer</label>
                <select value={ticket.assignedEngineerId || ''} onChange={e => handleAssign(parseInt(e.target.value))} disabled={!!actionLoading} className="tb-select w-full">
                  <option value="">Select engineer...</option>
                  {engineers.map((e: any) => <option key={e.id} value={e.id}>{e.name} ({e.currentWorkload}/{e.maxWorkload})</option>)}
                </select>
              </div>
              <button onClick={handleReanalyze} disabled={!!actionLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg text-sm font-medium hover:bg-purple-500/30 disabled:opacity-50 transition-colors">
                <RefreshCw className={`w-4 h-4 ${actionLoading === 'analyze' ? 'animate-spin' : ''}`} />
                Re-analyze with AI
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
