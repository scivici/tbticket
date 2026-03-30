import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { tickets as ticketsApi } from '../../api/client';

export default function TicketPrint() {
  const { id } = useParams();
  const [ticket, setTicket] = useState<any>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isNumeric = /^\d+$/.test(id!);
    const getTicket = isNumeric ? ticketsApi.get(parseInt(id!)) : ticketsApi.getByNumber(id!);

    getTicket.then((t: any) => {
      setTicket(t);
      return Promise.all([
        ticketsApi.getResponses(t.id).catch(() => []),
        ticketsApi.getTimeEntries(t.id).catch(() => []),
      ]);
    })
      .then(([r, te]) => {
        setResponses(r.filter((resp: any) => !resp.is_internal));
        setTimeEntries(te);
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false);
        // Auto-trigger print after a short delay to let content render
        setTimeout(() => window.print(), 500);
      });
  }, [id]);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading...</div>;
  if (!ticket) return <div style={{ padding: '2rem', textAlign: 'center', color: '#c00' }}>Ticket not found</div>;

  const aiAnalysis = ticket.aiAnalysis ? (typeof ticket.aiAnalysis === 'string' ? JSON.parse(ticket.aiAnalysis) : ticket.aiAnalysis) : null;
  const totalHours = timeEntries.reduce((sum: number, e: any) => sum + e.hours, 0);

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-page { page-break-inside: avoid; }
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #1a1a1a;
          background: #fff;
          margin: 0;
          padding: 0;
          font-size: 13px;
          line-height: 1.5;
        }
      `}</style>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0ea5e9', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: '#0ea5e9' }}>TelcoBridges</h1>
            <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>Support Ticket Report</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '1.1rem', fontFamily: 'monospace', fontWeight: 600, margin: '0 0 0.25rem 0' }}>{ticket.ticketNumber}</p>
            <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>
              Printed: {new Date().toLocaleString()}
            </p>
          </div>
        </div>

        {/* Ticket Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '6px' }}>
          <div>
            <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</span>
            <p style={{ margin: '0.15rem 0 0', fontWeight: 600 }}>{ticket.subject}</p>
          </div>
          <div>
            <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status / Priority</span>
            <p style={{ margin: '0.15rem 0 0', fontWeight: 600 }}>{ticket.status.replace('_', ' ')} / {ticket.priority}</p>
          </div>
          <div>
            <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</span>
            <p style={{ margin: '0.15rem 0 0' }}>{ticket.customer.name} ({ticket.customer.email})</p>
          </div>
          <div>
            <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Support Specialist</span>
            <p style={{ margin: '0.15rem 0 0' }}>{ticket.assignedEngineer?.name || 'Unassigned'}</p>
          </div>
          <div>
            <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Product</span>
            <p style={{ margin: '0.15rem 0 0' }}>{ticket.product.name} ({ticket.product.model})</p>
          </div>
          <div>
            <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</span>
            <p style={{ margin: '0.15rem 0 0' }}>{ticket.category.name}</p>
          </div>
          <div>
            <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created</span>
            <p style={{ margin: '0.15rem 0 0' }}>{new Date(ticket.createdAt).toLocaleString()}</p>
          </div>
          {ticket.resolvedAt && (
            <div>
              <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resolved</span>
              <p style={{ margin: '0.15rem 0 0' }}>{new Date(ticket.resolvedAt).toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Description */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid #ddd', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>Description</h2>
          <p style={{ whiteSpace: 'pre-wrap', color: '#333' }}>{ticket.description}</p>
        </div>

        {/* AI Analysis Summary */}
        {aiAnalysis && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f3f0ff', borderRadius: '6px', borderLeft: '3px solid #8b5cf6' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#6d28d9', marginTop: 0, marginBottom: '0.75rem' }}>AI Analysis Summary</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div><strong>Classification:</strong> {aiAnalysis.classification}</div>
              <div><strong>Severity:</strong> {aiAnalysis.severity}</div>
              <div><strong>Complexity:</strong> {aiAnalysis.estimatedComplexity}</div>
              <div><strong>Confidence:</strong> {ticket.aiConfidence ? `${(ticket.aiConfidence * 100).toFixed(0)}%` : 'N/A'}</div>
            </div>
            {aiAnalysis.rootCauseHypothesis && (
              <div>
                <strong>Root Cause Hypothesis:</strong>
                <p style={{ margin: '0.25rem 0 0', color: '#333' }}>{aiAnalysis.rootCauseHypothesis}</p>
              </div>
            )}
            {aiAnalysis.suggestedActions?.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <strong>Recommended Actions:</strong>
                <ol style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
                  {aiAnalysis.suggestedActions.map((action: string, i: number) => (
                    <li key={i}>{action}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Responses */}
        {responses.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid #ddd', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
              Responses ({responses.length})
            </h2>
            {responses.map((r: any, i: number) => (
              <div key={r.id} style={{
                marginBottom: '0.75rem',
                padding: '0.75rem',
                borderLeft: r.author_role === 'admin' ? '3px solid #0ea5e9' : '3px solid #ccc',
                background: r.author_role === 'admin' ? '#f0f9ff' : '#fafafa',
                borderRadius: '0 4px 4px 0',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {r.author_name}
                    <span style={{
                      marginLeft: '0.5rem',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '3px',
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      background: r.author_role === 'admin' ? '#0ea5e9' : '#999',
                      color: '#fff',
                    }}>
                      {r.author_role === 'admin' ? 'Admin' : 'Customer'}
                    </span>
                  </span>
                  <span style={{ color: '#888', fontSize: '0.8rem' }}>{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p style={{ whiteSpace: 'pre-wrap', margin: 0, color: '#333' }}>{r.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Time Entries */}
        {timeEntries.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid #ddd', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
              Time Entries (Total: {totalHours.toFixed(1)}h)
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', color: '#666' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', color: '#666' }}>Support Specialist</th>
                  <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem', color: '#666' }}>Hours</th>
                  <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', color: '#666' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', color: '#666' }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {timeEntries.map((entry: any) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.35rem 0.5rem' }}>{entry.date}</td>
                    <td style={{ padding: '0.35rem 0.5rem' }}>{entry.author_name}</td>
                    <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{entry.hours}h</td>
                    <td style={{ padding: '0.35rem 0.5rem' }}>{entry.activity_type || 'general'}</td>
                    <td style={{ padding: '0.35rem 0.5rem', color: '#555' }}>{entry.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #ddd', paddingTop: '1rem', marginTop: '2rem', textAlign: 'center', color: '#999', fontSize: '0.75rem' }}>
          TelcoBridges Support - {ticket.ticketNumber} - Generated {new Date().toLocaleString()}
        </div>

        {/* Close button (no-print) */}
        <div className="no-print" style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: '0.5rem 1.5rem',
              background: '#0ea5e9',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
              marginRight: '0.5rem',
            }}
          >
            Print
          </button>
          <button
            onClick={() => window.close()}
            style={{
              padding: '0.5rem 1.5rem',
              background: '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
