import nodemailer from 'nodemailer';
import { config } from '../config';
import { getSettings } from './settings.service';

let transporter: nodemailer.Transporter | null = null;

export function resetTransporter() { transporter = null; }

async function getTransporter() {
  if (!transporter) {
    const s = await getSettings('smtp_');
    const host = s['smtp_host'] || config.smtp.host;
    const port = parseInt(s['smtp_port'] || String(config.smtp.port));
    const user = s['smtp_user'] || config.smtp.user;
    const pass = s['smtp_pass'] || config.smtp.pass;

    if (!host) return null;

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: (s['smtp_secure'] || String(config.smtp.secure)) === 'true',
      auth: user ? { user, pass } : undefined,
    });
  }
  return transporter;
}

async function getFromAddress(): Promise<string> {
  const s = await getSettings('smtp_');
  return s['smtp_from'] || config.smtp.from;
}

/**
 * Convert basic markdown-like formatting to HTML for email
 * Handles: **bold**, numbered lists, backticks, newlines
 */
function formatMessageToHtml(message: string): string {
  return message
    // Escape HTML
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Bold **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Inline code `text`
    .replace(/`([^`]+)`/g, '<code style="background:#e8e8e8;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:13px">$1</code>')
    // Numbered lists (lines starting with "1. ", "2. ", etc.)
    .replace(/^(\d+)\.\s+(.+)$/gm, '<div style="padding:2px 0 2px 20px">$1. $2</div>')
    // Double newline = paragraph break
    .replace(/\n\n/g, '</p><p style="margin:12px 0;line-height:1.6">')
    // Single newline = line break
    .replace(/\n/g, '<br>');
}

/**
 * Wrap content in the TelcoBridges branded email template
 */
function emailTemplate(title: string, body: string, ticketNumber?: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:20px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- Header -->
        <tr><td style="background:#1a2332;padding:24px 32px;border-radius:12px 12px 0 0">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <img src="https://www.telcobridges.com/hubfs/TB%20Logo%20-%20Full%20White.svg" alt="TelcoBridges" height="32" style="height:32px;display:block" />
              </td>
              <td align="right" style="color:#7eb8d0;font-size:12px;font-weight:500;letter-spacing:0.5px">
                SUPPORT
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Title Bar -->
        <tr><td style="background:#205A74;padding:16px 32px">
          <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600">${title}</h1>
          ${ticketNumber ? `<p style="margin:6px 0 0;color:#a8d4e6;font-size:13px">Ticket: ${ticketNumber}</p>` : ''}
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;border-radius:0 0 12px 12px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#64748b;font-size:12px;line-height:1.5">
                <strong style="color:#475569">TelcoBridges Support</strong><br>
                <a href="https://www.telcobridges.com" style="color:#0ea5e9;text-decoration:none">www.telcobridges.com</a>
              </td>
              <td align="right" style="color:#94a3b8;font-size:11px">
                &copy; ${new Date().getFullYear()} TelcoBridges Inc.
              </td>
            </tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const t = await getTransporter();
  if (!t) {
    console.log('[Email] SMTP not configured, skipping email to', to);
    return false;
  }
  try {
    await t.sendMail({ from: await getFromAddress(), to, subject, html });
    console.log('[Email] Sent to', to, ':', subject);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    return false;
  }
}

export function sendTicketCreatedEmail(email: string, ticketNumber: string, subject: string) {
  const body = `
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6">
      Your support ticket has been created and our team has been notified.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:8px;margin:16px 0">
      <tr>
        <td style="padding:16px 20px">
          <p style="margin:0 0 8px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Subject</p>
          <p style="margin:0;color:#1e293b;font-size:15px;font-weight:500">${subject}</p>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0;color:#475569;font-size:14px;line-height:1.6">
      We will review your ticket and respond as soon as possible. You will receive email notifications when there are updates.
    </p>`;

  return sendEmail(email, `[${ticketNumber}] Ticket Created — ${subject}`,
    emailTemplate('Your Support Ticket Has Been Created', body, ticketNumber));
}

export function sendTicketResponseEmail(email: string, ticketNumber: string, authorName: string, message: string) {
  const formattedMessage = formatMessageToHtml(message);
  const body = `
    <p style="margin:0 0 4px;color:#64748b;font-size:13px">
      <strong style="color:#334155">${authorName}</strong> replied:
    </p>
    <div style="background:#f8fafc;border-left:4px solid #0ea5e9;padding:16px 20px;border-radius:0 8px 8px 0;margin:12px 0">
      <p style="margin:0;color:#334155;font-size:14px;line-height:1.7">${formattedMessage}</p>
    </div>
    <p style="margin:16px 0 0;color:#94a3b8;font-size:12px">
      You can reply to this ticket through the support portal.
    </p>`;

  return sendEmail(email, `[${ticketNumber}] New Response — ${authorName}`,
    emailTemplate('New Response on Your Ticket', body, ticketNumber));
}

export function sendTicketStatusEmail(email: string, ticketNumber: string, newStatus: string) {
  const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
    new: { label: 'New', color: '#0ea5e9', bg: '#e0f2fe' },
    analyzing: { label: 'Analyzing', color: '#8b5cf6', bg: '#ede9fe' },
    assigned: { label: 'Assigned', color: '#3b82f6', bg: '#dbeafe' },
    in_progress: { label: 'In Progress', color: '#f59e0b', bg: '#fef3c7' },
    pending_info: { label: 'Pending Info', color: '#f97316', bg: '#ffedd5' },
    escalated_to_jira: { label: 'Escalated', color: '#ef4444', bg: '#fee2e2' },
    resolved: { label: 'Resolved', color: '#22c55e', bg: '#dcfce7' },
    closed: { label: 'Closed', color: '#64748b', bg: '#f1f5f9' },
  };
  const s = statusLabels[newStatus] || { label: newStatus.replace(/_/g, ' '), color: '#64748b', bg: '#f1f5f9' };

  const body = `
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6">
      The status of your ticket has been updated.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">
      <tr>
        <td align="center" style="padding:20px">
          <span style="display:inline-block;padding:8px 24px;background:${s.bg};color:${s.color};font-size:16px;font-weight:600;border-radius:24px;letter-spacing:0.3px">
            ${s.label}
          </span>
        </td>
      </tr>
    </table>
    ${newStatus === 'resolved' ? `
    <p style="margin:16px 0 0;color:#475569;font-size:14px;line-height:1.6">
      If this issue has been resolved to your satisfaction, no further action is needed. The ticket will be automatically closed after a period of inactivity.
      If the issue persists, please reply through the support portal and we will reopen the investigation.
    </p>` : ''}
    ${newStatus === 'pending_info' ? `
    <p style="margin:16px 0 0;color:#475569;font-size:14px;line-height:1.6">
      We need additional information from you to continue working on this ticket. Please check the latest response in the support portal and provide the requested details.
    </p>` : ''}`;

  return sendEmail(email, `[${ticketNumber}] Status Updated — ${s.label}`,
    emailTemplate('Ticket Status Updated', body, ticketNumber));
}
