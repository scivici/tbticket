import { Router } from 'express';
import * as ticketsController from '../controllers/tickets.controller';
import { authenticate, optionalAuth, requireAdmin } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

// Public
router.get('/track/:ticketNumber', ticketsController.trackTicket);

// Authenticated or anonymous (with optional auth)
router.post('/', optionalAuth, upload.array('files', 5), ticketsController.createTicket);

// Authenticated
router.get('/', authenticate, ticketsController.listTickets);
router.get('/:id', authenticate, ticketsController.getTicket);

// Admin only
router.patch('/:id/status', authenticate, requireAdmin, ticketsController.updateStatus);
router.patch('/:id/assign', authenticate, requireAdmin, ticketsController.assignEngineer);
router.post('/:id/analyze', authenticate, requireAdmin, ticketsController.reanalyzeTicket);

export default router;
