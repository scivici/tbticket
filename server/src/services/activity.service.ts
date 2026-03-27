import { query, queryAll } from '../db/connection';

export async function logActivity(ticketId: number, actorId: number | null, actorName: string, action: string, details?: string) {
  await query('INSERT INTO ticket_activity_log (ticket_id, actor_id, actor_name, action, details) VALUES (?, ?, ?, ?, ?)',
    [ticketId, actorId, actorName, action, details || null]);
}

export async function getActivities(ticketId: number) {
  return await queryAll('SELECT * FROM ticket_activity_log WHERE ticket_id = ? ORDER BY created_at DESC', [ticketId]);
}
