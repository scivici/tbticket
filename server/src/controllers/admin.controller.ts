import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, queryAll } from '../db/connection';
import { sendWelcomeEmail } from '../services/email.service';

export async function getCustomers(_req: Request, res: Response): Promise<void> {
  const customers = await queryAll<any>(`
    SELECT c.id, c.email, c.name, c.company, c.role, c.is_anonymous, c.created_at,
           COUNT(t.id) as ticket_count,
           MAX(t.created_at) as last_ticket_at
    FROM customers c
    LEFT JOIN tickets t ON t.customer_id = c.id
    WHERE c.role = 'customer'
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `);
  res.json(customers);
}

export async function createCustomer(req: Request, res: Response): Promise<void> {
  const { email, name, company, password } = req.body;

  if (!email || !name || !password) {
    res.status(400).json({ error: 'Email, name, and password are required' });
    return;
  }

  if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    res.status(400).json({ error: 'Password must be at least 8 characters with uppercase, lowercase, and a number' });
    return;
  }

  const existing = await queryOne<any>('SELECT id FROM customers WHERE email = ?', [email]);
  if (existing) {
    res.status(409).json({ error: 'Email already exists' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = await query(
    'INSERT INTO customers (email, name, company, password_hash, role) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [email, name, company || null, passwordHash, 'customer']
  );

  sendWelcomeEmail(email, name, password);

  res.status(201).json({ id: result.rows[0].id, message: 'Customer created' });
}

export async function getDashboardStats(_req: Request, res: Response): Promise<void> {
  const total = (await queryOne<any>('SELECT COUNT(*) as c FROM tickets'))!.c;
  const open = (await queryOne<any>("SELECT COUNT(*) as c FROM tickets WHERE status NOT IN ('resolved', 'closed')"))!.c;
  const resolved = (await queryOne<any>("SELECT COUNT(*) as c FROM tickets WHERE status = 'resolved'"))!.c;

  const avgResolution = (await queryOne<any>(`
    SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_hours
    FROM tickets WHERE resolved_at IS NOT NULL
  `))?.avg_hours || 0;

  const byStatus = await queryAll<any>('SELECT status, COUNT(*) as count FROM tickets GROUP BY status');
  const byPriority = await queryAll<any>('SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority');
  const byProduct = await queryAll<any>(`
    SELECT p.name as product_name, COUNT(*) as count
    FROM tickets t JOIN products p ON t.product_id = p.id
    GROUP BY t.product_id, p.name
  `);

  const workloads = await queryAll<any>(
    'SELECT name as engineer_name, current_workload as current, max_workload as max FROM engineers WHERE is_active = TRUE'
  );

  const statusMap: Record<string, number> = {};
  byStatus.forEach((s: any) => { statusMap[s.status] = parseInt(s.count); });

  const priorityMap: Record<string, number> = {};
  byPriority.forEach((p: any) => { priorityMap[p.priority] = parseInt(p.count); });

  const weeklyTrend = await queryAll<any>(
    "SELECT created_at::DATE as day, COUNT(*) as count FROM tickets WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' GROUP BY created_at::DATE ORDER BY day"
  );

  const engineerPerformance = await queryAll<any>(
    "SELECT e.name, COUNT(t.id) as resolved, AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600) as avg_hours FROM engineers e LEFT JOIN tickets t ON t.assigned_engineer_id = e.id AND t.resolved_at IS NOT NULL WHERE e.is_active = TRUE GROUP BY e.id, e.name"
  );

  const satisfaction = await queryOne<any>(`
    SELECT AVG(rating) as avg_rating, COUNT(*) as total_ratings
    FROM ticket_satisfaction
  `);

  res.json({
    totalTickets: parseInt(total),
    openTickets: parseInt(open),
    resolvedTickets: parseInt(resolved),
    avgResolutionTime: Math.round(parseFloat(avgResolution) * 10) / 10,
    ticketsByStatus: statusMap,
    ticketsByPriority: priorityMap,
    ticketsByProduct: byProduct.map((p: any) => ({ productName: p.product_name, count: parseInt(p.count) })),
    engineerWorkloads: workloads,
    weeklyTrend: weeklyTrend.map((w: any) => ({ day: w.day, count: parseInt(w.count) })),
    engineerPerformance: engineerPerformance.map((e: any) => ({
      name: e.name,
      resolved: parseInt(e.resolved),
      avgHours: e.avg_hours !== null ? Math.round(parseFloat(e.avg_hours) * 10) / 10 : null,
    })),
    avgSatisfaction: satisfaction?.avg_rating ? Math.round(parseFloat(satisfaction.avg_rating) * 10) / 10 : null,
    totalRatings: satisfaction?.total_ratings ? parseInt(satisfaction.total_ratings) : 0,
  });
}
