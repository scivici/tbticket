import { config } from '../config';
import { getSetting } from './settings.service';

export async function sendSlackNotification(text: string): Promise<boolean> {
  const url = await getSetting('slack_webhook_url') || config.slackWebhookUrl;
  if (!url) return false;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    console.log('[Slack] Notification sent');
    return true;
  } catch (error) {
    console.error('[Slack] Failed:', error);
    return false;
  }
}

export async function sendTeamsNotification(title: string, text: string): Promise<boolean> {
  const url = await getSetting('teams_webhook_url') || config.teamsWebhookUrl;
  if (!url) return false;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        themeColor: "205A74",
        summary: title,
        sections: [{
          activityTitle: title,
          text: text,
        }],
      }),
    });
    console.log('[Teams] Notification sent');
    return true;
  } catch (error) {
    console.error('[Teams] Failed:', error);
    return false;
  }
}

export function notifyNewTicket(ticketNumber: string, productName: string, subject: string, customerName: string) {
  const msg = `🎫 New ticket *${ticketNumber}*\nProduct: ${productName}\nSubject: ${subject}\nCustomer: ${customerName}`;
  sendSlackNotification(msg);
  sendTeamsNotification(`New Ticket: ${ticketNumber}`, `Product: ${productName}<br>Subject: ${subject}<br>Customer: ${customerName}`);
}

export function notifyTicketAssigned(ticketNumber: string, engineerName: string) {
  const msg = `✅ Ticket *${ticketNumber}* assigned to ${engineerName}`;
  sendSlackNotification(msg);
  sendTeamsNotification(`Ticket Assigned: ${ticketNumber}`, `Assigned to: ${engineerName}`);
}

export function notifyCriticalTicket(ticketNumber: string, subject: string, customerName: string) {
  const msg = `🚨 CRITICAL ticket *${ticketNumber}*\nSubject: ${subject}\nCustomer: ${customerName}`;
  sendSlackNotification(msg);
  sendTeamsNotification(`⚠️ Critical Ticket: ${ticketNumber}`, `Subject: ${subject}<br>Customer: ${customerName}`);
}
