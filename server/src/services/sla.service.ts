import { query, queryOne, queryAll } from '../db/connection';

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
  slaPaused: boolean;
  slaManuallyPaused: boolean;
  totalPausedHours: number;
}

/** Calculate total paused milliseconds including any active pause */
function getTotalPausedMs(ticket: { sla_paused_at: string | null; sla_total_paused_ms: number }): number {
  let total = Number(ticket.sla_total_paused_ms) || 0;
  if (ticket.sla_paused_at) {
    total += Date.now() - new Date(ticket.sla_paused_at).getTime();
  }
  return Math.max(0, total);
}

export async function getSlaPolicy(priority: string) {
  return await queryOne<any>('SELECT * FROM sla_policies WHERE priority = ?', [priority]);
}

export async function getAllSlaPolicies() {
  return await queryAll('SELECT * FROM sla_policies ORDER BY response_time_hours');
}

export async function updateSlaPolicy(priority: string, responseTimeHours: number, resolutionTimeHours: number) {
  await query('UPDATE sla_policies SET response_time_hours = ?, resolution_time_hours = ? WHERE priority = ?',
    [responseTimeHours, resolutionTimeHours, priority]);
}

export async function getTicketSlaStatus(ticketId: number): Promise<SlaStatus | null> {
  const ticket = await queryOne<any>('SELECT id, priority, created_at, resolved_at, sla_paused_at, sla_total_paused_ms, sla_manually_paused FROM tickets WHERE id = ?', [ticketId]);
  if (!ticket) return null;

  const policy = await getSlaPolicy(ticket.priority);
  if (!policy) return null;

  // Find first non-internal response
  const firstResponse = await queryOne<any>(
    "SELECT created_at FROM ticket_responses WHERE ticket_id = ? AND author_role = 'admin' AND is_internal = FALSE ORDER BY created_at ASC LIMIT 1",
    [ticketId]
  );

  const now = new Date();
  const created = new Date(ticket.created_at + 'Z');
  const pausedMs = getTotalPausedMs(ticket);
  const slaPaused = !!ticket.sla_paused_at;

  // Deadlines are shifted forward by the total paused duration
  const responseDeadline = new Date(created.getTime() + policy.response_time_hours * 3600000 + pausedMs);
  const resolutionDeadline = new Date(created.getTime() + policy.resolution_time_hours * 3600000 + pausedMs);

  const responseTime = firstResponse ? new Date(firstResponse.created_at + 'Z') : now;
  const resolveTime = ticket.resolved_at ? new Date(ticket.resolved_at + 'Z') : now;

  // If SLA is currently paused, don't count as breached
  const responseBreached = slaPaused ? false : responseTime > responseDeadline;
  const resolutionBreached = slaPaused ? false : resolveTime > resolutionDeadline;

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
    slaPaused,
    slaManuallyPaused: !!ticket.sla_manually_paused,
    totalPausedHours: Math.round((pausedMs / 3600000) * 10) / 10,
  };
}

export async function getBreachedTickets() {
  // Exclude paused tickets (waiting_for_customer, resolved, closed, or manually SLA-paused)
  const openTickets = await queryAll<any>("SELECT id FROM tickets WHERE status NOT IN ('resolved', 'closed', 'waiting_for_customer') AND sla_paused_at IS NULL");
  const results = [];
  for (const t of openTickets) {
    const status = await getTicketSlaStatus(t.id);
    if (status && (status.responseBreached || status.resolutionBreached)) {
      results.push(status);
    }
  }
  return results;
}
