import { Router, Response } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate, requireAdmin } from '../middleware/auth';
import * as slaService from '../services/sla.service';
import * as escalationService from '../services/escalation.service';
import * as recurringService from '../services/recurring.service';
import { AuthenticatedRequest } from '../types';
import { query, queryOne, queryAll } from '../db/connection';
import * as notificationService from '../services/notification.service';
import * as emailService from '../services/email.service';
import { upload } from '../middleware/upload';

const router = Router();

router.get('/dashboard', authenticate, requireAdmin, adminController.getDashboardStats);
router.get('/customers', authenticate, requireAdmin, adminController.getCustomers);

// Customer profile management
router.get('/customers/:id', authenticate, requireAdmin, async (req: any, res: Response) => {
  const customer = await queryOne<any>(`
    SELECT id, email, name, company, role, is_anonymous, company_ticket_visibility,
           environment_notes, external_links, professional_service_hours, created_at, updated_at
    FROM customers WHERE id = ?
  `, [req.params.id]);
  if (!customer) { res.status(404).json({ error: 'Customer not found' }); return; }
  customer.externalLinks = customer.external_links ? JSON.parse(customer.external_links) : [];
  res.json(customer);
});

router.patch('/customers/:id', authenticate, requireAdmin, async (req: any, res: Response) => {
  const { companyTicketVisibility, environmentNotes, externalLinks, professionalServiceHours } = req.body;
  const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const params: any[] = [];

  if (companyTicketVisibility !== undefined) {
    updates.push('company_ticket_visibility = ?');
    params.push(companyTicketVisibility ? true : false);
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
  await query(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`, params);
  res.json({ message: 'Customer updated' });
});

router.get('/sla-policies', authenticate, requireAdmin, async (_req: any, res: Response) => {
  res.json(await slaService.getAllSlaPolicies());
});

router.patch('/sla-policies/:priority', authenticate, requireAdmin, async (req: any, res: Response) => {
  const { responseTimeHours, resolutionTimeHours } = req.body;
  await slaService.updateSlaPolicy(req.params.priority, responseTimeHours, resolutionTimeHours);
  res.json({ message: 'SLA policy updated' });
});

router.get('/sla-breached', authenticate, requireAdmin, async (_req: any, res: Response) => {
  res.json(await slaService.getBreachedTickets());
});

router.get('/escalation-rules', authenticate, requireAdmin, async (_req: any, res: Response) => {
  res.json(await escalationService.getEscalationRules());
});

router.post('/escalation-rules', authenticate, requireAdmin, async (req: any, res: Response) => {
  const { priority, hoursWithoutResponse, action } = req.body;
  const result = await escalationService.createEscalationRule(priority, hoursWithoutResponse, action);
  res.status(201).json({ id: result.rows[0].id });
});

router.patch('/escalation-rules/:id', authenticate, requireAdmin, async (req: any, res: Response) => {
  const { hoursWithoutResponse, action, isActive } = req.body;
  await escalationService.updateEscalationRule(parseInt(req.params.id), hoursWithoutResponse, action, isActive);
  res.json({ message: 'Rule updated' });
});

router.delete('/escalation-rules/:id', authenticate, requireAdmin, async (req: any, res: Response) => {
  await escalationService.deleteEscalationRule(parseInt(req.params.id));
  res.json({ message: 'Rule deleted' });
});

router.get('/escalation-alerts', authenticate, requireAdmin, async (_req: any, res: Response) => {
  res.json(await escalationService.checkEscalations());
});

// Knowledge Base
router.get('/knowledge-base', authenticate, requireAdmin, async (req: any, res: Response) => {
  const articles = await queryAll<any>(`
    SELECT kb.*, p.name as product_name, pc.name as category_name
    FROM knowledge_base kb
    LEFT JOIN products p ON kb.product_id = p.id
    LEFT JOIN product_categories pc ON kb.category_id = pc.id
    ORDER BY kb.created_at DESC
  `);
  res.json(articles);
});

router.delete('/knowledge-base/:id', authenticate, requireAdmin, async (req: any, res: Response) => {
  await query('DELETE FROM knowledge_base WHERE id = ?', [req.params.id]);
  res.json({ message: 'Article deleted' });
});

// Time tracking reports
router.get('/time-report', authenticate, requireAdmin, async (req: any, res: Response) => {
  const fromDate = req.query.fromDate as string || '';
  const toDate = req.query.toDate as string || '';

  let dateFilter = '';
  const params: any[] = [];
  if (fromDate) { dateFilter += ' AND te.date >= ?'; params.push(fromDate); }
  if (toDate) { dateFilter += ' AND te.date <= ?'; params.push(toDate); }

  const customerReport = await queryAll<any>(`
    SELECT c.name as customer_name, c.company,
           SUM(te.hours) as total_hours,
           SUM(CASE WHEN te.is_chargeable = TRUE THEN te.hours ELSE 0 END) as chargeable_hours,
           SUM(CASE WHEN te.is_chargeable = FALSE THEN te.hours ELSE 0 END) as non_chargeable_hours,
           COUNT(DISTINCT te.ticket_id) as ticket_count
    FROM time_entries te
    JOIN tickets t ON te.ticket_id = t.id
    JOIN customers c ON t.customer_id = c.id
    WHERE 1=1 ${dateFilter}
    GROUP BY c.id, c.name, c.company
    ORDER BY total_hours DESC
  `, params);

  const engineerReport = await queryAll<any>(`
    SELECT COALESCE(e.name, te.author_name) as engineer_name,
           SUM(te.hours) as total_hours,
           COUNT(DISTINCT te.ticket_id) as ticket_count
    FROM time_entries te
    LEFT JOIN engineers e ON te.engineer_id = e.id
    WHERE 1=1 ${dateFilter}
    GROUP BY COALESCE(e.id, te.author_id), COALESCE(e.name, te.author_name)
    ORDER BY total_hours DESC
  `, params);

  const overall = await queryOne<any>(`
    SELECT SUM(hours) as total_hours,
           SUM(CASE WHEN is_chargeable = TRUE THEN hours ELSE 0 END) as chargeable_hours,
           COUNT(*) as entry_count,
           COUNT(DISTINCT ticket_id) as ticket_count
    FROM time_entries te
    WHERE 1=1 ${dateFilter}
  `, params);

  res.json({ customerReport, engineerReport, overall: overall || {} });
});

// Customer diagrams/snapshots
router.get('/customers/:id/diagrams', authenticate, requireAdmin, async (req: any, res: Response) => {
  const diagrams = await queryAll<any>(`
    SELECT * FROM customer_diagrams WHERE customer_id = ? ORDER BY created_at DESC
  `, [req.params.id]);
  res.json(diagrams);
});

router.post('/customers/:id/diagrams', authenticate, requireAdmin, upload.single('file'), async (req: any, res: Response) => {
  const file = req.file as Express.Multer.File;
  if (!file) { res.status(400).json({ error: 'No file provided' }); return; }

  const label = req.body.label || file.originalname;
  const result = await query(
    'INSERT INTO customer_diagrams (customer_id, filename, original_name, mime_type, size, path, label) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
    [req.params.id, file.filename, file.originalname, file.mimetype, file.size, file.path, label]
  );

  res.status(201).json({ id: result.rows[0].id, message: 'Diagram uploaded' });
});

router.delete('/customers/:id/diagrams/:diagramId', authenticate, requireAdmin, async (req: any, res: Response) => {
  await query('DELETE FROM customer_diagrams WHERE id = ? AND customer_id = ?', [req.params.diagramId, req.params.id]);
  res.json({ message: 'Diagram deleted' });
});

// Professional service hours remaining per customer
router.get('/ps-hours', authenticate, requireAdmin, async (_req: any, res: Response) => {
  const report = await queryAll<any>(`
    SELECT c.id, c.name, c.company, c.email,
           COALESCE(c.professional_service_hours, 0) as allocated_hours,
           COALESCE((SELECT SUM(te.hours) FROM time_entries te JOIN tickets t ON te.ticket_id = t.id WHERE t.customer_id = c.id AND te.is_chargeable = TRUE), 0) as used_hours
    FROM customers c
    WHERE c.role = 'customer' AND c.is_anonymous = FALSE
    ORDER BY c.name
  `);

  res.json(report.map((r: any) => ({
    ...r,
    remaining_hours: Math.max(0, parseFloat(r.allocated_hours) - parseFloat(r.used_hours)),
  })));
});

// SLA compliance report
router.get('/sla-compliance', authenticate, requireAdmin, async (req: any, res: Response) => {
  const fromDate = req.query.fromDate as string || '';
  const toDate = req.query.toDate as string || '';

  let dateFilter = '';
  const params: any[] = [];
  if (fromDate) { dateFilter += " AND t.created_at >= ?"; params.push(fromDate); }
  if (toDate) { dateFilter += " AND t.created_at <= ?"; params.push(toDate); }

  const tickets = await queryAll<any>(`
    SELECT t.id, t.ticket_number, t.subject, t.priority, t.status,
           t.created_at, t.resolved_at,
           p.name as product_name,
           c.name as customer_name, c.company,
           e.name as engineer_name,
           sp.response_time_hours, sp.resolution_time_hours,
           (SELECT MIN(tr.created_at) FROM ticket_responses tr WHERE tr.ticket_id = t.id AND tr.author_role = 'admin' AND tr.is_internal = FALSE) as first_response_at
    FROM tickets t
    JOIN products p ON t.product_id = p.id
    JOIN customers c ON t.customer_id = c.id
    LEFT JOIN engineers e ON t.assigned_engineer_id = e.id
    LEFT JOIN sla_policies sp ON sp.priority = t.priority
    WHERE 1=1 ${dateFilter}
    ORDER BY t.created_at DESC
  `, params);

  let totalTickets = 0;
  let responseOnTime = 0;
  let responseBreach = 0;
  let resolutionOnTime = 0;
  let resolutionBreach = 0;
  const byPriority: Record<string, { total: number; responseBreached: number; resolutionBreached: number }> = {};

  for (const t of tickets) {
    if (!t.response_time_hours) continue;
    totalTickets++;

    const created = new Date(t.created_at).getTime();
    const respDeadline = created + t.response_time_hours * 3600000;
    const resolDeadline = created + t.resolution_time_hours * 3600000;

    const firstResp = t.first_response_at ? new Date(t.first_response_at).getTime() : null;
    const resolved = t.resolved_at ? new Date(t.resolved_at).getTime() : null;

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

// Log repository - browse all uploaded files across tickets
router.get('/log-repository', authenticate, requireAdmin, async (req: any, res: Response) => {
  const search = req.query.search as string || '';
  const mimeFilter = req.query.mime as string || '';

  let where = '';
  const params: any[] = [];

  if (search) {
    where += " AND (ta.original_name LIKE ? OR t.ticket_number LIKE ? OR t.subject LIKE ?)";
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  if (mimeFilter) {
    where += " AND ta.mime_type LIKE ?";
    params.push(`%${mimeFilter}%`);
  }

  const files = await queryAll<any>(`
    SELECT ta.id, ta.filename, ta.original_name, ta.mime_type, ta.size, ta.created_at,
           t.id as ticket_id, t.ticket_number, t.subject,
           p.name as product_name,
           c.name as customer_name
    FROM ticket_attachments ta
    JOIN tickets t ON ta.ticket_id = t.id
    JOIN products p ON t.product_id = p.id
    JOIN customers c ON t.customer_id = c.id
    WHERE 1=1 ${where}
    ORDER BY ta.created_at DESC
    LIMIT 200
  `, params);

  res.json(files);
});

// Release notes CRUD
router.get('/release-notes', authenticate, requireAdmin, async (_req: any, res: Response) => {
  const notes = await queryAll<any>(`
    SELECT rn.*, p.name as product_name
    FROM release_notes rn
    JOIN products p ON rn.product_id = p.id
    ORDER BY rn.created_at DESC
  `);
  res.json(notes);
});

router.post('/release-notes', authenticate, requireAdmin, async (req: any, res: Response) => {
  const { productId, version, title, content, published } = req.body;
  if (!productId || !version || !title) { res.status(400).json({ error: 'productId, version, and title required' }); return; }
  const result = await query(
    'INSERT INTO release_notes (product_id, version, title, content, published, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    [productId, version, title, content || '', published !== false ? true : false, req.user.userId]
  );
  res.status(201).json({ id: result.rows[0].id, message: 'Release note created' });
});

router.patch('/release-notes/:id', authenticate, requireAdmin, async (req: any, res: Response) => {
  const { version, title, content, published } = req.body;
  await query(`
    UPDATE release_notes SET version = COALESCE(?, version), title = COALESCE(?, title),
    content = COALESCE(?, content), published = COALESCE(?, published) WHERE id = ?
  `, [version, title, content, published !== undefined ? (published ? true : false) : null, req.params.id]);
  res.json({ message: 'Release note updated' });
});

router.delete('/release-notes/:id', authenticate, requireAdmin, async (req: any, res: Response) => {
  await query('DELETE FROM release_notes WHERE id = ?', [req.params.id]);
  res.json({ message: 'Release note deleted' });
});

// Version update notification to customers
router.post('/notify-version-update', authenticate, requireAdmin, async (req: any, res: Response) => {
  const { productId, version, releaseNotes } = req.body;
  if (!productId || !version) { res.status(400).json({ error: 'productId and version are required' }); return; }

  const product = await queryOne<any>('SELECT name FROM products WHERE id = ?', [productId]);
  if (!product) { res.status(404).json({ error: 'Product not found' }); return; }

  const customers = await queryAll<any>(`
    SELECT DISTINCT c.id, c.email, c.name
    FROM customers c
    JOIN tickets t ON t.customer_id = c.id
    WHERE t.product_id = ? AND c.is_anonymous = FALSE
  `, [productId]);

  let notified = 0;
  for (const customer of customers) {
    await notificationService.createNotification(
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

router.get('/recurring-tickets', authenticate, requireAdmin, async (req: any, res: Response) => {
  const minCount = parseInt(req.query.minCount as string) || 2;
  const daysBack = parseInt(req.query.daysBack as string) || 90;
  res.json(await recurringService.detectRecurringTickets(minCount, daysBack));
});

export default router;
