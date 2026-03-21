import { config } from '../config';

export async function sendSlackNotification(text: string): Promise<boolean> {
  if (!config.slackWebhookUrl) return false;
  try {
    await fetch(config.slackWebhookUrl, {
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
  if (!config.teamsWebhookUrl) return false;
  try {
    await fetch(config.teamsWebhookUrl, {
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
