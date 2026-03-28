import { config } from '../config';
import { getSetting } from './settings.service';
import { createLogger } from './logger.service';

const log = createLogger('Webhook');

export async function sendSlackNotification(text: string): Promise<boolean> {
  const url = await getSetting('slack_webhook_url') || config.slackWebhookUrl;
  if (!url) return false;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    log.info('Slack notification sent');
    return true;
  } catch (error) {
    log.error('Slack notification failed', { error: (error as Error).message });
    return false;
  }
}

/**
 * Send a Teams notification using Adaptive Card format.
 * Falls back gracefully if the webhook rejects the payload.
 */
export async function sendTeamsNotification(
  title: string,
  text: string,
  ticketNumber?: string,
  themeColor: string = '205A74',
): Promise<boolean> {
  const url = await getSetting('teams_webhook_url') || config.teamsWebhookUrl;
  if (!url) return false;

  const viewAction = ticketNumber
    ? [{
        type: 'Action.OpenUrl',
        title: 'View Ticket',
        url: `${config.appUrl}/tickets/${ticketNumber}`,
      }]
    : [];

  const adaptiveCard = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'Container',
              style: 'emphasis',
              items: [
                {
                  type: 'TextBlock',
                  text: title,
                  weight: 'Bolder',
                  size: 'Medium',
                  wrap: true,
                  color: 'Accent',
                },
              ],
            },
            {
              type: 'TextBlock',
              text: text,
              wrap: true,
              spacing: 'Medium',
            },
            ...(ticketNumber
              ? [
                  {
                    type: 'FactSet',
                    facts: [{ title: 'Ticket', value: ticketNumber }],
                  },
                ]
              : []),
          ],
          actions: viewAction,
        },
      },
    ],
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adaptiveCard),
    });
    log.info('Teams notification sent', { title });
    return true;
  } catch (error) {
    log.error('Teams notification failed', { error: (error as Error).message });
    return false;
  }
}

// ---------------------------------------------------------------------------
// High-level notification helpers
// ---------------------------------------------------------------------------

export function notifyNewTicket(ticketNumber: string, productName: string, subject: string, customerName: string) {
  const msg = `🎫 New ticket *${ticketNumber}*\nProduct: ${productName}\nSubject: ${subject}\nCustomer: ${customerName}`;
  sendSlackNotification(msg);
  sendTeamsNotification(
    `New Ticket: ${ticketNumber}`,
    `**Product:** ${productName}  \n**Subject:** ${subject}  \n**Customer:** ${customerName}`,
    ticketNumber,
  );
}

export function notifyTicketAssigned(ticketNumber: string, engineerName: string) {
  const msg = `✅ Ticket *${ticketNumber}* assigned to ${engineerName}`;
  sendSlackNotification(msg);
  sendTeamsNotification(
    `Ticket Assigned: ${ticketNumber}`,
    `Assigned to **${engineerName}**`,
    ticketNumber,
  );
}

export function notifyCriticalTicket(ticketNumber: string, subject: string, customerName: string) {
  const msg = `🚨 CRITICAL ticket *${ticketNumber}*\nSubject: ${subject}\nCustomer: ${customerName}`;
  sendSlackNotification(msg);
  sendTeamsNotification(
    `⚠️ Critical Ticket: ${ticketNumber}`,
    `**Subject:** ${subject}  \n**Customer:** ${customerName}`,
    ticketNumber,
    'FF0000',
  );
}

export function notifyTicketStatusChanged(ticketNumber: string, oldStatus: string, newStatus: string, engineerName: string) {
  const oldLabel = oldStatus.replace(/_/g, ' ');
  const newLabel = newStatus.replace(/_/g, ' ');
  const msg = `🔄 Ticket *${ticketNumber}* status changed: ${oldLabel} → ${newLabel} (by ${engineerName})`;
  sendSlackNotification(msg);
  sendTeamsNotification(
    `Status Changed: ${ticketNumber}`,
    `**${oldLabel}** → **${newLabel}**  \nChanged by: **${engineerName}**`,
    ticketNumber,
  );
}

export function notifySlaBreach(ticketNumber: string, subject: string, priority: string, overdueHours: number) {
  const msg = `🚨 SLA BREACH: Ticket *${ticketNumber}*\nSubject: ${subject}\nPriority: ${priority}\nOverdue: ${overdueHours}h`;
  sendSlackNotification(msg);
  sendTeamsNotification(
    `🚨 SLA Breach: ${ticketNumber}`,
    `**Subject:** ${subject}  \n**Priority:** ${priority}  \n**Overdue:** ${overdueHours} hours`,
    ticketNumber,
    'FF0000',
  );
}

export function notifyAiAnalysisComplete(ticketNumber: string, classification: string, confidence: number, engineerName: string) {
  const pct = Math.round(confidence * 100);
  const assignedTo = engineerName || 'Pending manual review';
  const msg = `🤖 AI analysis complete for *${ticketNumber}*\nClassification: ${classification}\nConfidence: ${pct}%\nAssigned to: ${assignedTo}`;
  sendSlackNotification(msg);
  sendTeamsNotification(
    `AI Analysis Complete: ${ticketNumber}`,
    `**Classification:** ${classification}  \n**Confidence:** ${pct}%  \n**Assigned to:** ${assignedTo}`,
    ticketNumber,
  );
}
