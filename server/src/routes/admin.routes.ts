import { Router, Response } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate, requireAdmin } from '../middleware/auth';
import * as slaService from '../services/sla.service';
import * as escalationService from '../services/escalation.service';
import * as recurringService from '../services/recurring.service';
import { AuthenticatedRequest } from '../types';
import { getDb } from '../db/connection';
import * as notificationService from '../services/notification.service';
import * as emailService from '../services/email.service';

const router = Router();

router.get('/dashboard', authenticate, requireAdmin, adminController.getDashboardStats);
router.get('/customers', authenticate, requireAdmin, adminController.getCustomers);

// Customer profile management
router.get('/customers/:id', authenticate, requireAdmin, (req: any, res: Response) => {
  const db = getDb();
  const customer = db.prepare(`
    SELECT id, email, name, company, role, is_anonymous, company_ticket_visibility,
           environment_notes, external_links, professional_service_hours, created_at, updated_at
    FROM customers WHERE id = ?
  `).get(req.params.id) as any;
  if (!customer) { res.status(404).json({ error: 'Customer not found' }); return; }
  customer.externalLinks = customer.external_links ? JSON.parse(customer.external_links) : [];
  res.json(customer);
});

router.patch('/customers/:id', authenticate, requireAdmin, (req: any, res: Response) => {
  const db = getDb();
  const { companyTicketVisibility, environmentNotes, externalLinks, professionalServiceHours } = req.body;
  const updates: string[] = ["updated_at = datetime('now')"];
  const params: any[] = [];

  if (companyTicketVisibility !== undefined) {
    updates.push('company_ticket_visibility = ?');
    params.push(companyTicketVisibility ? 1 : 0);
  }
  if (environmentNotes !== undefined) {
    updates.push('environment_notes = ?');
    params.push(environmentNotes);
  }
  if (externalLinks !== undefined) {
    updates.push('external_links = ?');
    params.push(JSON.stringify(externalLinks));
  }
  if (professionalServiceHours !== undefined) {
    updates.push('professional_service_hours = ?');
    params.push(professionalServiceHours);
  }

  params.push(req.params.id);
  db.prepare(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ message: 'Customer updated' });
});

router.get('/sla-policies', authenticate, requireAdmin, (_req: any, res: Response) => {
  res.json(slaService.getAllSlaPolicies());
});

router.patch('/sla-policies/:priority', authenticate, requireAdmin, (req: any, res: Response) => {
  const { responseTimeHours, resolutionTimeHours } = req.body;
  slaService.updateSlaPolicy(req.params.priority, responseTimeHours, resolutionTimeHours);
  res.json({ message: 'SLA policy updated' });
});

router.get('/sla-breached', authenticate, requireAdmin, (_req: any, res: Response) => {
  res.json(slaService.getBreachedTickets());
});

router.get('/escalation-rules', authenticate, requireAdmin, (_req: any, res: Response) => {
  res.json(escalationService.getEscalationRules());
});

router.post('/escalation-rules', authenticate, requireAdmin, (req: any, res: Response) => {
  const { priority, hoursWithoutResponse, action } = req.body;
  const result = escalationService.createEscalationRule(priority, hoursWithoutResponse, action);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.patch('/escalation-rules/:id', authenticate, requireAdmin, (req: any, res: Response) => {
  const { hoursWithoutResponse, action, isActive } = req.body;
  escalationService.updateEscalationRule(parseInt(req.params.id), hoursWithoutResponse, action, isActive);
  res.json({ message: 'Rule updated' });
});

router.delete('/escalation-rules/:id', authenticate, requireAdmin, (req: any, res: Response) => {
  escalationService.deleteEscalationRule(parseInt(req.params.id));
  res.json({ message: 'Rule deleted' });
});

router.get('/escalation-alerts', authenticate, requireAdmin, (_req: any, res: Response) => {
  res.json(escalationService.checkEscalations());
});

// Knowledge Base
router.get('/knowledge-base', authenticate, requireAdmin, (req: any, res: Response) => {
  const db = getDb();
  const articles = db.prepare(`
    SELECT kb.*, p.name as product_name, pc.name as category_name
    FROM knowledge_base kb
    LEFT JOIN products p ON kb.product_id = p.id
    LEFT JOIN product_categories pc ON kb.category_id = pc.id
    ORDER BY kb.created_at DESC
  `).all();
  res.json(articles);
});

router.delete('/knowledge-base/:id', authenticate, requireAdmin, (req: any, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM knowledge_base WHERE id = ?').run(req.params.id);
  res.json({ message: 'Article deleted' });
});

// Time tracking reports
router.get('/time-report', authenticate, requireAdmin, (req: any, res: Response) => {
  const db = getDb();
  const fromDate = req.query.fromDate as string || '';
  const toDate = req.query.toDate as string || '';

  let dateFilter = '';
  const params: any[] = [];
  if (fromDate) { dateFilter += ' AND te.date >= ?'; params.push(fromDate); }
  if (toDate) { dateFilter += ' AND te.date <= ?'; params.push(toDate); }

  // Per-customer summary
  const customerReport = db.prepare(`
    SELECT c.name as customer_name, c.company,
           SUM(te.hours) as total_hours,
           SUM(CASE WHEN te.is_chargeable = 1 THEN te.hours ELSE 0 END) as chargeable_hours,
           SUM(CASE WHEN te.is_chargeable = 0 THEN te.hours ELSE 0 END) as non_chargeable_hours,
           COUNT(DISTINCT te.ticket_id) as ticket_count
    FROM time_entries te
    JOIN tickets t ON te.ticket_id = t.id
    JOIN customers c ON t.customer_id = c.id
    WHERE 1=1 ${dateFilter}
    GROUP BY c.id
    ORDER BY total_hours DESC
  `).all(...params);

  // Per-engineer summary
  const engineerReport = db.prepare(`
    SELECT COALESCE(e.name, te.author_name) as engineer_name,
           SUM(te.hours) as total_hours,
           COUNT(DISTINCT te.ticket_id) as ticket_count
    FROM time_entries te
    LEFT JOIN engineers e ON te.engineer_id = e.id
    WHERE 1=1 ${dateFilter}
    GROUP BY COALESCE(e.id, te.author_id)
    ORDER BY total_hours DESC
  `).all(...params);

  // Overall stats
  const overall = db.prepare(`
    SELECT SUM(hours) as total_hours,
           SUM(CASE WHEN is_chargeable = 1 THEN hours ELSE 0 END) as chargeable_hours,
           COUNT(*) as entry_count,
           COUNT(DISTINCT ticket_id) as ticket_count
    FROM time_entries te
    WHERE 1=1 ${dateFilter}
  `).get(...params) as any;

  res.json({ customerReport, engineerReport, overall: overall || {} });
});

// Professional service hours remaining per customer
router.get('/ps-hours', authenticate, requireAdmin, (_req: any, res: Response) => {
  const db = getDb();
  const report = db.prepare(`
    SELECT c.id, c.name, c.company, c.email,
           COALESCE(c.professional_service_hours, 0) as allocated_hours,
           COALESCE((SELECT SUM(te.hours) FROM time_entries te JOIN tickets t ON te.ticket_id = t.id WHERE t.customer_id = c.id AND te.is_chargeable = 1), 0) as used_hours
    FROM customers c
    WHERE c.role = 'customer' AND c.is_anonymous = 0
    ORDER BY c.name
  `).all() as any[];

  res.json(report.map((r: any) => ({
    ...r,
    remaining_hours: Math.max(0, r.allocated_hours - r.used_hours),
  })));
});

// SLA compliance report
router.get('/sla-compliance', authenticate, requireAdmin, (req: any, res: Response) => {
  const db = getDb();
  const fromDate = req.query.fromDate as string || '';
  const toDate = req.query.toDate as string || '';

  let dateFilter = '';
  const params: any[] = [];
  if (fromDate) { dateFilter += " AND t.created_at >= ?"; params.push(fromDate); }
  if (toDate) { dateFilter += " AND t.created_at <= ?"; params.push(toDate); }

  // Get all tickets with SLA data
  const tickets = db.prepare(`
    SELECT t.id, t.ticket_number, t.subject, t.priority, t.status,
           t.created_at, t.resolved_at,
           p.name as product_name,
           c.name as customer_name, c.company,
           e.name as engineer_name,
           sp.response_time_hours, sp.resolution_time_hours,
           (SELECT MIN(tr.created_at) FROM ticket_responses tr WHERE tr.ticket_id = t.id AND tr.author_role = 'admin' AND tr.is_internal = 0) as first_response_at
    FROM tickets t
    JOIN products p ON t.product_id = p.id
    JOIN customers c ON t.customer_id = c.id
    LEFT JOIN engineers e ON t.assigned_engineer_id = e.id
    LEFT JOIN sla_policies sp ON sp.priority = t.priority
    WHERE 1=1 ${dateFilter}
    ORDER BY t.created_at DESC
  `).all(...params) as any[];

  let totalTickets = 0;
  let responseOnTime = 0;
  let responseBreach = 0;
  let resolutionOnTime = 0;
  let resolutionBreach = 0;
  const byPriority: Record<string, { total: number; responseBreached: number; resolutionBreached: number }> = {};

  for (const t of tickets) {
    if (!t.response_time_hours) continue;
    totalTickets++;

    const created = new Date(t.created_at + 'Z').getTime();
    const respDeadline = created + t.response_time_hours * 3600000;
    const resolDeadline = created + t.resolution_time_hours * 3600000;

    const firstResp = t.first_response_at ? new Date(t.first_response_at + 'Z').getTime() : null;
    const resolved = t.resolved_at ? new Date(t.resolved_at + 'Z').getTime() : null;

    const respBreached = firstResp ? firstResp > respDeadline : Date.now() > respDeadline;
    const resolBreached = resolved ? resolved > resolDeadline : (t.status !== 'resolved' && t.status !== 'closed' && Date.now() > resolDeadline);

    if (respBreached) responseBreach++; else responseOnTime++;
    if (resolBreached) resolutionBreach++; else resolutionOnTime++;

    if (!byPriority[t.priority]) byPriority[t.priority] = { total: 0, responseBreached: 0, resolutionBreached: 0 };
    byPriority[t.priority].total++;
    if (respBreached) byPriority[t.priority].responseBreached++;
    if (resolBreached) byPriority[t.priority].resolutionBreached++;
  }

  res.json({
    totalTickets,
    responseCompliance: totalTickets > 0 ? Math.round((responseOnTime / totalTickets) * 100) : 100,
    resolutionCompliance: totalTickets > 0 ? Math.round((resolutionOnTime / totalTickets) * 100) : 100,
    responseOnTime, responseBreach,
    resolutionOnTime, resolutionBreach,
    byPriority,
  });
});

// Version update notification to customers
router.post('/notify-version-update', authenticate, requireAdmin, (req: any, res: Response) => {
  const { productId, version, releaseNotes } = req.body;
  if (!productId || !version) { res.status(400).json({ error: 'productId and version are required' }); return; }

  const db = getDb();
  const product = db.prepare('SELECT name FROM products WHERE id = ?').get(productId) as any;
  if (!product) { res.status(404).json({ error: 'Product not found' }); return; }

  // Find all customers who have tickets for this product
  const customers = db.prepare(`
    SELECT DISTINCT c.id, c.email, c.name
    FROM customers c
    JOIN tickets t ON t.customer_id = c.id
    WHERE t.product_id = ? AND c.is_anonymous = 0
  `).all(productId) as any[];

  let notified = 0;
  for (const customer of customers) {
    notificationService.createNotification(
      customer.id, 0, 'status_change',
      `New ${product.name} version: ${version}`,
      releaseNotes ? `${product.name} ${version} is now available.\n\n${releaseNotes}` : `${product.name} ${version} is now available.`
    );
    emailService.sendTicketResponseEmail(
      customer.email, `${product.name} Update`, 'TelcoBridges',
      `A new version of ${product.name} is available: ${version}.\n\n${releaseNotes || 'Please check our portal for details.'}`
    ).catch(() => {});
    notified++;
  }

  res.json({ message: `Version update notification sent to ${notified} customers` });
});

router.get('/recurring-tickets', authenticate, requireAdmin, (req: any, res: Response) => {
  const minCount = parseInt(req.query.minCount as string) || 2;
  const daysBack = parseInt(req.query.daysBack as string) || 90;
  res.json(recurringService.detectRecurringTickets(minCount, daysBack));
});

export default router;
