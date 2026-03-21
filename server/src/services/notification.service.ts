import { getDb } from '../db/connection';

export function createNotification(customerId: number, ticketId: number, type: string, title: string, message: string) {
  const db = getDb();
  db.prepare(
    'INSERT INTO notifications (customer_id, ticket_id, type, title, message) VALUES (?, ?, ?, ?, ?)'
  ).run(customerId, ticketId, type, title, message);
}

export function getNotifications(customerId: number, unreadOnly: boolean = false) {
  const db = getDb();
  const where = unreadOnly ? 'AND is_read = 0' : '';
  return db.prepare(
    `SELECT n.*, t.ticket_number FROM notifications n JOIN tickets t ON n.ticket_id = t.id WHERE n.customer_id = ? ${where} ORDER BY n.created_at DESC LIMIT 50`
  ).all(customerId);
}

export function getUnreadCount(customerId: number): number {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE customer_id = ? AND is_read = 0').get(customerId) as any;
  return result.count;
}

export function markAsRead(notificationId: number, customerId: number) {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND customer_id = ?').run(notificationId, customerId);
}

export function markAllAsRead(customerId: number) {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE customer_id = ? AND is_read = 0').run(customerId);
}
