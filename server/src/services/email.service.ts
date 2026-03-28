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
