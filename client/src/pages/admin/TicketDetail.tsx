import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tickets as ticketsApi, engineers as engineersApi, cannedResponses as cannedApi } from '../../api/client';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import {
  Brain, FileText, RefreshCw, MessageSquare, Send, Lock, Clock, ShieldAlert,
  Trash2, Tag, X, Plus, PlusCircle, ArrowRightCircle, UserCheck, AlertTriangle,
  MessageSquarePlus, Image as ImageIcon, Star
} from 'lucide-react';

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

const activityIcons: Record<string, typeof PlusCircle> = {
  created: PlusCircle,
  status_changed: ArrowRightCircle,
  assigned: UserCheck,
  response: MessageSquare,
  internal_note: Lock,
  tag_added: Tag,
  tag_removed: Tag,
  priority_changed: AlertTriangle,
};

const isImageFile = (filename: string) => /\.(png|jpg|jpeg|gif|webp)$/i.test(filename);

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [engineers, setEngineers] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [responseMessage, setResponseMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sendingResponse, setSendingResponse] = useState(false);

  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // Activities
  const [activities, setActivities] = useState<any[]>([]);

  // Canned responses
  const [cannedList, setCannedList] = useState<any[]>([]);
  const [showCanned, setShowCanned] = useState(false);

  // Satisfaction
  const [satisfaction, setSatisfaction] = useState<any>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      ticketsApi.get(parseInt(id!)),
      engineersApi.list(),
      ticketsApi.getResponses(parseInt(id!)),
      ticketsApi.getTags(parseInt(id!)).catch(() => []),
      ticketsApi.getActivities(parseInt(id!)).catch(() => []),
      ticketsApi.getSatisfaction(parseInt(id!)).catch(() => null),
    ])
      .then(([t, e, r, tg, act, sat]) => {
        setTicket(t); setEngineers(e); setResponses(r); setTags(tg); setActivities(act);
        if (sat && sat.rating) setSatisfaction(sat);
      })
      .catch(console.error).finally(() => setLoading(false));
  };

  const loadResponses = () => {
    ticketsApi.getResponses(parseInt(id!)).then(setResponses).catch(console.error);
  };

  const loadTags = () => {
    ticketsApi.getTags(parseInt(id!)).then(setTags).catch(console.error);
  };

  const loadActivities = () => {
    ticketsApi.getActivities(parseInt(id!)).then(setActivities).catch(console.error);
  };

  const handleSendResponse = async () => {
    if (!responseMessage.trim()) return;
    setSendingResponse(true);
    try {
      await ticketsApi.addResponse(parseInt(id!), responseMessage.trim(), isInternal);
      setResponseMessage('');
      setIsInternal(false);
      loadResponses();
      loadActivities();
    } catch (err) {
      console.error(err);
    } finally {
      setSendingResponse(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  // Lazy-load canned responses on first open
  useEffect(() => {
    if (showCanned && cannedList.length === 0) {
      cannedApi.list().then(setCannedList).catch(console.error);
    }
  }, [showCanned]);

  const handleStatusChange = async (status: string) => {
    setActionLoading('status');
    await ticketsApi.updateStatus(parseInt(id!), status).catch(console.error);
    load(); setActionLoading('');
  };

  const handlePriorityChange = async (priority: string) => {
    setActionLoading('priority');
    await ticketsApi.updatePriority(parseInt(id!), priority).catch(console.error);
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

  const handleDelete = async () => {
    if (!window.confirm(`Delete ticket ${ticket.ticketNumber}? This cannot be undone.`)) return;
    setActionLoading('delete');
    try {
      await ticketsApi.delete(parseInt(id!));
      navigate('/admin/tickets');
    } catch (err) {
      console.error(err);
      setActionLoading('');
    }
  };

  const handleAddTag = async () => {
    const t = newTag.trim();
    if (!t) return;
    try {
      await ticketsApi.addTag(parseInt(id!), t);
      setNewTag('');
      loadTags();
      loadActivities();
    } catch (err) { console.error(err); }
  };

  const handleRemoveTag = async (tag: string) => {
    try {
      await ticketsApi.removeTag(parseInt(id!), tag);
      loadTags();
      loadActivities();
    } catch (err) { console.error(err); }
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

          {/* Attachments with Image Previews */}
          {ticket.attachments?.length > 0 && (
            <div className="tb-card p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Attachments</h3>
              <div className="space-y-3">
                {ticket.attachments.map((att: any) => (
                  <div key={att.id}>
                    {isImageFile(att.original_name || att.filename) ? (
                      <div className="space-y-2">
                        <a href={`/uploads/${att.filename}`} target="_blank" rel="noreferrer"
                          className="block max-w-xs">
                          <img
                            src={`/uploads/${att.filename}`}
                            alt={att.original_name}
                            className="rounded-lg border border-gray-200 dark:border-gray-700 max-h-48 object-cover hover:opacity-80 transition-opacity cursor-pointer"
                          />
                        </a>
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          {att.original_name} ({(att.size / 1024).toFixed(1)} KB)
                        </p>
                      </div>
                    ) : (
                      <a href={`/uploads/${att.filename}`} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 text-accent-blue hover:underline text-sm">
                        <FileText className="w-4 h-4" />
                        {att.original_name} ({(att.size / 1024).toFixed(1)} KB)
                      </a>
                    )}
                  </div>
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

          {/* Responses Section */}
          <div className="tb-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-accent-blue" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Responses</h3>
              <span className="ml-auto text-sm text-gray-500">{responses.length} message{responses.length !== 1 ? 's' : ''}</span>
            </div>

            {responses.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No responses yet.</p>
            ) : (
              <div className="space-y-4">
                {responses.map((r: any) => (
                  <div key={r.id} className={`p-4 rounded-lg ${
                    r.is_internal
                      ? 'border-2 border-dashed border-yellow-500/30 bg-yellow-50 dark:bg-yellow-900/10'
                      : r.author_role === 'admin'
                        ? 'border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                        : 'border-l-4 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-gray-900 dark:text-white text-sm">{r.author_name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        r.author_role === 'admin'
                          ? 'bg-status-role-bg text-white'
                          : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                      }`}>
                        {r.author_role === 'admin' ? 'Admin' : 'Customer'}
                      </span>
                      {r.is_internal ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200">
                          <Lock className="w-3 h-3" /> Internal Note
                        </span>
                      ) : null}
                      <span className="ml-auto flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">{r.message}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Response Form */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              {/* Canned Responses Picker */}
              <div className="relative mb-3">
                <button
                  onClick={() => setShowCanned(!showCanned)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-accent-blue hover:text-accent-blue transition-colors"
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  Canned Responses
                </button>
                {showCanned && (
                  <div className="absolute z-10 mt-1 w-80 max-h-64 overflow-y-auto bg-white dark:bg-tb-card border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                    {cannedList.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-500">No canned responses available.</p>
                    ) : (
                      cannedList.map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => { setResponseMessage(c.content); setShowCanned(false); }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/5 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors"
                        >
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{c.title}</p>
                          {c.category && (
                            <span className="text-xs text-purple-400">{c.category}</span>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{c.content}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <textarea
                value={responseMessage}
                onChange={e => setResponseMessage(e.target.value)}
                placeholder="Type your response..."
                rows={3}
                className="tb-input w-full mb-3"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={e => setIsInternal(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <Lock className="w-4 h-4" />
                  Internal note (not visible to customer)
                </label>
                <button
                  onClick={handleSendResponse}
                  disabled={sendingResponse || !responseMessage.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/80 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {sendingResponse ? 'Sending...' : 'Send Response'}
                </button>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          {activities.length > 0 && (
            <div className="tb-card p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Activity Log</h3>
              <div className="space-y-3">
                {activities.map((act: any, i: number) => {
                  const IconComp = activityIcons[act.action] || PlusCircle;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-0.5 p-1.5 rounded-full bg-gray-100 dark:bg-white/10 flex-shrink-0">
                        <IconComp className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 dark:text-gray-200">
                          <span className="font-medium text-gray-900 dark:text-white">{act.actorName || 'System'}</span>
                          {' '}{act.description || act.action?.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {timeAgo(act.createdAt || act.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
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

          {/* Tags Card */}
          <div className="tb-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-accent-blue" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Tags</h3>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {tags.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No tags</p>
              ) : (
                tags.map((tag: string) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-blue/10 text-accent-blue rounded-full text-xs font-medium">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-400 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                placeholder="Add tag..."
                className="tb-input flex-1 text-sm"
              />
              <button onClick={handleAddTag} disabled={!newTag.trim()}
                className="p-2 text-accent-blue hover:bg-accent-blue/10 rounded-lg disabled:opacity-50 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
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
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Change Priority</label>
                <select value={ticket.priority} onChange={e => handlePriorityChange(e.target.value)} disabled={!!actionLoading} className="tb-select w-full">
                  {['low', 'medium', 'high', 'critical'].map(p => (
                    <option key={p} value={p}>{p}</option>
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
              <button onClick={handleDelete} disabled={!!actionLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 text-red-500 rounded-lg text-sm font-medium hover:bg-red-500/30 disabled:opacity-50 transition-colors">
                <Trash2 className="w-4 h-4" />
                Delete Ticket
              </button>
            </div>
          </div>

          {/* Satisfaction Rating */}
          {satisfaction && (
            <div className="tb-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-yellow-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Customer Satisfaction</h3>
              </div>
              <div className="flex gap-1 mb-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${star <= satisfaction.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                  />
                ))}
                <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-200">{satisfaction.rating}/5</span>
              </div>
              {satisfaction.comment && (
                <p className="text-sm text-gray-600 dark:text-gray-300 italic">"{satisfaction.comment}"</p>
              )}
            </div>
          )}

          {/* SLA Status Card */}
          {ticket.slaStatus && (
            <div className="tb-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="w-5 h-5 text-accent-blue" />
                <h3 className="font-semibold text-gray-900 dark:text-white">SLA Status</h3>
              </div>
              <div className="space-y-4 text-sm">
                <SlaDeadlineRow
                  label="Response Deadline"
                  deadline={ticket.slaStatus.responseDeadline}
                  breached={ticket.slaStatus.responseBreached}
                  remaining={ticket.slaStatus.responseRemaining}
                  completed={ticket.slaStatus.firstResponseAt !== null}
                />
                <SlaDeadlineRow
                  label="Resolution Deadline"
                  deadline={ticket.slaStatus.resolutionDeadline}
                  breached={ticket.slaStatus.resolutionBreached}
                  remaining={ticket.slaStatus.resolutionRemaining}
                  completed={ticket.slaStatus.resolvedAt !== null}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SlaDeadlineRow({ label, deadline, breached, remaining, completed }: {
  label: string;
  deadline: string;
  breached: boolean;
  remaining: number | null;
  completed: boolean;
}) {
  let statusColor = 'text-accent-green';
  let statusBg = 'bg-accent-green/10';
  let statusText = '';

  if (completed) {
    statusText = breached ? 'Completed (was breached)' : 'Completed';
    statusColor = breached ? 'text-red-400' : 'text-accent-green';
    statusBg = breached ? 'bg-red-500/10' : 'bg-accent-green/10';
  } else if (breached) {
    statusText = 'BREACHED';
    statusColor = 'text-red-400';
    statusBg = 'bg-red-500/10';
  } else if (remaining !== null) {
    if (remaining < 2) {
      statusColor = 'text-yellow-400';
      statusBg = 'bg-yellow-500/10';
      statusText = `${remaining.toFixed(1)}h remaining`;
    } else {
      statusText = `${remaining.toFixed(1)}h remaining`;
    }
  }

  return (
    <div>
      <p className="text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-gray-700 dark:text-gray-200 text-xs mb-1">
        {new Date(deadline).toLocaleString()}
      </p>
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor} ${statusBg}`}>
        {statusText}
      </span>
    </div>
  );
}
