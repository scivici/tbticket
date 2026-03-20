import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/dashboard', authenticate, requireAdmin, adminController.getDashboardStats);

export default router;
