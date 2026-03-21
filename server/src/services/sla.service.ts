import { getDb } from '../db/connection';

export interface SlaStatus {
  ticketId: number;
  priority: string;
  responseTimeHours: number;
  resolutionTimeHours: number;
  createdAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  responseDeadline: string;
  resolutionDeadline: string;
  responseBreached: boolean;
  resolutionBreached: boolean;
  responseRemaining: number | null; // hours remaining, negative if breached
  resolutionRemaining: number | null;
}

export function getSlaPolicy(priority: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM sla_policies WHERE priority = ?').get(priority) as any;
}

export function getAllSlaPolicies() {
  const db = getDb();
  return db.prepare('SELECT * FROM sla_policies ORDER BY response_time_hours').all();
}

export function updateSlaPolicy(priority: string, responseTimeHours: number, resolutionTimeHours: number) {
  const db = getDb();
  db.prepare('UPDATE sla_policies SET response_time_hours = ?, resolution_time_hours = ? WHERE priority = ?')
    .run(responseTimeHours, resolutionTimeHours, priority);
}

export function getTicketSlaStatus(ticketId: number): SlaStatus | null {
  const db = getDb();
  const ticket = db.prepare('SELECT id, priority, created_at, resolved_at FROM tickets WHERE id = ?').get(ticketId) as any;
  if (!ticket) return null;

  const policy = getSlaPolicy(ticket.priority);
  if (!policy) return null;

  // Find first non-internal response
  const firstResponse = db.prepare(
    "SELECT created_at FROM ticket_responses WHERE ticket_id = ? AND author_role = 'admin' AND is_internal = 0 ORDER BY created_at ASC LIMIT 1"
  ).get(ticketId) as any;

  const now = new Date();
  const created = new Date(ticket.created_at + 'Z');
  const responseDeadline = new Date(created.getTime() + policy.response_time_hours * 3600000);
  const resolutionDeadline = new Date(created.getTime() + policy.resolution_time_hours * 3600000);

  const responseTime = firstResponse ? new Date(firstResponse.created_at + 'Z') : now;
  const resolveTime = ticket.resolved_at ? new Date(ticket.resolved_at + 'Z') : now;

  const responseBreached = responseTime > responseDeadline;
  const resolutionBreached = resolveTime > resolutionDeadline;

  const responseRemaining = firstResponse ? null : (responseDeadline.getTime() - now.getTime()) / 3600000;
  const resolutionRemaining = ticket.resolved_at ? null : (resolutionDeadline.getTime() - now.getTime()) / 3600000;

  return {
    ticketId: ticket.id,
    priority: ticket.priority,
    responseTimeHours: policy.response_time_hours,
    resolutionTimeHours: policy.resolution_time_hours,
    createdAt: ticket.created_at,
    firstResponseAt: firstResponse?.created_at || null,
    resolvedAt: ticket.resolved_at,
    responseDeadline: responseDeadline.toISOString(),
    resolutionDeadline: resolutionDeadline.toISOString(),
    responseBreached,
    resolutionBreached,
    responseRemaining: responseRemaining !== null ? Math.round(responseRemaining * 10) / 10 : null,
    resolutionRemaining: resolutionRemaining !== null ? Math.round(resolutionRemaining * 10) / 10 : null,
  };
}

export function getBreachedTickets() {
  const db = getDb();
  const openTickets = db.prepare("SELECT id FROM tickets WHERE status NOT IN ('resolved', 'closed')").all() as any[];
  return openTickets
    .map(t => getTicketSlaStatus(t.id))
    .filter(s => s && (s.responseBreached || s.resolutionBreached));
}
