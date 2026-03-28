// npm install imapflow
// Email-to-Ticket service: polls an IMAP inbox and creates tickets from incoming emails.

import { ImapFlow } from 'imapflow';
import { queryOne, queryAll, query } from '../db/connection';
import { getSetting } from './settings.service';

let pollingTimer: ReturnType<typeof setInterval> | null = null;

export async function startEmailReceiver() {
  const enabled = await getSetting('email_to_ticket_enabled');
  if (enabled !== 'true') {
    console.log('[EmailReceiver] Email-to-ticket is disabled');
    return;
  }

  const intervalMinutes = parseInt((await getSetting('email_to_ticket_poll_interval')) || '5');
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[EmailReceiver] Starting email poller (every ${intervalMinutes} minutes)`);

  // Run once after a short delay, then on interval
  setTimeout(pollInbox, 15_000);
  pollingTimer = setInterval(pollInbox, intervalMs);
}

export function stopEmailReceiver() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

async function getImapConfig() {
  const host = await getSetting('imap_host');
  const port = parseInt((await getSetting('imap_port')) || '993');
  const user = await getSetting('imap_user');
  const pass = await getSetting('imap_pass');
  const tls = (await getSetting('imap_tls')) !== 'false';

  if (!host || !user || !pass) {
    return null;
  }

  return { host, port, auth: { user, pass }, secure: tls };
}

async function pollInbox() {
  try {
    const enabled = await getSetting('email_to_ticket_enabled');
    if (enabled !== 'true') return;

    const config = await getImapConfig();
    if (!config) {
      console.warn('[EmailReceiver] IMAP not configured (missing host/user/pass)');
      return;
    }

    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      logger: false,
    });

    await client.connect();

    const lock = await client.getMailboxLock('INBOX');
    try {
      // Fetch unseen messages
      const messages = client.fetch({ seen: false }, {
        envelope: true,
        source: true,
        uid: true,
      });

      for await (const msg of messages) {
        try {
          await processEmail(msg);
          // Mark as seen
          await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true });
        } catch (err) {
          console.error(`[EmailReceiver] Error processing email UID ${msg.uid}:`, err);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (error) {
    console.error('[EmailReceiver] Poll error:', error);
  }
}

async function processEmail(msg: any) {
  const envelope = msg.envelope;
  if (!envelope) return;

  const senderAddress = envelope.from?.[0]?.address;
  const senderName = envelope.from?.[0]?.name || senderAddress || 'Unknown';
  const subject = envelope.subject || '(No Subject)';

  if (!senderAddress) {
    console.warn('[EmailReceiver] Skipping email with no sender address');
    return;
  }

  // Extract plain text body from source
  const source = msg.source?.toString() || '';
  const body = extractPlainText(source);

  // Check if sender exists as a customer
  let customer = await queryOne<any>(
    'SELECT id, email, name FROM customers WHERE email = ?',
    [senderAddress.toLowerCase()]
  );

  // If not found, create an anonymous customer
  if (!customer) {
    const result = await query(
      `INSERT INTO customers (email, name, is_anonymous) VALUES (?, ?, TRUE) RETURNING id, email, name`,
      [senderAddress.toLowerCase(), senderName]
    );
    customer = result.rows[0];
    console.log(`[EmailReceiver] Created anonymous customer: ${senderAddress}`);
  }

  // Check if subject contains a ticket number (TBT-xxx or TBT-xxx-xxx pattern)
  const ticketNumberMatch = subject.match(/TBT-[A-Z0-9]+-[A-Z0-9]+/i) || subject.match(/TBT-\d+/i);

  if (ticketNumberMatch) {
    // Add as response to existing ticket
    const ticketNumber = ticketNumberMatch[0].toUpperCase();
    const ticket = await queryOne<any>(
      'SELECT id FROM tickets WHERE ticket_number = ?',
      [ticketNumber]
    );

    if (ticket) {
      await query(
        `INSERT INTO ticket_responses (ticket_id, author_id, author_name, author_role, message)
         VALUES (?, ?, ?, 'customer', ?)`,
        [ticket.id, customer.id, customer.name, body || subject]
      );
      await query(
        "UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [ticket.id]
      );
      console.log(`[EmailReceiver] Added response to ticket ${ticketNumber} from ${senderAddress}`);
      return;
    }
  }

  // Create a new ticket
  const defaultProductId = parseInt((await getSetting('email_to_ticket_default_product_id')) || '1');
  const defaultCategoryId = parseInt((await getSetting('email_to_ticket_default_category_id')) || '1');

  // Verify defaults exist, fallback to first available
  let productId = defaultProductId;
  let categoryId = defaultCategoryId;

  const product = await queryOne<any>('SELECT id FROM products WHERE id = ?', [productId]);
  if (!product) {
    const firstProduct = await queryOne<any>('SELECT id FROM products ORDER BY id LIMIT 1');
    productId = firstProduct?.id || 1;
  }

  const category = await queryOne<any>('SELECT id FROM product_categories WHERE id = ? AND product_id = ?', [categoryId, productId]);
  if (!category) {
    const firstCategory = await queryOne<any>('SELECT id FROM product_categories WHERE product_id = ? ORDER BY id LIMIT 1', [productId]);
    categoryId = firstCategory?.id || 1;
  }

  // Generate ticket number (same format as ticket.service.ts)
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const ticketNumber = `TBT-${timestamp}-${random}`;

  await query(
    `INSERT INTO tickets (ticket_number, customer_id, product_id, category_id, subject, description, status, priority)
     VALUES (?, ?, ?, ?, ?, ?, 'new', 'medium')`,
    [ticketNumber, customer.id, productId, categoryId, subject, body || '(Email body empty)']
  );

  console.log(`[EmailReceiver] Created ticket ${ticketNumber} from ${senderAddress}: "${subject}"`);
}

/**
 * Simple plain text extraction from raw email source.
 * Looks for text/plain content, falls back to stripping HTML tags.
 */
function extractPlainText(source: string): string {
  // Try to find text/plain part
  const plainMatch = source.match(/Content-Type:\s*text\/plain[^]*?\r?\n\r?\n([^]*?)(?=\r?\n--|\r?\n\.\r?\n|$)/i);
  if (plainMatch) {
    return plainMatch[1].trim().substring(0, 10000);
  }

  // Try to find text/html and strip tags
  const htmlMatch = source.match(/Content-Type:\s*text\/html[^]*?\r?\n\r?\n([^]*?)(?=\r?\n--|\r?\n\.\r?\n|$)/i);
  if (htmlMatch) {
    return htmlMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 10000);
  }

  // Fallback: try to get body after headers
  const bodyStart = source.indexOf('\r\n\r\n');
  if (bodyStart > 0) {
    return source.substring(bodyStart + 4).trim().substring(0, 10000);
  }

  return '';
}
