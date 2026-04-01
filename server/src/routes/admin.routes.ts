import { Router, Response } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate, requireAdmin, requireAdminOrEngineer } from '../middleware/auth';
import * as slaService from '../services/sla.service';
import * as escalationService from '../services/escalation.service';
import * as recurringService from '../services/recurring.service';
import { AuthenticatedRequest } from '../types';
import { query, queryOne, queryAll } from '../db/connection';
import * as notificationService from '../services/notification.service';
import * as emailService from '../services/email.service';
import { upload } from '../middleware/upload';

const router = Router();

router.get('/dashboard', authenticate, requireAdminOrEngineer, adminController.getDashboardStats);
router.get('/customers', authenticate, requireAdminOrEngineer, adminController.getCustomers);

// Customer profile management
router.get('/customers/:id', authenticate, requireAdminOrEngineer, async (req: any, res: Response) => {
  const customer = await queryOne<any>(`
    SELECT id, email, name, company, role, is_anonymous, company_ticket_visibility,
           environment_notes, external_links, professional_service_hours, created_at, updated_at
    FROM customers WHERE id = ?
  `, [req.params.id]);
  if (!customer) { res.status(404).json({ error: 'Customer not found' }); return; }
  customer.externalLinks = customer.external_links ? (typeof customer.external_links === 'string' ? JSON.parse(customer.external_links) : customer.external_links) : [];
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

// Customer tickets
router.get('/customers/:id/tickets', authenticate, requireAdminOrEngineer, async (req: any, res: Response) => {
  const tickets = await queryAll<any>(`
    SELECT t.id, t.ticket_number, t.subject, t.status, t.priority, t.created_at, t.resolved_at,
           p.name as product_name
    FROM tickets t
    LEFT JOIN products p ON t.product_id = p.id
    WHERE t.customer_id = ?
    ORDER BY t.created_at DESC
  `, [req.params.id]);
  res.json(tickets);
});

router.get('/sla-policies', authenticate, requireAdminOrEngineer, async (_req: any, res: Response) => {
  res.json(await slaService.getAllSlaPolicies());
});

router.patch('/sla-policies/:priority', authenticate, requireAdmin, async (req: any, res: Response) => {
  const { responseTimeHours, resolutionTimeHours } = req.body;
  await slaService.updateSlaPolicy(req.params.priority, responseTimeHours, resolutionTimeHours);
  res.json({ message: 'SLA policy updated' });
});

router.get('/sla-breached', authenticate, requireAdminOrEngineer, async (_req: any, res: Response) => {
  res.json(await slaService.getBreachedTickets());
});

router.get('/escalation-rules', authenticate, requireAdminOrEngineer, async (_req: any, res: Response) => {
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

router.get('/escalation-alerts', authenticate, requireAdminOrEngineer, async (_req: any, res: Response) => {
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
router.get('/time-report', authenticate, requireAdminOrEngineer, async (req: any, res: Response) => {
  const fromDate = req.query.fromDate as string || '';
  const toDate = req.query.toDate as string || '';
  const engineerId = req.query.engineerId as string || '';
  const customerId = req.query.customerId as string || '';
  const productId = req.query.productId as string || '';
  const activityType = req.query.activityType as string || '';

  let dateFilter = '';
  const params: any[] = [];
  if (fromDate) { dateFilter += ' AND te.date >= ?'; params.push(fromDate); }
  if (toDate) { dateFilter += ' AND te.date <= ?'; params.push(toDate); }
  if (engineerId) { dateFilter += ' AND te.author_id = ?'; params.push(engineerId); }
  if (customerId) { dateFilter += ' AND t.customer_id = ?'; params.push(customerId); }
  if (productId) { dateFilter += ' AND t.product_id = ?'; params.push(productId); }
  if (activityType) { dateFilter += ' AND te.activity_type = ?'; params.push(activityType); }

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
           SUM(CASE WHEN te.is_chargeable = TRUE THEN te.hours ELSE 0 END) as chargeable_hours,
           COUNT(DISTINCT te.ticket_id) as ticket_count
    FROM time_entries te
    LEFT JOIN engineers e ON te.engineer_id = e.id
    JOIN tickets t ON te.ticket_id = t.id
    WHERE 1=1 ${dateFilter}
    GROUP BY COALESCE(e.id, te.author_id), COALESCE(e.name, te.author_name)
    ORDER BY total_hours DESC
  `, params);

  const activityReport = await queryAll<any>(`
    SELECT te.activity_type,
           SUM(te.hours) as total_hours,
           COUNT(*) as entry_count
    FROM time_entries te
    JOIN tickets t ON te.ticket_id = t.id
    WHERE 1=1 ${dateFilter}
    GROUP BY te.activity_type
    ORDER BY total_hours DESC
  `, params);

  const overall = await queryOne<any>(`
    SELECT SUM(hours) as total_hours,
           SUM(CASE WHEN is_chargeable = TRUE THEN hours ELSE 0 END) as chargeable_hours,
           SUM(CASE WHEN is_chargeable = FALSE THEN hours ELSE 0 END) as non_chargeable_hours,
           COUNT(*) as entry_count,
           COUNT(DISTINCT ticket_id) as ticket_count
    FROM time_entries te
    JOIN tickets t ON te.ticket_id = t.id
    WHERE 1=1 ${dateFilter}
  `, params);

  // Detailed entries list
  const entries = await queryAll<any>(`
    SELECT te.*, t.ticket_number, t.subject as ticket_subject,
           p.name as product_name, c.name as customer_name, c.company,
           e.name as engineer_name
    FROM time_entries te
    JOIN tickets t ON te.ticket_id = t.id
    JOIN products p ON t.product_id = p.id
    JOIN customers c ON t.customer_id = c.id
    LEFT JOIN engineers e ON te.engineer_id = e.id
    WHERE 1=1 ${dateFilter}
    ORDER BY te.date DESC, te.created_at DESC
    LIMIT 500
  `, params);

  res.json({ customerReport, engineerReport, activityReport, overall: overall || {}, entries });
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
router.get('/sla-compliance', authenticate, requireAdminOrEngineer, async (req: any, res: Response) => {
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

// SLA Dashboard - comprehensive SLA data
router.get('/sla-dashboard', authenticate, requireAdminOrEngineer, async (_req: any, res: Response) => {
  try {
    const policies = await slaService.getAllSlaPolicies();

    // Get all tickets with SLA info
    const allTickets = await queryAll<any>(`
      SELECT t.id, t.ticket_number, t.subject, t.priority, t.status,
             t.created_at, t.resolved_at,
             sp.response_time_hours, sp.resolution_time_hours,
             e.name as engineer_name,
             c.name as customer_name,
             (SELECT MIN(tr.created_at) FROM ticket_responses tr WHERE tr.ticket_id = t.id AND tr.author_role = 'admin' AND tr.is_internal = FALSE) as first_response_at
      FROM tickets t
      LEFT JOIN sla_policies sp ON sp.priority = t.priority
      LEFT JOIN engineers e ON t.assigned_engineer_id = e.id
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE sp.response_time_hours IS NOT NULL
    `);

    // Compliance per priority
    const complianceByPriority: Record<string, { total: number; responseMet: number; resolutionMet: number; avgResponseHours: number; totalResponseHours: number; respondedCount: number }> = {};
    for (const p of ['critical', 'high', 'medium', 'low']) {
      complianceByPriority[p] = { total: 0, responseMet: 0, resolutionMet: 0, avgResponseHours: 0, totalResponseHours: 0, respondedCount: 0 };
    }

    const now = Date.now();
    const breachedTickets: any[] = [];

    for (const t of allTickets) {
      if (!t.response_time_hours) continue;
      const priority = t.priority;
      if (!complianceByPriority[priority]) continue;

      complianceByPriority[priority].total++;
      const created = new Date(t.created_at).getTime();
      const respDeadline = created + t.response_time_hours * 3600000;
      const resolDeadline = created + t.resolution_time_hours * 3600000;

      const firstResp = t.first_response_at ? new Date(t.first_response_at).getTime() : null;
      const resolved = t.resolved_at ? new Date(t.resolved_at).getTime() : null;

      const respBreached = firstResp ? firstResp > respDeadline : now > respDeadline;
      const resolBreached = resolved ? resolved > resolDeadline : (t.status !== 'resolved' && t.status !== 'closed' && now > resolDeadline);

      if (!respBreached) complianceByPriority[priority].responseMet++;
      if (!resolBreached) complianceByPriority[priority].resolutionMet++;

      if (firstResp) {
        complianceByPriority[priority].totalResponseHours += (firstResp - created) / 3600000;
        complianceByPriority[priority].respondedCount++;
      }

      // Currently breached (open tickets only)
      if ((respBreached || resolBreached) && t.status !== 'resolved' && t.status !== 'closed') {
        const overdueHours = respBreached && !firstResp
          ? (now - respDeadline) / 3600000
          : resolBreached ? (now - resolDeadline) / 3600000 : 0;
        breachedTickets.push({
          ticketId: t.id,
          ticketNumber: t.ticket_number,
          subject: t.subject,
          priority: t.priority,
          status: t.status,
          engineerName: t.engineer_name,
          customerName: t.customer_name,
          createdAt: t.created_at,
          responseBreached: respBreached && !firstResp,
          resolutionBreached: resolBreached,
          overdueHours: Math.round(overdueHours * 10) / 10,
        });
      }
    }

    // Compute avg response time per priority
    const complianceCards = Object.entries(complianceByPriority).map(([priority, data]) => {
      const policy = policies.find((p: any) => p.priority === priority);
      return {
        priority,
        total: data.total,
        responseCompliance: data.total > 0 ? Math.round((data.responseMet / data.total) * 100) : 100,
        resolutionCompliance: data.total > 0 ? Math.round((data.resolutionMet / data.total) * 100) : 100,
        avgResponseHours: data.respondedCount > 0 ? Math.round((data.totalResponseHours / data.respondedCount) * 10) / 10 : null,
        targetResponseHours: policy?.response_time_hours || null,
        targetResolutionHours: policy?.resolution_time_hours || null,
      };
    });

    // Trend: breaches per day over last 30 days
    const thirtyDaysAgo = new Date(now - 30 * 24 * 3600000);
    const trend: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo.getTime() + i * 24 * 3600000);
      trend[d.toISOString().split('T')[0]] = 0;
    }

    for (const t of allTickets) {
      if (!t.response_time_hours) continue;
      const created = new Date(t.created_at).getTime();
      const respDeadline = created + t.response_time_hours * 3600000;
      const resolDeadline = created + t.resolution_time_hours * 3600000;

      const firstResp = t.first_response_at ? new Date(t.first_response_at).getTime() : null;
      const resolved = t.resolved_at ? new Date(t.resolved_at).getTime() : null;

      // Check if response SLA was breached and when
      if (firstResp && firstResp > respDeadline) {
        const breachDate = new Date(respDeadline).toISOString().split('T')[0];
        if (trend[breachDate] !== undefined) trend[breachDate]++;
      } else if (!firstResp && now > respDeadline) {
        const breachDate = new Date(respDeadline).toISOString().split('T')[0];
        if (trend[breachDate] !== undefined) trend[breachDate]++;
      }

      if (resolved && resolved > resolDeadline) {
        const breachDate = new Date(resolDeadline).toISOString().split('T')[0];
        if (trend[breachDate] !== undefined) trend[breachDate]++;
      } else if (!resolved && t.status !== 'resolved' && t.status !== 'closed' && now > resolDeadline) {
        const breachDate = new Date(resolDeadline).toISOString().split('T')[0];
        if (trend[breachDate] !== undefined) trend[breachDate]++;
      }
    }

    const trendData = Object.entries(trend).map(([date, breaches]) => ({ date, breaches }));

    res.json({
      complianceCards,
      breachedTickets: breachedTickets.sort((a, b) => b.overdueHours - a.overdueHours),
      trendData,
      policies,
    });
  } catch (error: any) {
    console.error('[SLA Dashboard] Error:', error);
    res.status(500).json({ error: 'Failed to load SLA dashboard' });
  }
});

// Health dashboard
router.get('/health-dashboard', authenticate, requireAdmin, async (_req: any, res: Response) => {
  try {
    const settingsRows = await queryAll<any>('SELECT key, value FROM settings');
    const settingsMap: Record<string, string> = {};
    for (const row of settingsRows) settingsMap[row.key] = row.value;

    const ticketCount = await queryOne<any>('SELECT COUNT(*) as cnt FROM tickets');
    const customerCount = await queryOne<any>('SELECT COUNT(*) as cnt FROM customers WHERE role = \'customer\'');
    const engineerCount = await queryOne<any>('SELECT COUNT(*) as cnt FROM engineers');
    const activeTimers = await queryOne<any>('SELECT COUNT(*) as cnt FROM active_timers');

    const claudeMode = settingsMap['claude_analysis_mode'] || 'disabled';
    const claudeConfigured = claudeMode !== 'disabled';

    res.json({
      database: true,
      uptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
      stats: {
        tickets: ticketCount?.cnt || 0,
        customers: customerCount?.cnt || 0,
        engineers: engineerCount?.cnt || 0,
        activeTimers: activeTimers?.cnt || 0,
      },
      services: {
        claude: { configured: claudeConfigured, mode: claudeMode },
        smtp: { configured: !!(settingsMap['smtp_host']), host: settingsMap['smtp_host'] || '' },
        slack: { configured: !!(settingsMap['slack_webhook_url']) },
        teams: { configured: !!(settingsMap['teams_webhook_url']) },
        jira: { configured: !!(settingsMap['jira_base_url']) },
      },
    });
  } catch (error: any) {
    // If DB fails, still return partial info
    res.json({
      database: false,
      uptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
      stats: { tickets: 0, customers: 0, engineers: 0, activeTimers: 0 },
      services: {
        claude: { configured: false, mode: 'unknown' },
        smtp: { configured: false },
        slack: { configured: false },
        teams: { configured: false },
        jira: { configured: false },
      },
    });
  }
});

// Export tickets as CSV
router.get('/export/tickets', authenticate, requireAdmin, async (_req: any, res: Response) => {
  const tickets = await queryAll<any>(`
    SELECT t.ticket_number, t.subject, t.status, t.priority,
           p.name as product, pc.name as category,
           c.name as customer, e.name as engineer,
           t.created_at, t.resolved_at, t.ai_confidence
    FROM tickets t
    JOIN products p ON t.product_id = p.id
    LEFT JOIN product_categories pc ON t.category_id = pc.id
    JOIN customers c ON t.customer_id = c.id
    LEFT JOIN engineers e ON t.assigned_engineer_id = e.id
    ORDER BY t.created_at DESC
  `);

  const headers = ['ticket_number', 'subject', 'status', 'priority', 'product', 'category', 'customer', 'engineer', 'created_at', 'resolved_at', 'ai_confidence'];
  const csvRows = [headers.join(',')];
  for (const t of tickets) {
    const row = headers.map(h => {
      const val = t[h];
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
    });
    csvRows.push(row.join(','));
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=tickets-export.csv');
  res.send(csvRows.join('\n'));
});

// Export time entries as CSV
router.get('/export/time-entries', authenticate, requireAdmin, async (_req: any, res: Response) => {
  const entries = await queryAll<any>(`
    SELECT te.date, te.hours, te.description, te.activity_type, te.is_chargeable,
           t.ticket_number, t.subject as ticket_subject,
           p.name as product, c.name as customer, c.company,
           COALESCE(e.name, te.author_name) as engineer
    FROM time_entries te
    JOIN tickets t ON te.ticket_id = t.id
    JOIN products p ON t.product_id = p.id
    JOIN customers c ON t.customer_id = c.id
    LEFT JOIN engineers e ON te.engineer_id = e.id
    ORDER BY te.date DESC, te.created_at DESC
  `);

  const headers = ['date', 'hours', 'description', 'activity_type', 'is_chargeable', 'ticket_number', 'ticket_subject', 'product', 'customer', 'company', 'engineer'];
  const csvRows = [headers.join(',')];
  for (const e of entries) {
    const row = headers.map(h => {
      const val = e[h];
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
    });
    csvRows.push(row.join(','));
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=time-entries-export.csv');
  res.send(csvRows.join('\n'));
});

router.get('/recurring-tickets', authenticate, requireAdmin, async (req: any, res: Response) => {
  const minCount = parseInt(req.query.minCount as string) || 2;
  const daysBack = parseInt(req.query.daysBack as string) || 90;
  res.json(await recurringService.detectRecurringTickets(minCount, daysBack));
});

// AI Usage Dashboard (admin only)
router.get('/ai-usage', authenticate, requireAdmin, async (req: any, res: Response) => {
  try {
    const daysBack = parseInt(req.query.daysBack as string) || 30;

    // Total AI analyses
    const totalAnalyses = await queryOne<any>(
      `SELECT COUNT(*) as count FROM ticket_activity_log WHERE action = 'ai_analysis'`
    );

    // AI analyses in selected period
    const periodAnalyses = await queryOne<any>(
      `SELECT COUNT(*) as count FROM ticket_activity_log WHERE action = 'ai_analysis' AND created_at >= NOW() - INTERVAL '1 day' * ?`,
      [daysBack]
    );

    // AI suggest reply count (from activity log or responses)
    const suggestReplies = await queryOne<any>(
      `SELECT COUNT(*) as count FROM ticket_activity_log WHERE action = 'ai_suggest_reply'`
    );

    // KB articles created from AI
    const kbArticles = await queryOne<any>(
      `SELECT COUNT(*) as count FROM ticket_activity_log WHERE action = 'kb_article_created'`
    );

    // Average execution time (parse from details)
    const avgExecTime = await queryOne<any>(
      `SELECT AVG(
        CASE WHEN details LIKE '%(%s)' THEN
          CAST(SUBSTRING(details FROM '\\(([0-9.]+)s\\)') AS NUMERIC)
        ELSE NULL END
      ) as avg_seconds
      FROM ticket_activity_log WHERE action = 'ai_analysis' AND details LIKE '%(%s)'`
    );

    // Tickets with AI analysis
    const ticketsWithAi = await queryOne<any>(
      `SELECT COUNT(*) as count FROM tickets WHERE ai_analysis IS NOT NULL`
    );
    const totalTickets = await queryOne<any>(
      `SELECT COUNT(*) as count FROM tickets`
    );

    // Daily usage trend
    const dailyTrend = await queryAll<any>(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM ticket_activity_log
       WHERE action IN ('ai_analysis', 'ai_suggest_reply')
         AND created_at >= NOW() - INTERVAL '1 day' * ?
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [daysBack]
    );

    // Recent AI activities
    const recentActivities = await queryAll<any>(
      `SELECT tal.*, t.ticket_number, t.subject
       FROM ticket_activity_log tal
       JOIN tickets t ON tal.ticket_id = t.id
       WHERE tal.action IN ('ai_analysis', 'ai_suggest_reply', 'kb_article_created')
       ORDER BY tal.created_at DESC
       LIMIT 20`
    );

    // Analyses per ticket (top re-analyzed)
    const reanalyzed = await queryAll<any>(
      `SELECT tal.ticket_id, t.ticket_number, t.subject, COUNT(*) as analysis_count
       FROM ticket_activity_log tal
       JOIN tickets t ON tal.ticket_id = t.id
       WHERE tal.action = 'ai_analysis'
       GROUP BY tal.ticket_id, t.ticket_number, t.subject
       HAVING COUNT(*) > 1
       ORDER BY COUNT(*) DESC
       LIMIT 10`
    );

    res.json({
      summary: {
        totalAnalyses: parseInt(totalAnalyses.count),
        periodAnalyses: parseInt(periodAnalyses.count),
        suggestReplies: parseInt(suggestReplies?.count || 0),
        kbArticles: parseInt(kbArticles?.count || 0),
        avgExecutionSeconds: avgExecTime?.avg_seconds ? parseFloat(avgExecTime.avg_seconds).toFixed(1) : null,
        ticketsWithAi: parseInt(ticketsWithAi.count),
        totalTickets: parseInt(totalTickets.count),
        aiCoveragePercent: totalTickets.count > 0 ? Math.round((ticketsWithAi.count / totalTickets.count) * 100) : 0,
      },
      dailyTrend: dailyTrend.map((d: any) => ({ date: d.date, count: parseInt(d.count) })),
      recentActivities: recentActivities.map((a: any) => ({
        id: a.id,
        ticketId: a.ticket_id,
        ticketNumber: a.ticket_number,
        subject: a.subject,
        action: a.action,
        details: a.details,
        actorName: a.actor_name,
        createdAt: a.created_at,
      })),
      reanalyzed: reanalyzed.map((r: any) => ({
        ticketId: r.ticket_id,
        ticketNumber: r.ticket_number,
        subject: r.subject,
        analysisCount: parseInt(r.analysis_count),
      })),
    });
  } catch (error: any) {
    console.error('[Admin] AI usage error:', error);
    res.status(500).json({ error: 'Failed to fetch AI usage data' });
  }
});

export default router;
