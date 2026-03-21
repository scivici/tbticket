import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { tickets as ticketsApi } from '../api/client';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Send, Clock, FileText, ArrowLeft } from 'lucide-react';

export default function CustomerTicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [responseMessage, setResponseMessage] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([ticketsApi.get(parseInt(id!)), ticketsApi.getResponses(parseInt(id!))])
      .then(([t, r]) => { setTicket(t); setResponses(r); })
      .catch(err => { console.error(err); setError('Failed to load ticket'); })
      .finally(() => setLoading(false));
  };

  const loadResponses = () => {
    ticketsApi.getResponses(parseInt(id!)).then(setResponses).catch(console.error);
  };

  useEffect(() => { load(); }, [id]);

  const handleSendResponse = async () => {
    if (!responseMessage.trim()) return;
    setSendingResponse(true);
    try {
      await ticketsApi.addResponse(parseInt(id!), responseMessage.trim());
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
    </div>
  );
}
