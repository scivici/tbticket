import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { tickets as ticketsApi, engineers as engineersApi, cannedResponses as cannedApi, settings as settingsApi } from '../../api/client';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import ChatWidget from '../../components/ChatWidget';
import {
  Brain, FileText, RefreshCw, MessageSquare, Send, Lock, Clock, ShieldAlert,
  Trash2, Tag, X, Plus, PlusCircle, ArrowRightCircle, UserCheck, AlertTriangle,
  MessageSquarePlus, Image as ImageIcon, Star, Upload, Paperclip, Link2, Users, ExternalLink,
  Timer, Sparkles, BookOpen, Play, Square, Printer, Merge,
  Search, Server, Zap, Target, Activity, Shield, ListChecks, Info, ChevronDown
} from 'lucide-react';

/* ── Full Report Section Parser & Renderer (ticket_analysis.html format) ── */
interface ReportSection {
  title: string;
  content: string;
}

const SECTION_THEMES: Record<string, { icon: React.ReactNode; accent: string; accentBorder: string; bg: string; titleColor: string; iconBg: string }> = {
  'summary': {
    icon: <Info className="w-4 h-4" />,
    accent: 'border-l-blue-500',
    accentBorder: 'border-blue-200 dark:border-blue-800/40',
    bg: 'bg-blue-50/50 dark:bg-blue-900/10',
    titleColor: 'text-blue-700 dark:text-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  },
  'evidence': {
    icon: <Search className="w-4 h-4" />,
    accent: 'border-l-amber-500',
    accentBorder: 'border-amber-200 dark:border-amber-800/40',
    bg: 'bg-amber-50/50 dark:bg-amber-900/10',
    titleColor: 'text-amber-700 dark:text-amber-400',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  },
  'architecture': {
    icon: <Server className="w-4 h-4" />,
    accent: 'border-l-indigo-500',
    accentBorder: 'border-indigo-200 dark:border-indigo-800/40',
    bg: 'bg-indigo-50/50 dark:bg-indigo-900/10',
    titleColor: 'text-indigo-700 dark:text-indigo-400',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
  },
  'root cause': {
    icon: <Target className="w-4 h-4" />,
    accent: 'border-l-red-500',
    accentBorder: 'border-red-200 dark:border-red-800/40',
    bg: 'bg-red-50/50 dark:bg-red-900/10',
    titleColor: 'text-red-700 dark:text-red-400',
    iconBg: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  },
  'impact': {
    icon: <Zap className="w-4 h-4" />,
    accent: 'border-l-orange-500',
    accentBorder: 'border-orange-200 dark:border-orange-800/40',
    bg: 'bg-orange-50/50 dark:bg-orange-900/10',
    titleColor: 'text-orange-700 dark:text-orange-400',
    iconBg: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  },
  'recommended actions': {
    icon: <ListChecks className="w-4 h-4" />,
    accent: 'border-l-green-500',
    accentBorder: 'border-green-200 dark:border-green-800/40',
    bg: 'bg-green-50/50 dark:bg-green-900/10',
    titleColor: 'text-green-700 dark:text-green-400',
    iconBg: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  },
  'escalation': {
    icon: <Shield className="w-4 h-4" />,
    accent: 'border-l-purple-500',
    accentBorder: 'border-purple-200 dark:border-purple-800/40',
    bg: 'bg-purple-50/50 dark:bg-purple-900/10',
    titleColor: 'text-purple-700 dark:text-purple-400',
    iconBg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  },
};

const DEFAULT_THEME = {
  icon: <Activity className="w-4 h-4" />,
  accent: 'border-l-gray-500',
  accentBorder: 'border-gray-200 dark:border-gray-700',
  bg: 'bg-gray-50/50 dark:bg-gray-800/20',
  titleColor: 'text-gray-700 dark:text-gray-400',
  iconBg: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
};

function parseReportSections(report: string): { preamble: string; sections: ReportSection[] } {
  const lines = report.split('\n');
  const sections: ReportSection[] = [];
  let preamble = '';
  let currentTitle = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      if (currentTitle) {
        sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
      } else if (currentContent.length > 0) {
        preamble = currentContent.join('\n').trim();
      }
      currentTitle = headingMatch[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentTitle) {
    sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
  } else if (currentContent.length > 0 && !preamble) {
    preamble = currentContent.join('\n').trim();
  }

  return { preamble, sections };
}

function getSectionTheme(title: string) {
  const key = title.toLowerCase();
  for (const [pattern, theme] of Object.entries(SECTION_THEMES)) {
    if (key.includes(pattern)) return theme;
  }
  return DEFAULT_THEME;
}

const reportProseClasses = `prose prose-sm dark:prose-invert max-w-none
  prose-headings:text-gray-900 dark:prose-headings:text-white prose-headings:text-sm prose-headings:mt-3 prose-headings:mb-1
  prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed
  prose-strong:text-gray-800 dark:prose-strong:text-gray-200
  prose-code:bg-gray-200 dark:prose-code:bg-gray-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
  prose-pre:bg-[#0f172a] prose-pre:text-gray-100 prose-pre:rounded-xl prose-pre:p-4
  prose-li:text-gray-700 dark:prose-li:text-gray-300 prose-li:leading-relaxed
  prose-table:border-collapse prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-600 prose-th:px-3 prose-th:py-1.5 prose-th:bg-gray-100 dark:prose-th:bg-gray-800 prose-th:text-left prose-th:text-xs prose-th:uppercase prose-th:tracking-wide
  prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-600 prose-td:px-3 prose-td:py-1.5`;

function ReportSectionCard({ section }: { section: ReportSection }) {
  const theme = getSectionTheme(section.title);
  return (
    <div className={`rounded-2xl border ${theme.accentBorder} border-l-4 ${theme.accent} bg-white dark:bg-[#1e1e1e] shadow-sm hover:shadow-md transition-shadow overflow-hidden`}>
      <div className={`flex items-center gap-3 px-5 py-3.5 ${theme.bg}`}>
        <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${theme.iconBg}`}>{theme.icon}</span>
        <h3 className={`text-sm font-bold uppercase tracking-wider ${theme.titleColor} m-0`}>{section.title}</h3>
      </div>
      <div className={`px-5 py-4 overflow-x-auto ${reportProseClasses}`}>
        <ReactMarkdown>{section.content}</ReactMarkdown>
      </div>
    </div>
  );
}

function FullReportCategorized({ report }: { report: string }) {
  const { preamble, sections } = parseReportSections(report);

  if (sections.length === 0) {
    return (
      <div className={`mt-3 p-5 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-x-auto ${reportProseClasses}`}>
        <ReactMarkdown>{report}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-4">
      {preamble && (
        <div className={`p-5 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-x-auto ${reportProseClasses}`}>
          <ReactMarkdown>{preamble}</ReactMarkdown>
        </div>
      )}
      {sections.map((section, i) => (
        <ReportSectionCard key={i} section={section} />
      ))}
    </div>
  );
}

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
  const toast = useToast();
  const { user: authUser } = useAuth();
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

  // Jira (multi-key)
  const [jiraKeys, setJiraKeys] = useState<string[]>([]);
  const [jiraInput, setJiraInput] = useState('');
  const [editingJira, setEditingJira] = useState(false);

  // Bugzilla (multi-key)
  const [bugzillaKeys, setBugzillaKeys] = useState<string[]>([]);
  const [bugzillaInput, setBugzillaInput] = useState('');
  const [editingBugzilla, setEditingBugzilla] = useState(false);

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

  // Jira escalation modal
  const [showJiraModal, setShowJiraModal] = useState(false);
  const [jiraMetadata, setJiraMetadata] = useState<{ labels: string[]; components: { id: string; name: string }[]; versions: { id: string; name: string; released: boolean }[]; accounts: { id: string; name: string }[] } | null>(null);
  const [jiraMetaLoading, setJiraMetaLoading] = useState(false);
  const [jiraFormLabels, setJiraFormLabels] = useState<string[]>([]);
  const [jiraFormAccount, setJiraFormAccount] = useState<{ id: string; name?: string } | null>(null);
  const [jiraFormVersion, setJiraFormVersion] = useState('');
  const [jiraFormNotes, setJiraFormNotes] = useState('');
  const [jiraLabelSearch, setJiraLabelSearch] = useState('');
  const [jiraAccountSearch, setJiraAccountSearch] = useState('');
  const [jiraVersionSearch, setJiraVersionSearch] = useState('');
  const [jiraLabelOpen, setJiraLabelOpen] = useState(false);
  const [jiraAccountOpen, setJiraAccountOpen] = useState(false);
  const [jiraVersionOpen, setJiraVersionOpen] = useState(false);

  // Support both numeric ID and ticket number (TKT-xxx)
  const isNumeric = /^\d+$/.test(id!);

  const load = () => {
    setLoading(true);
    const getTicket = isNumeric ? ticketsApi.get(parseInt(id!)) : ticketsApi.getByNumber(id!);
    getTicket.then((t: any) => {
      setTicket(t);
      setJiraKeys(t.jiraIssueKeys?.length ? t.jiraIssueKeys : (t.jiraIssueKey ? [t.jiraIssueKey] : []));
      setBugzillaKeys(t.bugzillaIssueKeys || []);
      setJiraInput('');
      setBugzillaInput('');
      return Promise.all([
        engineersApi.list(),
        ticketsApi.getResponses(t.id),
        ticketsApi.getTags(t.id).catch(() => []),
        ticketsApi.getActivities(t.id).catch(() => []),
        ticketsApi.getSatisfaction(t.id).catch(() => null),
        ticketsApi.getCcUsers(t.id).catch(() => []),
        ticketsApi.getLinkedTickets(t.id).catch(() => []),
        ticketsApi.getTimeEntries(t.id).catch(() => []),
      ]);
    })
      .then(([e, r, tg, act, sat, cc, links, te]) => {
        setEngineers(e); setResponses(r); setTags(tg); setActivities(act);
        if (sat && sat.rating) setSatisfaction(sat);
        setCcUsers(cc); setLinkedTickets(links); setTimeEntries(te);
      })
      .catch(console.error).finally(() => setLoading(false));
    // Fetch Jira status separately (async, non-blocking)
    getTicket.then((t: any) => {
      const keys = t.jiraIssueKeys?.length ? t.jiraIssueKeys : (t.jiraIssueKey ? [t.jiraIssueKey] : []);
      if (keys.length > 0) {
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
                  accept="image/*,.pdf,.txt,.csv,.log,.json,.zip,.pcap,.pcapng,.gz,.tgz,.html"
                  onChange={async (e) => {
                    if (!e.target.files?.length || !ticket) return;
                    // Validate HTML files: only call_trace*.html allowed
                    for (const file of Array.from(e.target.files)) {
                      const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
                      if ((ext === '.html' || ext === '.htm') && !file.name.toLowerCase().startsWith('call_trace')) {
                        alert('HTML files are only allowed for call trace exports (filename must start with "call_trace")');
                        e.target.value = '';
                        return;
                      }
                    }
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
            <div className="space-y-4">
              {/* ── Hero Card ── */}
              <div className="tb-card border-purple-500/30 p-0 overflow-hidden">
                {/* Hero header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5 text-white">
                  <div className="flex items-center gap-3 mb-2">
                    <Brain className="w-6 h-6 text-purple-200" />
                    <h3 className="text-lg font-bold m-0">Ticket Analysis Report</h3>
                    {aiAnalysis.analysisMode && <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-medium">{aiAnalysis.analysisMode}</span>}
                    {aiAnalysis.executionTimeSeconds && <span className="px-2 py-0.5 bg-white/15 rounded text-xs">{Math.round(aiAnalysis.executionTimeSeconds)}s</span>}
                  </div>
                  <p className="text-purple-100 text-sm leading-relaxed m-0">{aiAnalysis.classification}</p>
                </div>

                {/* Badges row */}
                <div className="px-6 py-4 flex flex-wrap gap-2.5 border-b border-gray-200 dark:border-gray-700">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/40">
                    <ShieldAlert className="w-3.5 h-3.5" /> Severity: {aiAnalysis.severity?.charAt(0).toUpperCase() + aiAnalysis.severity?.slice(1)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                    <Activity className="w-3.5 h-3.5" /> Complexity: {aiAnalysis.estimatedComplexity?.charAt(0).toUpperCase() + aiAnalysis.estimatedComplexity?.slice(1)}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                    ticket.aiConfidence >= 0.7
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/40'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40'
                  }`}>
                    <Sparkles className="w-3.5 h-3.5" /> Confidence: {(ticket.aiConfidence * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Meta grid */}
                <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                    <p className="text-[0.7rem] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">Classification</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-snug">{aiAnalysis.classification}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                    <p className="text-[0.7rem] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">Severity</p>
                    <PriorityBadge priority={aiAnalysis.severity} />
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                    <p className="text-[0.7rem] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">Recommended Specialist</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{aiAnalysis.recommendedEngineerName}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                    <p className="text-[0.7rem] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">Complexity</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 capitalize">{aiAnalysis.estimatedComplexity}</p>
                  </div>
                </div>
              </div>

              {/* ── Full Technical Report (always visible, categorized cards) ── */}
              {aiAnalysis.fullReport && (
                <FullReportCategorized report={aiAnalysis.fullReport} />
              )}

              {/* ── Jira Escalation ── */}
              {aiAnalysis.shouldEscalateToJira && (
                <div className="rounded-2xl border border-orange-200 dark:border-orange-800 border-l-4 border-l-orange-500 bg-white dark:bg-[#1e1e1e] shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-3.5 bg-orange-50/50 dark:bg-orange-900/10">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"><ExternalLink className="w-4 h-4" /></span>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400 m-0">AI Recommends Jira Escalation</h3>
                  </div>
                  {aiAnalysis.escalationReason && (
                    <div className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{aiAnalysis.escalationReason}</div>
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
                        toast.success('Knowledge base article created!');
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
              {ticket.customer.company && (
                <div><p className="text-gray-500">Company</p><p className="font-medium text-gray-700 dark:text-gray-200">{ticket.customer.company}</p></div>
              )}
              <div><p className="text-gray-500">Contact Person</p><p className="font-medium text-gray-700 dark:text-gray-200">{ticket.customer.name}</p><p className="text-xs text-gray-500">{ticket.customer.email}</p></div>
              <div><p className="text-gray-500">Assigned Support Specialist</p><p className="font-medium text-gray-700 dark:text-gray-200">{ticket.assignedEngineer?.name || 'Unassigned'}</p></div>
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

          {/* Jira Issues Card (multi-key) */}
          <div className="tb-card p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-accent-blue" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Jira Issues</h3>
              </div>
              {jiraKeys.length > 0 && !editingJira && (
                <button onClick={() => setEditingJira(true)} className="text-xs text-gray-500 hover:text-accent-blue">Edit</button>
              )}
            </div>
            {/* Display existing keys as tags */}
            {jiraKeys.length > 0 && !editingJira && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {jiraKeys.map((key, i) => {
                    const statusEntry = Array.isArray(jiraStatus) ? jiraStatus.find((s: any) => s.key === key) : (jiraStatus?.key === key || jiraKeys.length === 1 ? jiraStatus : null);
                    return (
                      <a key={i} href={statusEntry?.url || '#'} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-xs font-mono text-accent-blue hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                        {key}
                        {statusEntry?.status && (
                          <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-[10px] font-sans font-medium">{statusEntry.status}</span>
                        )}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Edit mode or empty — show input */}
            {(editingJira || jiraKeys.length === 0) && (
              <div className="space-y-2">
                {editingJira && jiraKeys.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {jiraKeys.map((key, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-xs font-mono text-accent-blue">
                        {key}
                        <button onClick={() => { const updated = jiraKeys.filter((_, idx) => idx !== i); setJiraKeys(updated); }}
                          className="text-gray-400 hover:text-red-500 ml-0.5">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="text" value={jiraInput} onChange={e => setJiraInput(e.target.value.toUpperCase())}
                    placeholder="e.g., PROJ-123" className="tb-input flex-1 text-sm font-mono"
                    onKeyDown={e => { if (e.key === 'Enter' && jiraInput.trim()) { setJiraKeys([...jiraKeys, jiraInput.trim()]); setJiraInput(''); } }} />
                  <button onClick={() => { if (jiraInput.trim()) { setJiraKeys([...jiraKeys, jiraInput.trim()]); setJiraInput(''); } }}
                    className="px-2.5 py-1.5 text-sm font-medium text-accent-blue border border-accent-blue/30 rounded-lg hover:bg-accent-blue/10 transition-colors">+</button>
                </div>
                <button onClick={async () => {
                  if (!ticket) return;
                  const finalKeys = jiraInput.trim() ? [...jiraKeys, jiraInput.trim()] : jiraKeys;
                  await ticketsApi.updateJiraKeys(ticket.id, finalKeys);
                  setJiraInput('');
                  setEditingJira(false);
                  load();
                }} className="w-full px-3 py-1.5 text-sm font-medium bg-accent-blue text-white rounded-lg hover:bg-accent-blue/80 transition-colors">
                  Save
                </button>
              </div>
            )}
          </div>

          {/* Bugzilla Issues Card (multi-key) */}
          <div className="tb-card p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-red-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Bugzilla Issues</h3>
              </div>
              {bugzillaKeys.length > 0 && !editingBugzilla && (
                <button onClick={() => setEditingBugzilla(true)} className="text-xs text-gray-500 hover:text-red-500">Edit</button>
              )}
            </div>
            {/* Display existing keys as tags */}
            {bugzillaKeys.length > 0 && !editingBugzilla && (
              <div className="flex flex-wrap gap-1.5">
                {bugzillaKeys.map((key, i) => (
                  <span key={i} className="inline-flex items-center px-2.5 py-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-xs font-mono text-red-600 dark:text-red-400">
                    {key}
                  </span>
                ))}
              </div>
            )}
            {/* Edit mode or empty — show input */}
            {(editingBugzilla || bugzillaKeys.length === 0) && (
              <div className="space-y-2">
                {editingBugzilla && bugzillaKeys.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {bugzillaKeys.map((key, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-xs font-mono text-red-600 dark:text-red-400">
                        {key}
                        <button onClick={() => { const updated = bugzillaKeys.filter((_, idx) => idx !== i); setBugzillaKeys(updated); }}
                          className="text-gray-400 hover:text-red-500 ml-0.5">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="text" value={bugzillaInput} onChange={e => setBugzillaInput(e.target.value)}
                    placeholder="e.g., 12345" className="tb-input flex-1 text-sm font-mono"
                    onKeyDown={e => { if (e.key === 'Enter' && bugzillaInput.trim()) { setBugzillaKeys([...bugzillaKeys, bugzillaInput.trim()]); setBugzillaInput(''); } }} />
                  <button onClick={() => { if (bugzillaInput.trim()) { setBugzillaKeys([...bugzillaKeys, bugzillaInput.trim()]); setBugzillaInput(''); } }}
                    className="px-2.5 py-1.5 text-sm font-medium text-red-500 border border-red-300/30 rounded-lg hover:bg-red-500/10 transition-colors">+</button>
                </div>
                <button onClick={async () => {
                  if (!ticket) return;
                  const finalKeys = bugzillaInput.trim() ? [...bugzillaKeys, bugzillaInput.trim()] : bugzillaKeys;
                  await ticketsApi.updateBugzillaKeys(ticket.id, finalKeys);
                  setBugzillaInput('');
                  setEditingBugzilla(false);
                  load();
                }} className="w-full px-3 py-1.5 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-500/80 transition-colors">
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
                  {['new', 'analyzing', 'assigned', 'in_progress', 'waiting_for_customer', 'escalated_to_jira', 'resolved', 'closed'].map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
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
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Assign Support Specialist</label>
                <select value={ticket.assignedEngineerId || ''} onChange={e => handleAssign(parseInt(e.target.value))} disabled={!!actionLoading} className="tb-select w-full">
                  <option value="">Select support specialist...</option>
                  {engineers.map((e: any) => <option key={e.id} value={e.id}>{e.name} ({e.currentWorkload}/{e.maxWorkload})</option>)}
                </select>
              </div>
              <button onClick={() => { setAnalyzePrompt(''); setShowAnalyzeModal(true); }} disabled={!!actionLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg text-sm font-medium hover:bg-purple-500/30 disabled:opacity-50 transition-colors">
                <RefreshCw className={`w-4 h-4 ${actionLoading === 'analyze' ? 'animate-spin' : ''}`} />
                {actionLoading === 'analyze' ? 'AI Analyzing...' : 'Re-analyze with AI'}
              </button>
              {ticket.status !== 'escalated_to_jira' && (
                <button onClick={() => {
                  setShowJiraModal(true);
                  setJiraFormNotes('');
                  setJiraFormLabels([]);
                  setJiraFormAccount(null);
                  setJiraFormVersion('');
                  setJiraLabelSearch('');
                  setJiraAccountSearch('');
                  setJiraVersionSearch('');
                  if (!jiraMetadata) {
                    setJiraMetaLoading(true);
                    settingsApi.getJiraMetadata(ticket.assignedEngineerId || undefined)
                      .then(setJiraMetadata)
                      .catch(() => toast.error('Failed to load Jira metadata'))
                      .finally(() => setJiraMetaLoading(false));
                  }
                }} disabled={!!actionLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-400 rounded-lg text-sm font-medium hover:bg-orange-500/30 disabled:opacity-50 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                  Escalate to Jira
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
                  if (isNaN(sourceId)) { toast.warning('Please enter a valid ticket ID'); setMerging(false); return; }
                  const result = await ticketsApi.mergeTicket(ticket.id, sourceId);
                  toast.success(result.message || 'Tickets merged successfully');
                  setShowMergeModal(false);
                  load();
                } catch (err: any) {
                  toast.error(err.message || 'Failed to merge tickets');
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

    {/* Jira Escalation Modal */}
    {showJiraModal && ticket && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowJiraModal(false)}>
        <div className="bg-white dark:bg-tb-card rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-4">
            <ExternalLink className="w-5 h-5 text-orange-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Escalate to Jira</h3>
          </div>

          {/* Read-only info */}
          <div className="space-y-2 mb-4 text-sm">
            <div className="flex gap-2">
              <span className="text-gray-500 dark:text-gray-400 w-28 shrink-0">Work Type:</span>
              <span className="font-medium text-gray-900 dark:text-white">Incident</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 dark:text-gray-400 w-28 shrink-0">Summary:</span>
              <span className="font-medium text-gray-900 dark:text-white truncate">[{ticket.ticketNumber}] {ticket.subject}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 dark:text-gray-400 w-28 shrink-0">Components:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {['prosbc', 'freesbc'].some(p => (ticket.product?.name || '').toLowerCase().includes(p)) ? 'SBC' : 'TMG'}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 dark:text-gray-400 w-28 shrink-0">Priority:</span>
              <PriorityBadge priority={ticket.priority} />
            </div>
          </div>

          <hr className="border-gray-200 dark:border-gray-700 mb-4" />

          {jiraMetaLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading Jira metadata...
            </div>
          ) : (
            <div className="space-y-4">
              {/* Labels — searchable multi-select */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Labels</label>
                {jiraFormLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {jiraFormLabels.map(l => (
                      <span key={l} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs font-medium">
                        {l}
                        <button onClick={() => setJiraFormLabels(jiraFormLabels.filter(x => x !== l))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    className="tb-input w-full pl-9 text-sm"
                    placeholder="Type to search labels..."
                    value={jiraLabelSearch}
                    onChange={e => { setJiraLabelSearch(e.target.value); setJiraLabelOpen(true); }}
                    onFocus={() => setJiraLabelOpen(true)}
                    onBlur={() => setTimeout(() => setJiraLabelOpen(false), 200)}
                  />
                </div>
                {jiraLabelOpen && (jiraMetadata?.labels || []).filter(l => !jiraFormLabels.includes(l) && l.toLowerCase().includes(jiraLabelSearch.toLowerCase())).length > 0 && (
                  <div className="absolute z-10 w-full mt-1 max-h-40 overflow-y-auto bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                    {(jiraMetadata?.labels || [])
                      .filter(l => !jiraFormLabels.includes(l) && l.toLowerCase().includes(jiraLabelSearch.toLowerCase()))
                      .slice(0, 20)
                      .map(l => (
                        <button key={l} type="button"
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
                          onMouseDown={e => { e.preventDefault(); setJiraFormLabels([...jiraFormLabels, l]); setJiraLabelSearch(''); }}
                        >{l}</button>
                      ))}
                  </div>
                )}
              </div>

              {/* Account — searchable single-select */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    className="tb-input w-full pl-9 text-sm"
                    placeholder="Type to search accounts..."
                    value={jiraAccountSearch}
                    onChange={e => { setJiraAccountSearch(e.target.value); setJiraAccountOpen(true); if (!e.target.value) setJiraFormAccount(null); }}
                    onFocus={() => setJiraAccountOpen(true)}
                    onBlur={() => setTimeout(() => setJiraAccountOpen(false), 200)}
                  />
                  {jiraFormAccount && (
                    <button onClick={() => { setJiraFormAccount(null); setJiraAccountSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  )}
                </div>
                {jiraAccountOpen && !jiraFormAccount && (jiraMetadata?.accounts || []).filter(a => a.name.toLowerCase().includes(jiraAccountSearch.toLowerCase())).length > 0 && (
                  <div className="absolute z-10 w-full mt-1 max-h-40 overflow-y-auto bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                    {(jiraMetadata?.accounts || [])
                      .filter(a => a.name.toLowerCase().includes(jiraAccountSearch.toLowerCase()))
                      .slice(0, 20)
                      .map(a => (
                        <button key={a.id} type="button"
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
                          onMouseDown={e => { e.preventDefault(); setJiraFormAccount({ id: a.id, name: a.name }); setJiraAccountSearch(a.name); setJiraAccountOpen(false); }}
                        >{a.name}</button>
                      ))}
                  </div>
                )}
              </div>

              {/* Affected Version — searchable single-select */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Affected Version</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    className="tb-input w-full pl-9 text-sm"
                    placeholder="Type to search versions..."
                    value={jiraVersionSearch}
                    onChange={e => { setJiraVersionSearch(e.target.value); setJiraVersionOpen(true); if (!e.target.value) setJiraFormVersion(''); }}
                    onFocus={() => setJiraVersionOpen(true)}
                    onBlur={() => setTimeout(() => setJiraVersionOpen(false), 200)}
                  />
                  {jiraFormVersion && (
                    <button onClick={() => { setJiraFormVersion(''); setJiraVersionSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  )}
                </div>
                {jiraVersionOpen && !jiraFormVersion && (jiraMetadata?.versions || []).filter(v => v.name.toLowerCase().includes(jiraVersionSearch.toLowerCase())).length > 0 && (
                  <div className="absolute z-10 w-full mt-1 max-h-40 overflow-y-auto bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                    {(jiraMetadata?.versions || [])
                      .filter(v => v.name.toLowerCase().includes(jiraVersionSearch.toLowerCase()))
                      .slice(0, 20)
                      .map(v => (
                        <button key={v.id} type="button"
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
                          onMouseDown={e => { e.preventDefault(); setJiraFormVersion(v.name); setJiraVersionSearch(v.name); setJiraVersionOpen(false); }}
                        >{v.name}{v.released ? ' (Released)' : ''}</button>
                      ))}
                  </div>
                )}
              </div>

              {/* Escalation Notes (Description) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Escalation Notes <span className="text-gray-400 font-normal">(Jira Description)</span></label>
                <textarea
                  className="tb-input w-full h-32 text-sm"
                  value={jiraFormNotes}
                  onChange={e => setJiraFormNotes(e.target.value)}
                  placeholder="Add notes for the engineering team..."
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setShowJiraModal(false)} className="tb-btn-secondary text-sm">Cancel</button>
            <button
              onClick={async () => {
                setActionLoading('jira');
                try {
                  const result = await ticketsApi.escalateToJira(ticket.id, {
                    labels: jiraFormLabels.length > 0 ? jiraFormLabels : undefined,
                    account: jiraFormAccount || undefined,
                    affectedVersion: jiraFormVersion || undefined,
                    escalationNotes: jiraFormNotes || undefined,
                  });
                  toast.success(`Jira issue created: ${result.issueKey}`);
                  setShowJiraModal(false);
                  load();
                } catch (err: any) {
                  toast.error(err.message);
                }
                setActionLoading('');
              }}
              disabled={actionLoading === 'jira' || jiraMetaLoading}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              {actionLoading === 'jira' ? 'Creating...' : 'Create Jira Incident'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Live Chat Widget */}
    {ticket && authUser && (
      <ChatWidget
        ticketId={ticket.id}
        currentUser={{
          userId: authUser.id,
          name: authUser.name || authUser.email,
          role: authUser.role,
        }}
      />
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
