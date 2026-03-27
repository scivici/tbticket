import { query, queryOne, queryAll } from '../db/connection';

export async function getEscalationRules() {
  return await queryAll('SELECT * FROM escalation_rules ORDER BY priority, hours_without_response');
}

export async function updateEscalationRule(id: number, hoursWithoutResponse: number, action: string, isActive: boolean) {
  await query('UPDATE escalation_rules SET hours_without_response = ?, action = ?, is_active = ? WHERE id = ?',
    [hoursWithoutResponse, action, isActive ? 1 : 0, id]);
}

export async function createEscalationRule(priority: string, hoursWithoutResponse: number, action: string) {
  const result = await query('INSERT INTO escalation_rules (priority, hours_without_response, action) VALUES (?, ?, ?) RETURNING id',
    [priority, hoursWithoutResponse, action]);
  return result.rows[0].id;
}

export async function deleteEscalationRule(id: number) {
  await query('DELETE FROM escalation_rules WHERE id = ?', [id]);
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

export async function checkEscalations(): Promise<EscalationAlert[]> {
  const rules = await queryAll<any>("SELECT * FROM escalation_rules WHERE is_active = 1");
  const openTickets = await queryAll<any>(`
    SELECT t.id, t.ticket_number, t.subject, t.priority, t.created_at, t.status,
           c.name as customer_name
    FROM tickets t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.status NOT IN ('resolved', 'closed')
  `);

  const alerts: EscalationAlert[] = [];
  const now = Date.now();

  for (const ticket of openTickets) {
    const created = new Date(ticket.created_at + 'Z').getTime();
    const hoursOpen = (now - created) / 3600000;

    // Check if ticket has any non-internal admin response
    const hasResponse = await queryOne<any>(
      "SELECT id FROM ticket_responses WHERE ticket_id = ? AND author_role = 'admin' AND is_internal = 0 LIMIT 1",
      [ticket.id]
    );

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
