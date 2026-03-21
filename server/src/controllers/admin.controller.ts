import { Request, Response } from 'express';
import { getDb } from '../db/connection';

export function getDashboardStats(_req: Request, res: Response): void {
  const db = getDb();

  const total = (db.prepare('SELECT COUNT(*) as c FROM tickets').get() as any).c;
  const open = (db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status NOT IN ('resolved', 'closed')").get() as any).c;
  const resolved = (db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status = 'resolved'").get() as any).c;

  const avgResolution = (db.prepare(`
    SELECT AVG(CAST((julianday(resolved_at) - julianday(created_at)) * 24 AS REAL)) as avg_hours
    FROM tickets WHERE resolved_at IS NOT NULL
  `).get() as any)?.avg_hours || 0;

  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM tickets GROUP BY status').all() as any[];
  const byPriority = db.prepare('SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority').all() as any[];
  const byProduct = db.prepare(`
    SELECT p.name as product_name, COUNT(*) as count
    FROM tickets t JOIN products p ON t.product_id = p.id
    GROUP BY t.product_id
  `).all() as any[];

  const workloads = db.prepare(
    'SELECT name as engineer_name, current_workload as current, max_workload as max FROM engineers WHERE is_active = 1'
  ).all();

  const statusMap: Record<string, number> = {};
  byStatus.forEach((s: any) => { statusMap[s.status] = s.count; });

  const priorityMap: Record<string, number> = {};
  byPriority.forEach((p: any) => { priorityMap[p.priority] = p.count; });

  const weeklyTrend = db.prepare(
    "SELECT date(created_at) as day, COUNT(*) as count FROM tickets WHERE created_at >= date('now', '-7 days') GROUP BY date(created_at) ORDER BY day"
  ).all() as any[];

  const engineerPerformance = db.prepare(
    "SELECT e.name, COUNT(t.id) as resolved, AVG(CAST((julianday(t.resolved_at) - julianday(t.created_at)) * 24 AS REAL)) as avg_hours FROM engineers e LEFT JOIN tickets t ON t.assigned_engineer_id = e.id AND t.resolved_at IS NOT NULL WHERE e.is_active = 1 GROUP BY e.id"
  ).all() as any[];

  res.json({
    totalTickets: total,
    openTickets: open,
    resolvedTickets: resolved,
    avgResolutionTime: Math.round(avgResolution * 10) / 10,
    ticketsByStatus: statusMap,
    ticketsByPriority: priorityMap,
    ticketsByProduct: byProduct.map((p: any) => ({ productName: p.product_name, count: p.count })),
    engineerWorkloads: workloads,
    weeklyTrend: weeklyTrend.map((w: any) => ({ day: w.day, count: w.count })),
    engineerPerformance: engineerPerformance.map((e: any) => ({
      name: e.name,
      resolved: e.resolved,
      avgHours: e.avg_hours !== null ? Math.round(e.avg_hours * 10) / 10 : null,
    })),
  });
}
