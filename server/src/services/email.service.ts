import nodemailer from 'nodemailer';
import { config } from '../config';
import { getSettings } from './settings.service';
import { createLogger } from './logger.service';

const log = createLogger('Email');

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
  const email = s['smtp_from'] || config.smtp.from;
  return `TelcoBridges Ticketing System <${email}>`;
}

// ---------------------------------------------------------------------------
// Markdown-to-HTML formatter (email-safe)
// ---------------------------------------------------------------------------

/**
 * Convert basic markdown-like formatting to email-safe HTML.
 * Handles: **bold**, `code`, numbered lists, paragraph breaks, line breaks.
 */
function formatMessageToHtml(message: string): string {
  return message
    // Escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Bold **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Inline code `text`
    .replace(
      /`([^`]+)`/g,
      '<code style="background:#f1f5f9;color:#1a2332;padding:2px 6px;border-radius:3px;font-family:Consolas,Monaco,\'Courier New\',monospace;font-size:13px">$1</code>',
    )
    // Numbered lists (lines starting with "1. ", "2. ", etc.)
    .replace(
      /^(\d+)\.\s+(.+)$/gm,
      '<table cellpadding="0" cellspacing="0" style="margin:2px 0"><tr><td style="width:28px;vertical-align:top;color:#64748b;font-size:14px;line-height:1.6" valign="top">$1.</td><td style="color:#334155;font-size:14px;line-height:1.6">$2</td></tr></table>',
    )
    // Double newline = paragraph break
    .replace(/\n\n/g, '</p><p style="margin:12px 0;color:#334155;font-size:14px;line-height:1.6">')
    // Single newline = line break
    .replace(/\n/g, '<br>');
}

// ---------------------------------------------------------------------------
// Email template
// ---------------------------------------------------------------------------

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

function emailTemplate(title: string, body: string, ticketNumber?: string): string {
  const logoUrl = `${config.appUrl}/tb-logo.png`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:${FONT_STACK}">
  <!--[if mso]><table width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff">
    <tr>
      <td align="center" style="padding:32px 16px">

        <!-- Main container -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff">

          <!-- Header: Logo + Support -->
          <tr>
            <td style="padding:0 0 16px 0">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle" valign="middle">
                    <img src="${logoUrl}" alt="TelcoBridges" height="48" style="height:48px;width:auto;display:block" />
                  </td>
                  <td align="right" style="vertical-align:middle;color:#205A74;font-size:13px;font-weight:600;letter-spacing:1px;font-family:${FONT_STACK}" valign="middle">
                    Support
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Blue separator line -->
          <tr>
            <td style="padding:0">
              <div style="height:2px;background-color:#0ea5e9;line-height:2px;font-size:2px">&nbsp;</div>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:28px 0 0 0">
              <h1 style="margin:0;color:#1a2332;font-size:20px;font-weight:600;font-family:${FONT_STACK}">${title}</h1>
              ${ticketNumber ? `<p style="margin:6px 0 0 0;color:#64748b;font-size:13px;font-family:${FONT_STACK}">Ticket: ${ticketNumber}</p>` : ''}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 0 32px 0">
              ${body}
            </td>
          </tr>

          <!-- Footer separator -->
          <tr>
            <td style="padding:0">
              <div style="height:1px;background-color:#e2e8f0;line-height:1px;font-size:1px">&nbsp;</div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0 0 0;color:#94a3b8;font-size:12px;line-height:1.5;font-family:${FONT_STACK}">
              TelcoBridges Support &middot; <a href="https://www.telcobridges.com" style="color:#0ea5e9;text-decoration:none">www.telcobridges.com</a> &middot; &copy; 2026 TelcoBridges Inc.
            </td>
          </tr>

        </table>
        <!-- /Main container -->

      </td>
    </tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public email functions
// ---------------------------------------------------------------------------

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const t = await getTransporter();
  if (!t) {
    log.info('SMTP not configured, skipping email', { to });
    return false;
  }
  try {
    await t.sendMail({ from: await getFromAddress(), to, subject, html });
    log.info('Email sent', { to, subject });
    return true;
  } catch (error) {
    log.error('Failed to send email', { to, error: (error as Error).message });
    return false;
  }
}

export function sendTicketCreatedEmail(email: string, ticketNumber: string, subject: string) {
  const body = `
    <p style="margin:0 0 16px 0;color:#334155;font-size:15px;line-height:1.6;font-family:${FONT_STACK}">
      Your support ticket has been created and our team has been notified.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
      <tr>
        <td style="background-color:#f8fafc;padding:16px 20px;border-radius:6px">
          <p style="margin:0 0 4px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-family:${FONT_STACK}">Subject</p>
          <p style="margin:0;color:#1a2332;font-size:15px;font-weight:500;font-family:${FONT_STACK}">${subject}</p>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0 0;color:#475569;font-size:14px;line-height:1.6;font-family:${FONT_STACK}">
      We will review your ticket and respond as soon as possible. You will receive email notifications when there are updates.
    </p>`;

  return sendEmail(
    email,
    `[${ticketNumber}] Ticket Created — ${subject}`,
    emailTemplate('Your Support Ticket Has Been Created', body, ticketNumber),
  );
}

export function sendTicketResponseEmail(email: string, ticketNumber: string, authorName: string, message: string) {
  const formattedMessage = formatMessageToHtml(message);

  const body = `
    <p style="margin:0 0 12px 0;color:#334155;font-size:14px;font-family:${FONT_STACK}">
      <strong>${authorName}</strong> replied:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0">
      <tr>
        <td style="background-color:#f8fafc;border-left:3px solid #0ea5e9;padding:16px 20px">
          <p style="margin:0;color:#334155;font-size:14px;line-height:1.7;font-family:${FONT_STACK}">${formattedMessage}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0;color:#94a3b8;font-size:12px;font-family:${FONT_STACK}">
      You can reply to this ticket through the support portal.
    </p>`;

  return sendEmail(
    email,
    `[${ticketNumber}] New Response — ${authorName}`,
    emailTemplate('New Response on Your Ticket', body, ticketNumber),
  );
}

export function sendEngineerAssignedEmail(
  engineerEmail: string,
  engineerName: string,
  ticketNumber: string,
  subject: string,
  customerName: string,
  customerCompany: string | null,
  createdAt: string,
  priority: string,
  aiAnalyzed: boolean,
  slaResponseHours: number | null,
  slaResolutionHours: number | null,
) {
  const priorityColors: Record<string, { color: string; bg: string }> = {
    critical: { color: '#dc2626', bg: '#fee2e2' },
    high:     { color: '#D39340', bg: '#fef3c7' },
    medium:   { color: '#0ea5e9', bg: '#e0f2fe' },
    low:      { color: '#059669', bg: '#dcfce7' },
  };
  const pc = priorityColors[priority] || { color: '#64748b', bg: '#f1f5f9' };
  const createdDate = new Date(createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const customer = customerCompany ? `${customerName} (${customerCompany})` : customerName;

  const body = `
    <p style="margin:0 0 16px 0;color:#334155;font-size:15px;line-height:1.6;font-family:${FONT_STACK}">
      Hi ${engineerName}, a ticket has been assigned to you.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;background-color:#f8fafc;border-radius:8px">
      <tr>
        <td style="padding:20px">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:6px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-family:${FONT_STACK};width:140px">Customer</td>
              <td style="padding:6px 0;color:#1a2332;font-size:14px;font-weight:500;font-family:${FONT_STACK}">${customer}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-family:${FONT_STACK}">Subject</td>
              <td style="padding:6px 0;color:#1a2332;font-size:14px;font-weight:500;font-family:${FONT_STACK}">${subject}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-family:${FONT_STACK}">Created</td>
              <td style="padding:6px 0;color:#1a2332;font-size:14px;font-family:${FONT_STACK}">${createdDate}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-family:${FONT_STACK}">Priority</td>
              <td style="padding:6px 0">
                <span style="display:inline-block;padding:3px 12px;background-color:${pc.bg};color:${pc.color};font-size:12px;font-weight:600;border-radius:12px;text-transform:capitalize;font-family:${FONT_STACK}">${priority}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-family:${FONT_STACK}">AI Analysis</td>
              <td style="padding:6px 0;color:#1a2332;font-size:14px;font-family:${FONT_STACK}">${aiAnalyzed ? '<span style="color:#22c55e;font-weight:500">Completed</span>' : '<span style="color:#f59e0b;font-weight:500">Not available</span>'}</td>
            </tr>
            ${slaResponseHours !== null ? `
            <tr>
              <td style="padding:6px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-family:${FONT_STACK}">SLA Response</td>
              <td style="padding:6px 0;color:#1a2332;font-size:14px;font-weight:600;font-family:${FONT_STACK}">${slaResponseHours} hours</td>
            </tr>` : ''}
            ${slaResolutionHours !== null ? `
            <tr>
              <td style="padding:6px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-family:${FONT_STACK}">SLA Resolution</td>
              <td style="padding:6px 0;color:#1a2332;font-size:14px;font-weight:600;font-family:${FONT_STACK}">${slaResolutionHours} hours</td>
            </tr>` : ''}
          </table>
        </td>
      </tr>
    </table>
    <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;font-family:${FONT_STACK}">
      Please review the ticket details in the admin panel and respond within the SLA target.
    </p>`;

  return sendEmail(
    engineerEmail,
    `[${ticketNumber}] Assigned to You — ${subject}`,
    emailTemplate('New Ticket Assigned to You', body, ticketNumber),
  );
}

export async function sendTicketStatusEmail(email: string, ticketNumber: string, newStatus: string, ticketId?: number) {
  const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
    new:               { label: 'New',           color: '#0ea5e9', bg: '#e0f2fe' },
    analyzing:         { label: 'Analyzing',     color: '#8b5cf6', bg: '#ede9fe' },
    assigned:          { label: 'Assigned',      color: '#3b82f6', bg: '#dbeafe' },
    in_progress:       { label: 'In Progress',   color: '#f59e0b', bg: '#fef3c7' },
    pending_info:      { label: 'Pending Info',  color: '#f97316', bg: '#ffedd5' },
    escalated_to_jira: { label: 'Escalated',     color: '#ef4444', bg: '#fee2e2' },
    resolved:          { label: 'Resolved',      color: '#22c55e', bg: '#dcfce7' },
    closed:            { label: 'Closed',        color: '#64748b', bg: '#f1f5f9' },
  };

  const s = statusLabels[newStatus] || {
    label: newStatus.replace(/_/g, ' '),
    color: '#64748b',
    bg: '#f1f5f9',
  };

  // Build survey link for resolved tickets
  let surveyHtml = '';
  if (newStatus === 'resolved' && ticketId) {
    const surveyUrl = `${config.appUrl}/my-tickets/${ticketId}`;
    surveyHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0">
      <tr>
        <td align="center">
          <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" style="height:44px;v-text-anchor:middle;width:260px" arcsize="14%" fillcolor="#0ea5e9" stroke="f"><v:textbox><center style="color:#ffffff;font-family:${FONT_STACK};font-size:15px;font-weight:600">Rate Your Experience</center></v:textbox></v:roundrect><![endif]-->
          <!--[if !mso]><!-->
          <a href="${surveyUrl}" target="_blank" style="display:inline-block;padding:12px 32px;background-color:#0ea5e9;color:#ffffff;font-size:15px;font-weight:600;border-radius:8px;text-decoration:none;font-family:${FONT_STACK}">
            Rate Your Experience
          </a>
          <!--<![endif]-->
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:8px 0 0 0">
          <p style="margin:0;color:#94a3b8;font-size:12px;font-family:${FONT_STACK}">Your feedback helps us improve our support.</p>
        </td>
      </tr>
    </table>`;
  }

  const body = `
    <p style="margin:0 0 20px 0;color:#334155;font-size:15px;line-height:1.6;font-family:${FONT_STACK}">
      The status of your ticket has been updated.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0">
      <tr>
        <td align="center" style="padding:16px 0">
          <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" style="height:36px;v-text-anchor:middle;width:160px" arcsize="50%" fillcolor="${s.bg}" stroke="f"><v:textbox><center style="color:${s.color};font-family:${FONT_STACK};font-size:14px;font-weight:600">${s.label}</center></v:textbox></v:roundrect><![endif]-->
          <!--[if !mso]><!-->
          <span style="display:inline-block;padding:8px 24px;background-color:${s.bg};color:${s.color};font-size:14px;font-weight:600;border-radius:24px;letter-spacing:0.3px;font-family:${FONT_STACK}">
            ${s.label}
          </span>
          <!--<![endif]-->
        </td>
      </tr>
    </table>
    ${newStatus === 'resolved' ? `
    <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;font-family:${FONT_STACK}">
      If this issue has been resolved to your satisfaction, no further action is needed.
      The ticket will be automatically closed after a period of inactivity.
      If the issue persists, please reply through the support portal and we will reopen the investigation.
    </p>${surveyHtml}` : ''}
    ${newStatus === 'pending_info' ? `
    <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;font-family:${FONT_STACK}">
      We need additional information from you to continue working on this ticket.
      Please check the latest response in the support portal and provide the requested details.
    </p>` : ''}`;

  return sendEmail(
    email,
    `[${ticketNumber}] Status Updated — ${s.label}`,
    emailTemplate('Ticket Status Updated', body, ticketNumber),
  );
}
