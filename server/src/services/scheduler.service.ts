import { getDb } from '../db/connection';
import { getSetting } from './settings.service';
import * as notificationService from './notification.service';
import * as emailService from './email.service';
import * as activityService from './activity.service';
import * as slaService from './sla.service';

const INTERVAL_MS = 5 * 60 * 1000; // Run every 5 minutes

export function startScheduler() {
  console.log('[Scheduler] Starting lifecycle automation (every 5 minutes)');
  // Run once immediately, then on interval
  setTimeout(runScheduledTasks, 10_000); // 10s delay after startup
  setInterval(runScheduledTasks, INTERVAL_MS);
}

function runScheduledTasks() {
  try {
    autoCloseInactiveTickets();
    autoStateTransitions();
    sendIdleTicketAlerts();
    sendCustomerReminderAlerts();
    sendSlaBreachAlerts();
  } catch (error) {
    console.error('[Scheduler] Error running scheduled tasks:', error);
  }
}

/**
 * 5.1 - Auto-close tickets after X days of inactivity
 */
function autoCloseInactiveTickets() {
  const daysStr = getSetting('auto_close_days');
  if (!daysStr || daysStr === '0') return;
  const days = parseInt(daysStr);
  if (isNaN(days) || days <= 0) return;

  const db = getDb();

  // Find tickets in resolved/pending_info status that haven't been updated in X days
  const staleTickets = db.prepare(`
    SELECT t.id, t.ticket_number, t.customer_id, t.status,
           c.email as customer_email
    FROM tickets t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.status IN ('resolved', 'pending_info')
      AND t.updated_at < datetime('now', ?)
  `).all(`-${days} days`) as any[];

  if (staleTickets.length === 0) return;

  const closeStmt = db.prepare("UPDATE tickets SET status = 'closed', updated_at = datetime('now') WHERE id = ?");

  for (const ticket of staleTickets) {
    closeStmt.run(ticket.id);
    activityService.logActivity(ticket.id, null, 'System', 'status_changed', `Auto-closed after ${days} days of inactivity`);
    notificationService.createNotification(
      ticket.customer_id, ticket.id, 'status_change',
      'Ticket auto-closed',
      `Ticket ${ticket.ticket_number} was automatically closed after ${days} days of inactivity.`
    );
    emailService.sendTicketStatusEmail(ticket.customer_email, ticket.ticket_number, 'closed').catch(() => {});
  }

  if (staleTickets.length > 0) {
    console.log(`[Scheduler] Auto-closed ${staleTickets.length} inactive tickets`);
  }
}

/**
 * 5.3 - Auto-state transitions based on responses
 * When customer replies to a pending_info ticket → move to in_progress
 * When admin replies to a new/assigned ticket → move to in_progress
 */
function autoStateTransitions() {
  const enabled = getSetting('auto_state_transitions');
  if (enabled === 'false') return;

  const db = getDb();

  // Find pending_info tickets where the last response is from customer
  const pendingWithCustomerReply = db.prepare(`
    SELECT t.id, t.ticket_number, t.customer_id
    FROM tickets t
    WHERE t.status = 'pending_info'
      AND EXISTS (
        SELECT 1 FROM ticket_responses tr
        WHERE tr.ticket_id = t.id
          AND tr.author_role = 'customer'
          AND tr.created_at > (
            SELECT COALESCE(MAX(tr2.created_at), '1970-01-01')
            FROM ticket_responses tr2
            WHERE tr2.ticket_id = t.id AND tr2.author_role = 'admin' AND tr2.is_internal = 0
          )
      )
  `).all() as any[];

  const updateStmt = db.prepare("UPDATE tickets SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?");

  for (const ticket of pendingWithCustomerReply) {
    updateStmt.run(ticket.id);
    activityService.logActivity(ticket.id, null, 'System', 'status_changed', 'Auto-transitioned to in_progress (customer replied)');
  }

  if (pendingWithCustomerReply.length > 0) {
    console.log(`[Scheduler] Auto-transitioned ${pendingWithCustomerReply.length} tickets from pending_info to in_progress`);
  }
}

/**
 * 5.4 + 5.5 - Idle ticket alerts
 * Alert when tickets have no activity for X hours
 */
function sendIdleTicketAlerts() {
  const hoursStr = getSetting('idle_ticket_alert_hours');
  if (!hoursStr || hoursStr === '0') return;
  const hours = parseInt(hoursStr);
  if (isNaN(hours) || hours <= 0) return;

  const db = getDb();

  // Find open tickets with no response activity in X hours
  const idleTickets = db.prepare(`
    SELECT t.id, t.ticket_number, t.assigned_engineer_id, t.customer_id, t.subject,
           e.name as engineer_name
    FROM tickets t
    LEFT JOIN engineers e ON t.assigned_engineer_id = e.id
    WHERE t.status IN ('assigned', 'in_progress')
      AND t.updated_at < datetime('now', ?)
      AND NOT EXISTS (
        SELECT 1 FROM ticket_activity_log tal
        WHERE tal.ticket_id = t.id
          AND tal.action = 'idle_alert_sent'
          AND tal.created_at > datetime('now', ?)
      )
  `).all(`-${hours} hours`, `-${hours} hours`) as any[];

  for (const ticket of idleTickets) {
    // Log that we sent an alert to avoid re-alerting
    activityService.logActivity(ticket.id, null, 'System', 'idle_alert_sent', `No activity for ${hours}+ hours`);

    // Notify admins (ticket 0 means system-level)
    // Find admin users
    const admins = db.prepare("SELECT id FROM customers WHERE role = 'admin'").all() as any[];
    for (const admin of admins) {
      notificationService.createNotification(
        admin.id, ticket.id, 'status_change',
        `Idle ticket: ${ticket.ticket_number}`,
        `Ticket "${ticket.subject}" has had no activity for ${hours}+ hours.${ticket.engineer_name ? ` Assigned to ${ticket.engineer_name}.` : ' Unassigned.'}`
      );
    }
  }

  if (idleTickets.length > 0) {
    console.log(`[Scheduler] Sent idle alerts for ${idleTickets.length} tickets`);
  }
}

/**
 * 5.2 - Auto-reminders for customers with pending_info tickets
 */
function sendCustomerReminderAlerts() {
  const hoursStr = getSetting('customer_reminder_hours');
  if (!hoursStr || hoursStr === '0') return;
  const hours = parseInt(hoursStr);
  if (isNaN(hours) || hours <= 0) return;

  const db = getDb();

  // Find pending_info tickets where we haven't sent a reminder recently
  const pendingTickets = db.prepare(`
    SELECT t.id, t.ticket_number, t.customer_id, t.subject,
           c.email as customer_email, c.name as customer_name
    FROM tickets t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.status = 'pending_info'
      AND t.updated_at < datetime('now', ?)
      AND NOT EXISTS (
        SELECT 1 FROM ticket_activity_log tal
        WHERE tal.ticket_id = t.id
          AND tal.action = 'customer_reminder_sent'
          AND tal.created_at > datetime('now', ?)
      )
  `).all(`-${hours} hours`, `-${hours} hours`) as any[];

  for (const ticket of pendingTickets) {
    activityService.logActivity(ticket.id, null, 'System', 'customer_reminder_sent', `Auto-reminder sent after ${hours}+ hours`);

    notificationService.createNotification(
      ticket.customer_id, ticket.id, 'response',
      'Reminder: We need your input',
      `Ticket ${ticket.ticket_number} is waiting for your response. Please provide the requested information to help us resolve your issue.`
    );

    emailService.sendTicketResponseEmail(
      ticket.customer_email, ticket.ticket_number, 'Support Team',
      `This is a friendly reminder that your ticket "${ticket.subject}" is waiting for your response. Please provide the requested information so we can continue working on your issue.`
    ).catch(() => {});
  }

  if (pendingTickets.length > 0) {
    console.log(`[Scheduler] Sent ${pendingTickets.length} customer reminders`);
  }
}

/**
 * 9.1 - SLA breach alerts to customers and engineers
 */
function sendSlaBreachAlerts() {
  try {
    const breached = slaService.getBreachedTickets();
    if (!breached || breached.length === 0) return;

    const db = getDb();

    for (const sla of breached) {
      if (!sla) continue;
      const ticketId = sla.ticketId;

      // Check if we already sent a breach alert recently (within 4 hours)
      const recentAlert = db.prepare(`
        SELECT 1 FROM ticket_activity_log
        WHERE ticket_id = ? AND action = 'sla_breach_alert' AND created_at > datetime('now', '-4 hours')
      `).get(ticketId);

      if (recentAlert) continue;

      // Fetch ticket details
      const ticket = db.prepare(`
        SELECT t.ticket_number, t.subject, t.customer_id, t.assigned_engineer_id,
               c.email as customer_email, e.name as engineer_name
        FROM tickets t
        JOIN customers c ON t.customer_id = c.id
        LEFT JOIN engineers e ON t.assigned_engineer_id = e.id
        WHERE t.id = ?
      `).get(ticketId) as any;

      if (!ticket) continue;

      activityService.logActivity(ticketId, null, 'System', 'sla_breach_alert', 'SLA breach alert sent');

      // Notify customer
      notificationService.createNotification(
        ticket.customer_id, ticketId, 'status_change',
        'SLA update on your ticket',
        `We are aware that ticket ${ticket.ticket_number} requires attention and our team is working on it.`
      );

      // Notify all admins
      const admins = db.prepare("SELECT id FROM customers WHERE role = 'admin'").all() as any[];
      for (const admin of admins) {
        notificationService.createNotification(
          admin.id, ticketId, 'status_change',
          `SLA Breach: ${ticket.ticket_number}`,
          `Ticket "${ticket.subject}" has breached its SLA.${ticket.engineer_name ? ` Assigned to ${ticket.engineer_name}.` : ' Unassigned.'}`
        );
      }

      // Send email to customer
      emailService.sendTicketStatusEmail(ticket.customer_email, ticket.ticket_number, 'in_progress').catch(() => {});
    }

    console.log(`[Scheduler] Processed ${breached.length} SLA breaches`);
  } catch (error) {
    // SLA service might not have all fields — gracefully skip
    console.warn('[Scheduler] SLA breach check skipped:', (error as any)?.message);
  }
}
