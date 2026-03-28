import { query, queryOne, queryAll } from '../db/connection';
import { getSetting } from './settings.service';
import * as notificationService from './notification.service';
import * as emailService from './email.service';
import * as activityService from './activity.service';
import * as slaService from './sla.service';
import { startEmailReceiver } from './email-receiver.service';
import * as webhookService from './webhook.service';
import { createLogger } from './logger.service';

const log = createLogger('Scheduler');

const INTERVAL_MS = 5 * 60 * 1000; // Run every 5 minutes

export function startScheduler() {
  log.info('Starting lifecycle automation (every 5 minutes)');
  // Run once immediately, then on interval
  setTimeout(runScheduledTasks, 10_000); // 10s delay after startup
  setInterval(runScheduledTasks, INTERVAL_MS);

  // Start email-to-ticket poller (has its own interval)
  startEmailReceiver().catch(err => log.warn('Email receiver start failed', { error: err.message }));
}

async function runScheduledTasks() {
  try {
    await autoCloseInactiveTickets();
    await autoStateTransitions();
    await sendIdleTicketAlerts();
    await sendCustomerReminderAlerts();
    await sendSlaBreachAlerts();
  } catch (error) {
    log.error('Error running scheduled tasks', { error: (error as Error).message });
  }
}

/**
 * 5.1 - Auto-close tickets after X days of inactivity
 */
async function autoCloseInactiveTickets() {
  const daysStr = await getSetting('auto_close_days');
  if (!daysStr || daysStr === '0') return;
  const days = parseInt(daysStr);
  if (isNaN(days) || days <= 0) return;

  // Find tickets in resolved/pending_info status that haven't been updated in X days
  const staleTickets = await queryAll<any>(`
    SELECT t.id, t.ticket_number, t.customer_id, t.status,
           c.email as customer_email
    FROM tickets t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.status IN ('resolved', 'pending_info')
      AND t.updated_at < CURRENT_TIMESTAMP - INTERVAL '${days} days'
  `);

  if (staleTickets.length === 0) return;

  for (const ticket of staleTickets) {
    await query("UPDATE tickets SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [ticket.id]);
    await activityService.logActivity(ticket.id, null, 'System', 'status_changed', `Auto-closed after ${days} days of inactivity`);
    await notificationService.createNotification(
      ticket.customer_id, ticket.id, 'status_change',
      'Ticket auto-closed',
      `Ticket ${ticket.ticket_number} was automatically closed after ${days} days of inactivity.`
    );
    emailService.sendTicketStatusEmail(ticket.customer_email, ticket.ticket_number, 'closed').catch(() => {});
  }

  if (staleTickets.length > 0) {
    log.info(`Auto-closed ${staleTickets.length} inactive tickets`);
  }
}

/**
 * 5.3 - Auto-state transitions based on responses
 * When customer replies to a pending_info ticket → move to in_progress
 * When admin replies to a new/assigned ticket → move to in_progress
 */
async function autoStateTransitions() {
  const enabled = await getSetting('auto_state_transitions');
  if (enabled === 'false') return;

  // Find pending_info tickets where the last response is from customer
  const pendingWithCustomerReply = await queryAll<any>(`
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
            WHERE tr2.ticket_id = t.id AND tr2.author_role = 'admin' AND tr2.is_internal = FALSE
          )
      )
  `);

  for (const ticket of pendingWithCustomerReply) {
    await query("UPDATE tickets SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [ticket.id]);
    await activityService.logActivity(ticket.id, null, 'System', 'status_changed', 'Auto-transitioned to in_progress (customer replied)');
  }

  if (pendingWithCustomerReply.length > 0) {
    log.info(`Auto-transitioned ${pendingWithCustomerReply.length} tickets from pending_info to in_progress`);
  }
}

/**
 * 5.4 + 5.5 - Idle ticket alerts
 * Alert when tickets have no activity for X hours
 */
async function sendIdleTicketAlerts() {
  const hoursStr = await getSetting('idle_ticket_alert_hours');
  if (!hoursStr || hoursStr === '0') return;
  const hours = parseInt(hoursStr);
  if (isNaN(hours) || hours <= 0) return;

  // Find open tickets with no response activity in X hours
  const idleTickets = await queryAll<any>(`
    SELECT t.id, t.ticket_number, t.assigned_engineer_id, t.customer_id, t.subject,
           e.name as engineer_name
    FROM tickets t
    LEFT JOIN engineers e ON t.assigned_engineer_id = e.id
    WHERE t.status IN ('assigned', 'in_progress')
      AND t.updated_at < CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
      AND NOT EXISTS (
        SELECT 1 FROM ticket_activity_log tal
        WHERE tal.ticket_id = t.id
          AND tal.action = 'idle_alert_sent'
          AND tal.created_at > CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
      )
  `);

  for (const ticket of idleTickets) {
    // Log that we sent an alert to avoid re-alerting
    await activityService.logActivity(ticket.id, null, 'System', 'idle_alert_sent', `No activity for ${hours}+ hours`);

    // Notify admins (ticket 0 means system-level)
    // Find admin users
    const admins = await queryAll<any>("SELECT id FROM customers WHERE role = 'admin'");
    for (const admin of admins) {
      await notificationService.createNotification(
        admin.id, ticket.id, 'status_change',
        `Idle ticket: ${ticket.ticket_number}`,
        `Ticket "${ticket.subject}" has had no activity for ${hours}+ hours.${ticket.engineer_name ? ` Assigned to ${ticket.engineer_name}.` : ' Unassigned.'}`
      );
    }
  }

  if (idleTickets.length > 0) {
    log.info(`Sent idle alerts for ${idleTickets.length} tickets`);
  }
}

/**
 * 5.2 - Auto-reminders for customers with pending_info tickets
 */
async function sendCustomerReminderAlerts() {
  const hoursStr = await getSetting('customer_reminder_hours');
  if (!hoursStr || hoursStr === '0') return;
  const hours = parseInt(hoursStr);
  if (isNaN(hours) || hours <= 0) return;

  // Find pending_info tickets where we haven't sent a reminder recently
  const pendingTickets = await queryAll<any>(`
    SELECT t.id, t.ticket_number, t.customer_id, t.subject,
           c.email as customer_email, c.name as customer_name
    FROM tickets t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.status = 'pending_info'
      AND t.updated_at < CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
      AND NOT EXISTS (
        SELECT 1 FROM ticket_activity_log tal
        WHERE tal.ticket_id = t.id
          AND tal.action = 'customer_reminder_sent'
          AND tal.created_at > CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
      )
  `);

  for (const ticket of pendingTickets) {
    await activityService.logActivity(ticket.id, null, 'System', 'customer_reminder_sent', `Auto-reminder sent after ${hours}+ hours`);

    await notificationService.createNotification(
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
    log.info(`Sent ${pendingTickets.length} customer reminders`);
  }
}

/**
 * 9.1 - SLA breach alerts to customers and engineers
 */
async function sendSlaBreachAlerts() {
  try {
    const breached = await slaService.getBreachedTickets();
    if (!breached || breached.length === 0) return;

    for (const sla of breached) {
      if (!sla) continue;
      const ticketId = sla.ticketId;

      // Check if we already sent a breach alert recently (within 4 hours)
      const recentAlert = await queryOne<any>(`
        SELECT 1 FROM ticket_activity_log
        WHERE ticket_id = ? AND action = 'sla_breach_alert' AND created_at > CURRENT_TIMESTAMP - INTERVAL '4 hours'
      `, [ticketId]);

      if (recentAlert) continue;

      // Fetch ticket details
      const ticket = await queryOne<any>(`
        SELECT t.ticket_number, t.subject, t.customer_id, t.assigned_engineer_id,
               c.email as customer_email, e.name as engineer_name
        FROM tickets t
        JOIN customers c ON t.customer_id = c.id
        LEFT JOIN engineers e ON t.assigned_engineer_id = e.id
        WHERE t.id = ?
      `, [ticketId]);

      if (!ticket) continue;

      await activityService.logActivity(ticketId, null, 'System', 'sla_breach_alert', 'SLA breach alert sent');

      // Notify customer
      await notificationService.createNotification(
        ticket.customer_id, ticketId, 'status_change',
        'SLA update on your ticket',
        `We are aware that ticket ${ticket.ticket_number} requires attention and our team is working on it.`
      );

      // Notify all admins
      const admins = await queryAll<any>("SELECT id FROM customers WHERE role = 'admin'");
      for (const admin of admins) {
        await notificationService.createNotification(
          admin.id, ticketId, 'status_change',
          `SLA Breach: ${ticket.ticket_number}`,
          `Ticket "${ticket.subject}" has breached its SLA.${ticket.engineer_name ? ` Assigned to ${ticket.engineer_name}.` : ' Unassigned.'}`
        );
      }

      // Send email to customer
      emailService.sendTicketStatusEmail(ticket.customer_email, ticket.ticket_number, 'in_progress').catch(() => {});

      // Teams/Slack webhook for SLA breach
      const overdueHours = Math.abs(Math.min(sla.responseRemaining || 0, sla.resolutionRemaining || 0));
      webhookService.notifySlaBreach(ticket.ticket_number, ticket.subject, sla.priority || 'unknown', Math.round(overdueHours));
    }

    log.info(`Processed ${breached.length} SLA breaches`);
  } catch (error) {
    // SLA service might not have all fields — gracefully skip
    log.warn('SLA breach check skipped', { error: (error as any)?.message });
  }
}
