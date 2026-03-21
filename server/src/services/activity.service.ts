import { getDb } from '../db/connection';

export function logActivity(ticketId: number, actorId: number | null, actorName: string, action: string, details?: string) {
  const db = getDb();
  db.prepare('INSERT INTO ticket_activity_log (ticket_id, actor_id, actor_name, action, details) VALUES (?, ?, ?, ?, ?)')
    .run(ticketId, actorId, actorName, action, details || null);
}

export function getActivities(ticketId: number) {
  const db = getDb();
  return db.prepare('SELECT * FROM ticket_activity_log WHERE ticket_id = ? ORDER BY created_at DESC').all(ticketId);
}
