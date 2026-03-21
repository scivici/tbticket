import { getDb } from '../db/connection';

export interface RecurringPattern {
  customerId: number;
  customerName: string;
  customerEmail: string;
  company: string | null;
  productId: number;
  productName: string;
  categoryId: number;
  categoryName: string;
  ticketCount: number;
  lastTicketAt: string;
  ticketNumbers: string[];
}

export function detectRecurringTickets(minCount: number = 2, daysBack: number = 90): RecurringPattern[] {
  const db = getDb();

  const patterns = db.prepare(`
    SELECT
      c.id as customer_id, c.name as customer_name, c.email as customer_email, c.company,
      p.id as product_id, p.name as product_name,
      pc.id as category_id, pc.name as category_name,
      COUNT(*) as ticket_count,
      MAX(t.created_at) as last_ticket_at,
      GROUP_CONCAT(t.ticket_number, ',') as ticket_numbers
    FROM tickets t
    JOIN customers c ON t.customer_id = c.id
    JOIN products p ON t.product_id = p.id
    JOIN product_categories pc ON t.category_id = pc.id
    WHERE t.created_at >= date('now', '-' || ? || ' days')
    GROUP BY c.id, p.id, pc.id
    HAVING COUNT(*) >= ?
    ORDER BY ticket_count DESC
  `).all(daysBack, minCount) as any[];

  return patterns.map(p => ({
    customerId: p.customer_id,
    customerName: p.customer_name,
    customerEmail: p.customer_email,
    company: p.company,
    productId: p.product_id,
    productName: p.product_name,
    categoryId: p.category_id,
    categoryName: p.category_name,
    ticketCount: p.ticket_count,
    lastTicketAt: p.last_ticket_at,
    ticketNumbers: p.ticket_numbers ? p.ticket_numbers.split(',') : [],
  }));
}
