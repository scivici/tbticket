import nodemailer from 'nodemailer';
import { config } from '../config';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter && config.smtp.host) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    console.log('[Email] SMTP not configured, skipping email to', to);
    return false;
  }
  try {
    await t.sendMail({ from: config.smtp.from, to, subject, html });
    console.log('[Email] Sent to', to, ':', subject);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    return false;
  }
}

export function sendTicketCreatedEmail(email: string, ticketNumber: string, subject: string) {
  return sendEmail(email, `Ticket Created: ${ticketNumber}`,
    `<div style="font-family:sans-serif;max-width:600px">
      <h2 style="color:#205A74">Your support ticket has been created</h2>
      <p>Ticket Number: <strong>${ticketNumber}</strong></p>
      <p>Subject: ${subject}</p>
      <p>Our team will review your ticket and get back to you shortly.</p>
      <p style="color:#666;font-size:12px">TelcoBridges Support</p>
    </div>`);
}

export function sendTicketResponseEmail(email: string, ticketNumber: string, authorName: string, message: string) {
  return sendEmail(email, `New Response on ${ticketNumber}`,
    `<div style="font-family:sans-serif;max-width:600px">
      <h2 style="color:#205A74">New response on your ticket</h2>
      <p>Ticket: <strong>${ticketNumber}</strong></p>
      <p><strong>${authorName}</strong> replied:</p>
      <div style="background:#f5f5f5;padding:12px;border-radius:8px;margin:12px 0">${message}</div>
      <p style="color:#666;font-size:12px">TelcoBridges Support</p>
    </div>`);
}

export function sendTicketStatusEmail(email: string, ticketNumber: string, newStatus: string) {
  return sendEmail(email, `Ticket ${ticketNumber} - Status Updated`,
    `<div style="font-family:sans-serif;max-width:600px">
      <h2 style="color:#205A74">Ticket status updated</h2>
      <p>Ticket: <strong>${ticketNumber}</strong></p>
      <p>New Status: <strong>${newStatus.replace('_', ' ')}</strong></p>
      <p style="color:#666;font-size:12px">TelcoBridges Support</p>
    </div>`);
}
