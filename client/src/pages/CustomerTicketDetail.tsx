import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { tickets as ticketsApi } from '../api/client';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Send, Clock, FileText, ArrowLeft, Star, Upload, Paperclip } from 'lucide-react';

export default function CustomerTicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [responseMessage, setResponseMessage] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);
  const [error, setError] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Satisfaction
  const [satisfaction, setSatisfaction] = useState<any>(null);
  const [satLoading, setSatLoading] = useState(false);
  const [satRating, setSatRating] = useState(0);
  const [satHover, setSatHover] = useState(0);
  const [satComment, setSatComment] = useState('');
  const [satSubmitting, setSatSubmitting] = useState(false);
  const [satSubmitted, setSatSubmitted] = useState(false);

  const loadSatisfaction = (ticketId: number) => {
    setSatLoading(true);
    ticketsApi.getSatisfaction(ticketId)
      .then(data => { if (data && data.rating) setSatisfaction(data); })
      .catch(() => {})
      .finally(() => setSatLoading(false));
  };

  const handleSubmitSatisfaction = async () => {
    if (satRating === 0 || !ticket) return;
    setSatSubmitting(true);
    try {
      await ticketsApi.submitSatisfaction(ticket.id, satRating, satComment.trim() || undefined);
      setSatSubmitted(true);
      loadSatisfaction(ticket.id);
    } catch (err) {
      console.error(err);
    } finally {
      setSatSubmitting(false);
    }
  };

  // Support both numeric ID and ticket number (TKT-xxx)
  const ticketIdOrNumber = id!;
  const isNumeric = /^\d+$/.test(ticketIdOrNumber);

  const load = () => {
    setLoading(true);
    const getTicket = isNumeric ? ticketsApi.get(parseInt(ticketIdOrNumber)) : ticketsApi.getByNumber(ticketIdOrNumber);
    getTicket
      .then((t: any) => {
        setTicket(t);
        return ticketsApi.getResponses(t.id);
      })
      .then((r: any) => setResponses(r))
      .catch(err => { console.error(err); setError('Failed to load ticket'); })
      .finally(() => setLoading(false));
  };

  const loadResponses = () => {
    if (!ticket) return;
    ticketsApi.getResponses(ticket.id).then(setResponses).catch(console.error);
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (ticket && (ticket.status === 'resolved' || ticket.status === 'closed')) {
      loadSatisfaction(ticket.id);
    }
  }, [ticket?.status]);

  const handleSendResponse = async () => {
    if (!responseMessage.trim() || !ticket) return;
    setSendingResponse(true);
    try {
      await ticketsApi.addResponse(ticket.id, responseMessage.trim());
      setResponseMessage('');
      loadResponses();
    } catch (err) {
      console.error(err);
    } finally {
      setSendingResponse(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Please <Link to="/login" className="text-accent-blue hover:underline">sign in</Link> to view your ticket.</p>
      </div>
    );
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading ticket...</div>;
  if (error || !ticket) return <div className="text-center py-12 text-red-400">{error || 'Ticket not found'}</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link to="/my-tickets" className="inline-flex items-center gap-2 text-accent-blue hover:underline text-sm">
        <ArrowLeft className="w-4 h-4" />
        Back to My Tickets
      </Link>

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

          <div className="tb-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <Paperclip className="w-5 h-5 text-accent-blue" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Attachments</h3>
              <span className="ml-auto text-sm text-gray-500">{ticket.attachments?.length || 0} file{ticket.attachments?.length !== 1 ? 's' : ''}</span>
            </div>
            {ticket.attachments?.length > 0 && (
              <div className="space-y-2 mb-4">
                {ticket.attachments.map((att: any) => (
                  <a key={att.id} href={`/uploads/${att.filename}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-accent-blue hover:underline text-sm">
                    <FileText className="w-4 h-4" />
                    {att.original_name} ({(att.size / 1024).toFixed(1)} KB)
                  </a>
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
                    r.author_role === 'admin'
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
              <textarea
                value={responseMessage}
                onChange={e => setResponseMessage(e.target.value)}
                placeholder="Type your response..."
                rows={3}
                className="tb-input w-full mb-3"
              />
              <div className="flex justify-end">
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
        </div>

        <div className="space-y-4">
          <div className="tb-card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Details</h3>
            <div className="space-y-3 text-sm">
              <div><p className="text-gray-500">Product</p><p className="font-medium text-gray-700 dark:text-gray-200">{ticket.product.name} ({ticket.product.model})</p></div>
              <div><p className="text-gray-500">Category</p><p className="font-medium text-gray-700 dark:text-gray-200">{ticket.category.name}</p></div>
              <div><p className="text-gray-500">Assigned Engineer</p><p className="font-medium text-gray-700 dark:text-gray-200">{ticket.assignedEngineer?.name || 'Unassigned'}</p></div>
              <div><p className="text-gray-500">Created</p><p className="font-medium text-gray-700 dark:text-gray-200">{new Date(ticket.createdAt).toLocaleString()}</p></div>
              {ticket.resolvedAt && (
                <div><p className="text-gray-500">Resolved</p><p className="font-medium text-gray-700 dark:text-gray-200">{new Date(ticket.resolvedAt).toLocaleString()}</p></div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Satisfaction Survey - only for resolved/closed */}
      {(ticket.status === 'resolved' || ticket.status === 'closed') && (
        <div className="tb-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-yellow-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Rate Your Experience</h3>
          </div>

          {satLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : satSubmitted ? (
            <p className="text-sm text-accent-green font-medium">Thank you for your feedback!</p>
          ) : satisfaction ? (
            <div className="space-y-3">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    className={`w-6 h-6 ${star <= satisfaction.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                  />
                ))}
              </div>
              {satisfaction.comment && (
                <p className="text-sm text-gray-600 dark:text-gray-300 italic">"{satisfaction.comment}"</p>
              )}
              <p className="text-xs text-gray-500">Submitted {new Date(satisfaction.created_at || satisfaction.createdAt).toLocaleString()}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setSatRating(star)}
                    onMouseEnter={() => setSatHover(star)}
                    onMouseLeave={() => setSatHover(0)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= (satHover || satRating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300 dark:text-gray-600'
                      } transition-colors`}
                    />
                  </button>
                ))}
              </div>
              <textarea
                value={satComment}
                onChange={e => setSatComment(e.target.value)}
                placeholder="Optional: Tell us about your experience..."
                rows={3}
                className="tb-input w-full"
              />
              <button
                onClick={handleSubmitSatisfaction}
                disabled={satRating === 0 || satSubmitting}
                className="tb-btn-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                {satSubmitting ? 'Submitting...' : 'Submit Rating'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
