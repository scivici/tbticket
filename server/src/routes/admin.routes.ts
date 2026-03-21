import { Router, Response } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate, requireAdmin } from '../middleware/auth';
import * as slaService from '../services/sla.service';
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

export default router;
