import { query, queryOne, queryAll } from '../db/connection';

export async function createNotification(customerId: number, ticketId: number, type: string, title: string, message: string) {
  await query(
    'INSERT INTO notifications (customer_id, ticket_id, type, title, message) VALUES (?, ?, ?, ?, ?)',
    [customerId, ticketId, type, title, message]
  );
}

export async function getNotifications(customerId: number, unreadOnly: boolean = false) {
  const where = unreadOnly ? 'AND is_read = 0' : '';
  return await queryAll(
    `SELECT n.*, t.ticket_number FROM notifications n JOIN tickets t ON n.ticket_id = t.id WHERE n.customer_id = ? ${where} ORDER BY n.created_at DESC LIMIT 50`,
    [customerId]
  );
}

export async function getUnreadCount(customerId: number): Promise<number> {
  const result = await queryOne<any>('SELECT COUNT(*) as count FROM notifications WHERE customer_id = ? AND is_read = 0', [customerId]);
  return result?.count || 0;
}

export async function markAsRead(notificationId: number, customerId: number) {
  await query('UPDATE notifications SET is_read = 1 WHERE id = ? AND customer_id = ?', [notificationId, customerId]);
}

export async function markAllAsRead(customerId: number) {
  await query('UPDATE notifications SET is_read = 1 WHERE customer_id = ? AND is_read = 0', [customerId]);
}
