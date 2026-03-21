import { Router, Response } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate, requireAdmin } from '../middleware/auth';
import * as slaService from '../services/sla.service';
import * as escalationService from '../services/escalation.service';
import * as recurringService from '../services/recurring.service';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.get('/dashboard', authenticate, requireAdmin, adminController.getDashboardStats);
router.get('/customers', authenticate, requireAdmin, adminController.getCustomers);

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

router.get('/recurring-tickets', authenticate, requireAdmin, (req: any, res: Response) => {
  const minCount = parseInt(req.query.minCount as string) || 2;
  const daysBack = parseInt(req.query.daysBack as string) || 90;
  res.json(recurringService.detectRecurringTickets(minCount, daysBack));
});

export default router;
