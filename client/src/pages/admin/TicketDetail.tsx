import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { tickets as ticketsApi, engineers as engineersApi, cannedResponses as cannedApi, customFields as cfApi } from '../../api/client';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import {
  Brain, FileText, RefreshCw, MessageSquare, Send, Lock, Clock, ShieldAlert,
  Trash2, Tag, X, Plus, PlusCircle, ArrowRightCircle, UserCheck, AlertTriangle,
  MessageSquarePlus, Image as ImageIcon, Star, Upload, Paperclip, Link2, Users, ExternalLink,
  Timer, Sparkles, BookOpen, Play, Square, Printer, Merge, SlidersHorizontal
} from 'lucide-react';

const ACTIVITY_TYPES = [
  { value: 'general', label: 'General', color: 'gray' },
  { value: 'investigation', label: 'Investigation', color: 'blue' },
  { value: 'configuration', label: 'Configuration', color: 'purple' },
  { value: 'testing', label: 'Testing', color: 'green' },
  { value: 'customer_call', label: 'Customer Call', color: 'yellow' },
  { value: 'documentation', label: 'Documentation', color: 'cyan' },
  { value: 'internal_meeting', label: 'Internal Meeting', color: 'pink' },
  { value: 'escalation', label: 'Escalation', color: 'red' },
];

const activityColorMap: Record<string, string> = {
  gray: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  pink: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

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

  // File upload
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // CC users
  const [ccUsers, setCcUsers] = useState<any[]>([]);
  const [newCcEmail, setNewCcEmail] = useState('');

  // Linked tickets
  const [linkedTickets, setLinkedTickets] = useState<any[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [linkType, setLinkType] = useState('related');

  // Jira
  const [jiraInput, setJiraInput] = useState('');
  const [editingJira, setEditingJira] = useState(false);

  // Merge
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSourceInput, setMergeSourceInput] = useState('');
  const [merging, setMerging] = useState(false);

  // Time entries
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [timeHours, setTimeHours] = useState('');
  const [timeDesc, setTimeDesc] = useState('');
  const [timeChargeable, setTimeChargeable] = useState(true);
  const [timeActivityType, setTimeActivityType] = useState('general');

  // Timer
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [timerElapsed, setTimerElapsed] = useState('');
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [stopTimerDesc, setStopTimerDesc] = useState('');
  const [stopTimerChargeable, setStopTimerChargeable] = useState(true);

  // AI suggestion
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [suggestingReply, setSuggestingReply] = useState(false);

  // Jira live status
  const [jiraStatus, setJiraStatus] = useState<any>(null);

  // Custom fields
  const [allCustomFields, setAllCustomFields] = useState<any[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, string>>({});
  const [savingCustomFields, setSavingCustomFields] = useState(false);

  // Support both numeric ID and ticket number (TKT-xxx)
  const isNumeric = /^\d+$/.test(id!);

  const load = () => {
    setLoading(true);
    const getTicket = isNumeric ? ticketsApi.get(parseInt(id!)) : ticketsApi.getByNumber(id!);
    getTicket.then((t: any) => {
      setTicket(t);
      setJiraInput(t.jiraIssueKey || '');
      return Promise.all([
        engineersApi.list(),
        ticketsApi.getResponses(t.id),
        ticketsApi.getTags(t.id).catch(() => []),
        ticketsApi.getActivities(t.id).catch(() => []),
        ticketsApi.getSatisfaction(t.id).catch(() => null),
        ticketsApi.getCcUsers(t.id).catch(() => []),
        ticketsApi.getLinkedTickets(t.id).catch(() => []),
        ticketsApi.getTimeEntries(t.id).catch(() => []),
        cfApi.list().catch(() => []),
        cfApi.getForTicket(t.id).catch(() => []),
      ]);
    })
      .then(([e, r, tg, act, sat, cc, links, te, cfAll, cfVals]) => {
        setEngineers(e); setResponses(r); setTags(tg); setActivities(act);
        if (sat && sat.rating) setSatisfaction(sat);
        setCcUsers(cc); setLinkedTickets(links); setTimeEntries(te);
        setAllCustomFields(cfAll || []);
        const valMap: Record<number, string> = {};
        for (const v of (cfVals || [])) valMap[v.field_id] = v.value || '';
        setCustomFieldValues(valMap);
      })
      .catch(console.error).finally(() => setLoading(false));
    // Fetch Jira status separately (async, non-blocking)
    getTicket.then((t: any) => {
      if (t.jiraIssueKey) {
        ticketsApi.getJiraStatus(t.id).then(setJiraStatus).catch(() => {});
      }
    });
  };

  const loadResponses = () => {
    if (!ticket) return;
    ticketsApi.getResponses(ticket.id).then(setResponses).catch(console.error);
  };

  const loadTags = () => {
    if (!ticket) return;
    ticketsApi.getTags(ticket.id).then(setTags).catch(console.error);
  };

  const loadActivities = () => {
    if (!ticket) return;
    ticketsApi.getActivities(ticket.id).then(setActivities).catch(console.error);
  };

  const handleSendResponse = async () => {
    if (!responseMessage.trim() || !ticket) return;
    setSendingResponse(true);
    try {
      await ticketsApi.addResponse(ticket.id, responseMessage.trim(), isInternal);
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

  // Load active timer
  useEffect(() => {
    ticketsApi.getActiveTimer().then((t: any) => {
      if (t && t.ticket_id === ticket?.id) setActiveTimer(t);
      else if (t && String(t.ticket_id) === String(id)) setActiveTimer(t);
      else setActiveTimer(null);
    }).catch(() => setActiveTimer(null));
  }, [ticket?.id]);

  // Timer elapsed updater
  useEffect(() => {
    if (!activeTimer?.started_at) { setTimerElapsed(''); return; }
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(activeTimer.started_at).getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setTimerElapsed(`${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeTimer?.started_at]);

  // Scroll to anchored response if URL has hash
  useEffect(() => {
    if (!loading && window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el) { setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }
    }
  }, [loading]);

  // Lazy-load canned responses on first open
  useEffect(() => {
    if (showCanned && cannedList.length === 0) {
      cannedApi.list().then(setCannedList).catch(console.error);
    }
  }, [showCanned]);

  const handleStatusChange = async (status: string) => {
    if (!ticket) return;
    setActionLoading('status');
    await ticketsApi.updateStatus(ticket.id, status).catch(console.error);
    load(); setActionLoading('');
  };

  const handlePriorityChange = async (priority: string) => {
    if (!ticket) return;
    setActionLoading('priority');
    await ticketsApi.updatePriority(ticket.id, priority).catch(console.error);
    load(); setActionLoading('');
  };

  const handleAssign = async (engineerId: number) => {
    if (!ticket) return;
    setActionLoading('assign');
    await ticketsApi.assign(ticket.id, engineerId).catch(console.error);
    load(); setActionLoading('');
  };

  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false);
  const [analyzePrompt, setAnalyzePrompt] = useState('');

  const handleReanalyze = async (customPrompt?: string) => {
    if (!ticket) return;
    setShowAnalyzeModal(false);
    setActionLoading('analyze');
    await ticketsApi.analyze(ticket.id, customPrompt || undefined).catch(console.error);
    setTimeout(load, 5000); setActionLoading('');
  };

  const [escalationDoc, setEscalationDoc] = useState<string | null>(null);

  const handleEscalationDoc = async () => {
    if (!ticket) return;
    setActionLoading('escalation');
    try {
      const result = await ticketsApi.generateEscalationDoc(ticket.id);
      setEscalationDoc(result.document || result.error || 'Failed to generate document');
    } catch (err: any) {
      setEscalationDoc('Error: ' + err.message);
    }
    setActionLoading('');
  };

  const handleDelete = async () => {
    if (!ticket || !window.confirm(`Delete ticket ${ticket.ticketNumber}? This cannot be undone.`)) return;
    setActionLoading('delete');
    try {
      await ticketsApi.delete(ticket.id);
      navigate('/admin/tickets');
    } catch (err) {
      console.error(err);
      setActionLoading('');
    }
  };

  const handleAddTag = async () => {
    const t = newTag.trim();
    if (!t || !ticket) return;
    try {
      await ticketsApi.addTag(ticket.id, t);
      setNewTag('');
      loadTags();
      loadActivities();
    } catch (err) { console.error(err); }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!ticket) return;
    try {
      await ticketsApi.removeTag(ticket.id, tag);
      loadTags();
      loadActivities();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading ticket...</div>;
  if (!ticket) return <div className="text-center py-12 text-red-400">Ticket not found</div>;

  const aiAnalysis = ticket.aiAnalysis ? (typeof ticket.aiAnalysis === 'string' ? JSON.parse(ticket.aiAnalysis) : ticket.aiAnalysis) : null;

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-mono">{ticket.ticketNumber}</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{ticket.subject}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open(`/admin/tickets/${ticket.id}/print`, '_blank')}
            className="p-2 text-gray-400 hover:text-accent-blue hover:bg-accent-blue/10 rounded-lg transition-colors"
            title="Print / PDF"
          >
            <Printer className="w-4 h-4" />
          </button>
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

          {/* Attachments with Image Previews + Upload */}
          <div className="tb-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <Paperclip className="w-5 h-5 text-accent-blue" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Attachments</h3>
              <span className="ml-auto text-sm text-gray-500">{ticket.attachments?.length || 0} file{ticket.attachments?.length !== 1 ? 's' : ''}</span>
            </div>
            {ticket.attachments?.length > 0 && (
              <div className="space-y-3 mb-4">
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
            )}
            {/* Upload more files */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <label className={`inline-flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                uploadingFiles ? 'opacity-50 cursor-not-allowed' : 'text-gray-600 dark:text-gray-300 hover:border-accent-blue hover:text-accent-blue'
              }`}>
                <Upload className="w-4 h-4" />
                {uploadingFiles ? 'Uploading...' : 'Add Files'}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  disabled={uploadingFiles}
                  accept="image/*,.pdf,.txt,.csv,.log,.json,.zip,.pcap,.pcapng,.gz,.tgz"
                  onChange={async (e) => {
                    if (!e.target.files?.length || !ticket) return;
                    setUploadingFiles(true);
                    try {
                      const formData = new FormData();
                      for (const file of Array.from(e.target.files)) formData.append('files', file);
                      await ticketsApi.addAttachments(ticket.id, formData);
                      load();
                    } catch (err) { console.error(err); }
                    setUploadingFiles(false);
                    e.target.value = '';
                  }}
                />
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PDF, images, text, log, JSON, PCAP, ZIP (max 10MB per file)</p>
            </div>
          </div>

          {aiAnalysis && (
            <div className="tb-card border-purple-500/30 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">AI Analysis</h3>
                {aiAnalysis.analysisMode && <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">{aiAnalysis.analysisMode}</span>}
                {aiAnalysis.executionTimeSeconds && <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-xs">{Math.round(aiAnalysis.executionTimeSeconds)}s</span>}
                <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
                  ticket.aiConfidence >= 0.7 ? 'bg-status-active-bg text-status-active-text' : 'bg-status-warn-bg text-status-warn-text'
                }`}>Confidence: {(ticket.aiConfidence * 100).toFixed(0)}%</span>
              </div>

              {/* Summary Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div><p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Classification</p><p className="font-medium text-gray-700 dark:text-gray-200">{aiAnalysis.classification}</p></div>
                <div><p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Severity</p><PriorityBadge priority={aiAnalysis.severity} /></div>
                <div><p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Recommended Engineer</p><p className="font-medium text-gray-700 dark:text-gray-200">{aiAnalysis.recommendedEngineerName}</p></div>
                <div><p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Complexity</p><p className="font-medium text-gray-700 dark:text-gray-200 capitalize">{aiAnalysis.estimatedComplexity}</p></div>
              </div>

              {/* Skills */}
              {aiAnalysis.suggestedSkills?.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-4">
                  {aiAnalysis.suggestedSkills.map((s: string) => (
                    <span key={s} className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">{s}</span>
                  ))}
                </div>
              )}

              {/* Root Cause */}
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg">
                <p className="text-xs uppercase tracking-wide text-red-500 dark:text-red-400 font-semibold mb-2">Root Cause Hypothesis</p>
                <div className="text-sm text-gray-700 dark:text-gray-200 prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{aiAnalysis.rootCauseHypothesis || ''}</ReactMarkdown>
                </div>
              </div>

              {/* Reasoning */}
              {aiAnalysis.reasoning && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-lg">
                  <p className="text-xs uppercase tracking-wide text-blue-500 dark:text-blue-400 font-semibold mb-2">Engineer Selection Reasoning</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{aiAnalysis.reasoning}</p>
                </div>
              )}

              {/* Suggested Actions */}
              {aiAnalysis.suggestedActions?.length > 0 && (
                <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-lg">
                  <p className="text-xs uppercase tracking-wide text-green-500 dark:text-green-400 font-semibold mb-2">Recommended Actions</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-200">
                    {aiAnalysis.suggestedActions.map((action: string, i: number) => (
                      <li key={i}>{action}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Full Report - Markdown rendered */}
              {aiAnalysis.fullReport && (
                <details className="group">
                  <summary className="cursor-pointer flex items-center gap-2 text-sm font-semibold text-purple-400 hover:text-purple-300 py-2">
                    <FileText className="w-4 h-4" />
                    <span>Full Technical Report</span>
                    <span className="text-xs text-gray-500 group-open:hidden">(click to expand)</span>
                  </summary>
                  <div className="mt-2 p-4 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg prose prose-sm dark:prose-invert max-w-none overflow-x-auto
                    prose-headings:text-gray-900 dark:prose-headings:text-white
                    prose-strong:text-gray-800 dark:prose-strong:text-gray-200
                    prose-code:bg-gray-200 dark:prose-code:bg-gray-700 prose-code:px-1 prose-code:rounded
                    prose-pre:bg-gray-900 prose-pre:text-gray-100
                    prose-table:border-collapse prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-600 prose-th:px-3 prose-th:py-1 prose-th:bg-gray-100 dark:prose-th:bg-gray-800
                    prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-600 prose-td:px-3 prose-td:py-1
                  ">
                    <ReactMarkdown>{aiAnalysis.fullReport}</ReactMarkdown>
                  </div>
                </details>
              )}

              {/* Jira Escalation */}
              {aiAnalysis.shouldEscalateToJira && (
                <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-300 flex items-center gap-1.5">
                    <ExternalLink className="w-4 h-4" /> AI recommends Jira escalation
                  </p>
                  {aiAnalysis.escalationReason && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">{aiAnalysis.escalationReason}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Previous AI Analyses */}
          {ticket.aiAnalysisHistory?.length > 0 && (
            <details className="tb-card border-gray-500/20 p-6">
              <summary className="cursor-pointer flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                <Clock className="w-4 h-4" />
                <span>Previous AI Analyses ({ticket.aiAnalysisHistory.length})</span>
              </summary>
              <div className="mt-4 space-y-3">
                {[...ticket.aiAnalysisHistory].reverse().map((prev: any, i: number) => (
                  <details key={i} className="p-4 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg">
                    <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium">{prev.classification || 'Analysis'}</span>
                      {prev.archivedAt && <span className="text-xs text-gray-400 ml-2">{new Date(prev.archivedAt).toLocaleString()}</span>}
                      {prev.confidence && <span className="text-xs text-gray-400 ml-2">({(prev.confidence * 100).toFixed(0)}%)</span>}
                    </summary>
                    <div className="mt-3 space-y-2 text-sm">
                      {prev.rootCauseHypothesis && (
                        <div><p className="text-xs text-gray-500 font-semibold mb-1">Root Cause</p><div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{prev.rootCauseHypothesis}</ReactMarkdown></div></div>
                      )}
                      {prev.fullReport && (
                        <div><p className="text-xs text-gray-500 font-semibold mb-1">Full Report</p><div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{prev.fullReport}</ReactMarkdown></div></div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </details>
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
                  <div key={r.id} id={`response-${r.id}`} className={`p-4 rounded-lg scroll-mt-20 ${
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
                        <button onClick={() => {
                          const url = `${window.location.origin}${window.location.pathname}#response-${r.id}`;
                          navigator.clipboard.writeText(url);
                        }} title="Copy link to this response" className="ml-1 text-gray-400 hover:text-accent-blue">
                          <Link2 className="w-3 h-3" />
                        </button>
                      </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">{r.message}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Response Form */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              {/* Response Tools */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="relative">
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
                <button
                  onClick={async () => {
                    if (!ticket) return;
                    setSuggestingReply(true);
                    try {
                      const result = await ticketsApi.suggestReply(ticket.id);
                      if (result.suggestion) setResponseMessage(result.suggestion);
                      if (result.note) setAiSuggestion(result.note);
                    } catch (err) { console.error(err); }
                    setSuggestingReply(false);
                  }}
                  disabled={suggestingReply}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-400 border border-purple-400/30 rounded-lg hover:bg-purple-500/10 disabled:opacity-50 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  {suggestingReply ? 'Thinking...' : 'AI Suggest'}
                </button>
                {(ticket.status === 'resolved' || ticket.status === 'closed') && (
                  <button
                    onClick={async () => {
                      if (!ticket) return;
                      try {
                        await ticketsApi.createKbArticle(ticket.id);
                        alert('Knowledge base article created!');
                        loadActivities();
                      } catch (err) { console.error(err); }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-500 border border-green-500/30 rounded-lg hover:bg-green-500/10 transition-colors"
                  >
                    <BookOpen className="w-4 h-4" />
                    Save to KB
                  </button>
                )}
              </div>

              {aiSuggestion && (
                <p className="text-xs text-purple-400 mb-2">{aiSuggestion}</p>
              )}

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

          {/* Time Entries */}
          <div className="tb-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Timer className="w-5 h-5 text-accent-blue" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Time Tracking</h3>
              <span className="ml-auto text-sm text-gray-500">
                {timeEntries.reduce((sum: number, e: any) => sum + e.hours, 0).toFixed(1)}h total
              </span>
            </div>

            {timeEntries.length > 0 && (
              <div className="space-y-2 mb-4">
                {timeEntries.map((entry: any) => (
                  <div key={entry.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-white/5 rounded">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-700 dark:text-gray-200">{entry.hours}h</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${entry.is_chargeable ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                          {entry.is_chargeable ? 'Chargeable' : 'Non-chargeable'}
                        </span>
                        {(() => {
                          const at = ACTIVITY_TYPES.find(a => a.value === (entry.activity_type || 'general')) || ACTIVITY_TYPES[0];
                          return (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${activityColorMap[at.color] || activityColorMap.gray}`}>
                              {at.label}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{entry.description}</p>
                      <p className="text-xs text-gray-400">{entry.author_name} - {entry.date}</p>
                    </div>
                    <button onClick={async () => { if (!ticket) return; await ticketsApi.deleteTimeEntry(ticket.id, entry.id); ticketsApi.getTimeEntries(ticket.id).then(setTimeEntries); }}
                      className="text-gray-400 hover:text-red-400 ml-2"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Stop Timer Dialog */}
            {showStopDialog && (
              <div className="space-y-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-3">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Confirm stop timer</p>
                <input type="text" value={stopTimerDesc} onChange={e => setStopTimerDesc(e.target.value)}
                  placeholder="Description (optional)" className="tb-input w-full text-sm" />
                <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={stopTimerChargeable} onChange={e => setStopTimerChargeable(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-accent-blue" />
                  Chargeable
                </label>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowStopDialog(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                  <button onClick={async () => {
                    if (!ticket) return;
                    try {
                      await ticketsApi.stopTimer(ticket.id, { description: stopTimerDesc || undefined, isChargeable: stopTimerChargeable });
                      setActiveTimer(null); setShowStopDialog(false); setStopTimerDesc('');
                      ticketsApi.getTimeEntries(ticket.id).then(setTimeEntries);
                      loadActivities();
                    } catch (err) { console.error(err); }
                  }} className="px-3 py-1 text-xs font-medium bg-amber-500 text-white rounded hover:bg-amber-600">Stop & Save</button>
                </div>
              </div>
            )}

            {showTimeForm ? (
              <div className="space-y-2 p-3 bg-gray-50 dark:bg-white/5 rounded-lg">
                <div className="flex gap-2">
                  <input type="number" step="0.25" min="0.25" value={timeHours} onChange={e => setTimeHours(e.target.value)}
                    placeholder="Hours" className="tb-input w-20 text-sm" />
                  <input type="text" value={timeDesc} onChange={e => setTimeDesc(e.target.value)}
                    placeholder="What did you do?" className="tb-input flex-1 text-sm" />
                </div>
                <div className="flex gap-2">
                  <select value={timeActivityType} onChange={e => setTimeActivityType(e.target.value)} className="tb-select text-sm flex-1">
                    {ACTIVITY_TYPES.map(at => (
                      <option key={at.value} value={at.value}>{at.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={timeChargeable} onChange={e => setTimeChargeable(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-accent-blue" />
                    Chargeable
                  </label>
                  <div className="flex gap-2">
                    <button onClick={() => setShowTimeForm(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                    <button onClick={async () => {
                      if (!timeHours || !timeDesc.trim() || !ticket) return;
                      await ticketsApi.addTimeEntry(ticket.id, { hours: parseFloat(timeHours), description: timeDesc, isChargeable: timeChargeable, activityType: timeActivityType });
                      setTimeHours(''); setTimeDesc(''); setTimeActivityType('general'); setShowTimeForm(false);
                      ticketsApi.getTimeEntries(ticket.id).then(setTimeEntries);
                      loadActivities();
                    }} disabled={!timeHours || !timeDesc.trim()}
                      className="px-3 py-1 text-xs font-medium bg-accent-blue text-white rounded hover:bg-accent-blue/80 disabled:opacity-50">Add</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setShowTimeForm(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-accent-blue border border-dashed border-accent-blue/30 rounded-lg hover:bg-accent-blue/5 transition-colors">
                  <Plus className="w-4 h-4" /> Log Time
                </button>
                {activeTimer ? (
                  <button onClick={() => { setStopTimerDesc(activeTimer.description || ''); setShowStopDialog(true); }}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                    <Square className="w-3.5 h-3.5 fill-current" /> Stop {timerElapsed}
                  </button>
                ) : (
                  <button onClick={async () => {
                    if (!ticket) return;
                    try {
                      const timer = await ticketsApi.startTimer(ticket.id, { activityType: 'general' });
                      setActiveTimer(timer);
                    } catch (err) { console.error(err); }
                  }}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-green-600 dark:text-green-400 border border-green-300 dark:border-green-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                    <Play className="w-3.5 h-3.5 fill-current" /> Start Timer
                  </button>
                )}
              </div>
            )}
          </div>
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
              {ticket.resolvedAt && (
                <div><p className="text-gray-500">Resolved</p><p className="font-medium text-gray-700 dark:text-gray-200">{new Date(ticket.resolvedAt).toLocaleString()}</p></div>
              )}
              {/* Time since last response */}
              {responses.length > 0 && (
                <>
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-gray-500">Last Response</p>
                    <p className="font-medium text-gray-700 dark:text-gray-200">
                      {timeAgo(responses[responses.length - 1].created_at)}
                    </p>
                    <p className="text-xs text-gray-500">
                      by {responses[responses.length - 1].author_name} ({responses[responses.length - 1].author_role})
                    </p>
                  </div>
                  {(() => {
                    const lastCustomerResponse = [...responses].reverse().find((r: any) => r.author_role === 'customer');
                    const lastAdminResponse = [...responses].reverse().find((r: any) => r.author_role === 'admin' && !r.is_internal);
                    return (
                      <>
                        {lastCustomerResponse && (
                          <div>
                            <p className="text-gray-500">Last Customer Reply</p>
                            <p className="font-medium text-gray-700 dark:text-gray-200">{timeAgo(lastCustomerResponse.created_at)}</p>
                          </div>
                        )}
                        {lastAdminResponse && (
                          <div>
                            <p className="text-gray-500">Last Admin Reply</p>
                            <p className="font-medium text-gray-700 dark:text-gray-200">{timeAgo(lastAdminResponse.created_at)}</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
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

          {/* CC Users Card */}
          <div className="tb-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-accent-blue" />
              <h3 className="font-semibold text-gray-900 dark:text-white">CC</h3>
            </div>
            <div className="space-y-1.5 mb-3">
              {ccUsers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No CC users</p>
              ) : (
                ccUsers.map((cc: any) => (
                  <div key={cc.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 dark:text-gray-200 truncate" title={cc.email}>{cc.name || cc.email}</span>
                    <button onClick={async () => { if (!ticket) return; await ticketsApi.removeCcUser(ticket.id, cc.email); ticketsApi.getCcUsers(ticket.id).then(setCcUsers); }}
                      className="text-gray-400 hover:text-red-400 ml-1"><X className="w-3 h-3" /></button>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input type="email" value={newCcEmail} onChange={e => setNewCcEmail(e.target.value)}
                onKeyDown={async e => { if (e.key === 'Enter' && newCcEmail.trim() && ticket) { await ticketsApi.addCcUser(ticket.id, newCcEmail.trim()); setNewCcEmail(''); ticketsApi.getCcUsers(ticket.id).then(setCcUsers); } }}
                placeholder="Add CC email..." className="tb-input flex-1 text-sm" />
              <button onClick={async () => { if (!newCcEmail.trim() || !ticket) return; await ticketsApi.addCcUser(ticket.id, newCcEmail.trim()); setNewCcEmail(''); ticketsApi.getCcUsers(ticket.id).then(setCcUsers); }}
                disabled={!newCcEmail.trim()} className="p-2 text-accent-blue hover:bg-accent-blue/10 rounded-lg disabled:opacity-50 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Linked Tickets Card */}
          <div className="tb-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-4 h-4 text-accent-blue" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Linked Tickets</h3>
            </div>
            <div className="space-y-2 mb-3">
              {linkedTickets.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No linked tickets</p>
              ) : (
                linkedTickets.map((link: any) => (
                  <div key={link.id} className="flex items-center justify-between text-xs p-2 bg-gray-50 dark:bg-white/5 rounded">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-[10px] font-medium uppercase">{link.link_type}</span>
                      <a href={`/admin/tickets/${link.linked_ticket_id}`} className="text-accent-blue hover:underline truncate font-mono">{link.ticket_number}</a>
                      <StatusBadge status={link.status} />
                    </div>
                    <button onClick={async () => { if (!ticket) return; await ticketsApi.unlinkTicket(ticket.id, link.id); ticketsApi.getLinkedTickets(ticket.id).then(setLinkedTickets); }}
                      className="text-gray-400 hover:text-red-400 ml-1 flex-shrink-0"><X className="w-3 h-3" /></button>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input type="text" value={linkInput} onChange={e => setLinkInput(e.target.value)}
                  placeholder="Ticket # or ID..." className="tb-input flex-1 text-sm" />
                <select value={linkType} onChange={e => setLinkType(e.target.value)} className="tb-select text-xs w-28">
                  <option value="related">Related</option>
                  <option value="parent">Parent</option>
                  <option value="child">Child</option>
                  <option value="duplicate">Duplicate</option>
                  <option value="references">References</option>
                </select>
              </div>
              <button onClick={async () => {
                if (!linkInput.trim() || !ticket) return;
                await ticketsApi.linkTicket(ticket.id, linkInput.trim(), linkType);
                setLinkInput('');
                ticketsApi.getLinkedTickets(ticket.id).then(setLinkedTickets);
                loadActivities();
              }} disabled={!linkInput.trim()}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-accent-blue border border-accent-blue/30 rounded-lg hover:bg-accent-blue/10 disabled:opacity-50 transition-colors">
                <Link2 className="w-3.5 h-3.5" /> Link Ticket
              </button>
            </div>
          </div>

          {/* Custom Fields Card */}
          {allCustomFields.filter(cf => cf.is_active && (!cf.product_id || cf.product_id === ticket.productId)).length > 0 && (
            <div className="tb-card p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-accent-blue" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Custom Fields</h3>
                </div>
                <button
                  onClick={async () => {
                    if (!ticket) return;
                    setSavingCustomFields(true);
                    try {
                      const fields = Object.entries(customFieldValues).map(([fieldId, value]) => ({
                        fieldId: parseInt(fieldId),
                        value,
                      }));
                      await cfApi.saveForTicket(ticket.id, fields);
                    } catch (err: any) { console.error(err); }
                    setSavingCustomFields(false);
                  }}
                  disabled={savingCustomFields}
                  className="text-xs text-accent-blue hover:underline disabled:opacity-50"
                >
                  {savingCustomFields ? 'Saving...' : 'Save'}
                </button>
              </div>
              <div className="space-y-3">
                {allCustomFields
                  .filter(cf => cf.is_active && (!cf.product_id || cf.product_id === ticket.productId))
                  .map((cf: any) => (
                    <div key={cf.id}>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {cf.name}{cf.is_required && <span className="text-red-400 ml-0.5">*</span>}
                      </label>
                      {cf.field_type === 'select' && cf.options ? (
                        <select
                          value={customFieldValues[cf.id] || ''}
                          onChange={e => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}
                          className="tb-select w-full text-sm"
                        >
                          <option value="">Select...</option>
                          {(Array.isArray(cf.options) ? cf.options : []).map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : cf.field_type === 'checkbox' ? (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={customFieldValues[cf.id] === 'true'}
                            onChange={e => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.checked ? 'true' : 'false' }))}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Yes</span>
                        </label>
                      ) : cf.field_type === 'textarea' ? (
                        <textarea
                          value={customFieldValues[cf.id] || ''}
                          onChange={e => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}
                          rows={2}
                          className="tb-input w-full text-sm"
                        />
                      ) : cf.field_type === 'date' ? (
                        <input
                          type="date"
                          value={customFieldValues[cf.id] || ''}
                          onChange={e => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}
                          className="tb-input w-full text-sm"
                        />
                      ) : (
                        <input
                          type={cf.field_type === 'number' ? 'number' : 'text'}
                          value={customFieldValues[cf.id] || ''}
                          onChange={e => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}
                          className="tb-input w-full text-sm"
                        />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Jira Issue Card */}
          <div className="tb-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <ExternalLink className="w-4 h-4 text-accent-blue" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Jira Issue</h3>
            </div>
            {!editingJira && ticket.jiraIssueKey ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <a href={jiraStatus?.url || '#'} target="_blank" rel="noreferrer"
                    className="text-sm font-mono text-accent-blue hover:underline">{ticket.jiraIssueKey}</a>
                  <button onClick={() => setEditingJira(true)} className="text-xs text-gray-500 hover:text-accent-blue">Edit</button>
                </div>
                {jiraStatus && (
                  <div className="text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Status:</span>
                      <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded font-medium">{jiraStatus.status}</span>
                    </div>
                    {jiraStatus.summary && (
                      <p className="text-gray-500 truncate" title={jiraStatus.summary}>{jiraStatus.summary}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <input type="text" value={jiraInput} onChange={e => setJiraInput(e.target.value.toUpperCase())}
                  placeholder="e.g., PROJ-123" className="tb-input flex-1 text-sm font-mono" />
                <button onClick={async () => {
                  if (!ticket) return;
                  await ticketsApi.updateJiraKey(ticket.id, jiraInput.trim());
                  setEditingJira(false);
                  load();
                }} className="px-3 py-1.5 text-sm font-medium bg-accent-blue text-white rounded-lg hover:bg-accent-blue/80 transition-colors">
                  Save
                </button>
              </div>
            )}
          </div>

          <div className="tb-card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Actions</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Change Status</label>
                <select value={ticket.status} onChange={e => handleStatusChange(e.target.value)} disabled={!!actionLoading} className="tb-select w-full">
                  {['new', 'analyzing', 'assigned', 'in_progress', 'pending_info', 'escalated_to_jira', 'resolved', 'closed'].map(s => (
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
              <button onClick={() => { setAnalyzePrompt(''); setShowAnalyzeModal(true); }} disabled={!!actionLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg text-sm font-medium hover:bg-purple-500/30 disabled:opacity-50 transition-colors">
                <RefreshCw className={`w-4 h-4 ${actionLoading === 'analyze' ? 'animate-spin' : ''}`} />
                {actionLoading === 'analyze' ? 'AI Analyzing...' : 'Re-analyze with AI'}
              </button>
              <button onClick={handleEscalationDoc} disabled={!!actionLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 disabled:opacity-50 transition-colors">
                <AlertTriangle className={`w-4 h-4 ${actionLoading === 'escalation' ? 'animate-pulse' : ''}`} />
                {actionLoading === 'escalation' ? 'Generating...' : 'Developer Escalation'}
              </button>
              {ticket.status !== 'escalated_to_jira' && !ticket.jiraIssueKey && (
                <button onClick={async () => {
                  if (!ticket || !window.confirm('Escalate this ticket to Jira? This will create a Jira issue and change the status.')) return;
                  setActionLoading('jira');
                  try {
                    const result = await ticketsApi.escalateToJira(ticket.id);
                    alert(`Jira issue created: ${result.issueKey}`);
                    load();
                  } catch (err: any) { alert(err.message); }
                  setActionLoading('');
                }} disabled={!!actionLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-400 rounded-lg text-sm font-medium hover:bg-orange-500/30 disabled:opacity-50 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                  {actionLoading === 'jira' ? 'Creating...' : 'Escalate to Jira'}
                </button>
              )}
              <button onClick={() => { setMergeSourceInput(''); setShowMergeModal(true); }} disabled={!!actionLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/30 disabled:opacity-50 transition-colors">
                <Merge className="w-4 h-4" />
                Merge Ticket
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

    {/* AI Analysis Modal */}
    {showAnalyzeModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAnalyzeModal(false)}>
        <div className="bg-white dark:bg-tb-card rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">AI Analysis</h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Optionally provide specific instructions for the AI analysis. Leave empty for a general analysis.
          </p>
          <textarea
            value={analyzePrompt}
            onChange={e => setAnalyzePrompt(e.target.value)}
            placeholder="e.g., Focus on the ptime mismatch between the two pcap files. Compare the SDP negotiation in good vs bad call..."
            rows={4}
            className="tb-input w-full mb-4 text-sm"
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowAnalyzeModal(false)} className="tb-btn-secondary text-sm">Cancel</button>
            <button onClick={() => handleReanalyze(analyzePrompt.trim())} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
              <Sparkles className="w-4 h-4" />
              {analyzePrompt.trim() ? 'Analyze with Custom Prompt' : 'General Analysis'}
            </button>
          </div>
          {ticket?.aiAnalysis && (
            <p className="text-xs text-gray-400 mt-3">Previous analysis will be preserved in history.</p>
          )}
        </div>
      </div>
    )}

    {/* Escalation Document Modal */}
    {escalationDoc !== null && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEscalationDoc(null)}>
        <div className="bg-white dark:bg-tb-card rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Developer Escalation Document</h3>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => {
                const blob = new Blob([escalationDoc], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `escalation-${ticket?.ticketNumber || 'doc'}.md`;
                a.click(); URL.revokeObjectURL(url);
              }} className="px-3 py-1.5 bg-accent-blue/20 text-accent-blue rounded-lg text-sm hover:bg-accent-blue/30 transition-colors">
                Download .md
              </button>
              <button onClick={() => {
                navigator.clipboard.writeText(escalationDoc);
                alert('Copied to clipboard');
              }} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                Copy
              </button>
              <button onClick={() => setEscalationDoc(null)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto p-6 prose prose-sm dark:prose-invert max-w-none
            prose-headings:text-gray-900 dark:prose-headings:text-white
            prose-strong:text-gray-800 dark:prose-strong:text-gray-200
            prose-code:bg-gray-200 dark:prose-code:bg-gray-700 prose-code:px-1 prose-code:rounded
            prose-pre:bg-gray-900 prose-pre:text-gray-100
            prose-table:border-collapse prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-600 prose-th:px-3 prose-th:py-1 prose-th:bg-gray-100 dark:prose-th:bg-gray-800
            prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-600 prose-td:px-3 prose-td:py-1
          ">
            <ReactMarkdown>{escalationDoc}</ReactMarkdown>
          </div>
        </div>
      </div>
    )}

    {/* Merge Ticket Modal */}
    {showMergeModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowMergeModal(false)}>
        <div className="bg-white dark:bg-tb-card rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-4">
            <Merge className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Merge Ticket</h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            Merge another ticket <strong>into</strong> this one ({ticket.ticketNumber}).
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
            All responses, attachments, time entries, and tags from the source ticket will be moved here. The source ticket will be closed.
          </p>
          <input
            type="text"
            value={mergeSourceInput}
            onChange={e => setMergeSourceInput(e.target.value)}
            placeholder="Source ticket ID (e.g., 42)"
            className="tb-input w-full mb-4 text-sm"
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowMergeModal(false)} className="tb-btn-secondary text-sm">Cancel</button>
            <button
              onClick={async () => {
                if (!mergeSourceInput.trim() || !ticket) return;
                setMerging(true);
                try {
                  const sourceId = parseInt(mergeSourceInput.trim());
                  if (isNaN(sourceId)) { alert('Please enter a valid ticket ID'); setMerging(false); return; }
                  const result = await ticketsApi.mergeTicket(ticket.id, sourceId);
                  alert(result.message || 'Tickets merged successfully');
                  setShowMergeModal(false);
                  load();
                } catch (err: any) {
                  alert(err.message || 'Failed to merge tickets');
                }
                setMerging(false);
              }}
              disabled={merging || !mergeSourceInput.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 disabled:opacity-50 transition-colors"
            >
              <Merge className="w-4 h-4" />
              {merging ? 'Merging...' : 'Merge'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
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
