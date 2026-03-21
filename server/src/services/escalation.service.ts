import { getDb } from '../db/connection';

export function getEscalationRules() {
  const db = getDb();
  return db.prepare('SELECT * FROM escalation_rules ORDER BY priority, hours_without_response').all();
}

export function updateEscalationRule(id: number, hoursWithoutResponse: number, action: string, isActive: boolean) {
  const db = getDb();
  db.prepare('UPDATE escalation_rules SET hours_without_response = ?, action = ?, is_active = ? WHERE id = ?')
    .run(hoursWithoutResponse, action, isActive ? 1 : 0, id);
}

export function createEscalationRule(priority: string, hoursWithoutResponse: number, action: string) {
  const db = getDb();
  return db.prepare('INSERT INTO escalation_rules (priority, hours_without_response, action) VALUES (?, ?, ?)')
    .run(priority, hoursWithoutResponse, action);
}

export function deleteEscalationRule(id: number) {
  const db = getDb();
  db.prepare('DELETE FROM escalation_rules WHERE id = ?').run(id);
}

export interface EscalationAlert {
  ticketId: number;
  ticketNumber: string;
  subject: string;
  priority: string;
  customerName: string;
  hoursOpen: number;
  rulePriority: string;
  ruleHours: number;
  ruleAction: string;
}

export function checkEscalations(): EscalationAlert[] {
  const db = getDb();
  const rules = db.prepare("SELECT * FROM escalation_rules WHERE is_active = 1").all() as any[];
  const openTickets = db.prepare(`
    SELECT t.id, t.ticket_number, t.subject, t.priority, t.created_at, t.status,
           c.name as customer_name
    FROM tickets t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.status NOT IN ('resolved', 'closed')
  `).all() as any[];

  const alerts: EscalationAlert[] = [];
  const now = Date.now();

  for (const ticket of openTickets) {
    const created = new Date(ticket.created_at + 'Z').getTime();
    const hoursOpen = (now - created) / 3600000;

    // Check if ticket has any non-internal admin response
    const hasResponse = db.prepare(
      "SELECT id FROM ticket_responses WHERE ticket_id = ? AND author_role = 'admin' AND is_internal = 0 LIMIT 1"
    ).get(ticket.id);

    if (hasResponse) continue; // Already responded, no escalation needed

    for (const rule of rules) {
      if (rule.priority === ticket.priority && hoursOpen >= rule.hours_without_response) {
        alerts.push({
          ticketId: ticket.id,
          ticketNumber: ticket.ticket_number,
          subject: ticket.subject,
          priority: ticket.priority,
          customerName: ticket.customer_name,
          hoursOpen: Math.round(hoursOpen * 10) / 10,
          rulePriority: rule.priority,
          ruleHours: rule.hours_without_response,
          ruleAction: rule.action,
        });
      }
    }
  }

  return alerts;
}
