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

// Bulk operations (must come before /:id routes)
router.post('/bulk/status', authenticate, requireAdmin, ticketsController.bulkUpdateStatus);
router.post('/bulk/assign', authenticate, requireAdmin, ticketsController.bulkAssign);
router.post('/bulk/delete', authenticate, requireAdmin, ticketsController.bulkDelete);

router.get('/:id', authenticate, ticketsController.getTicket);

// Authenticated - responses
router.get('/:id/responses', authenticate, ticketsController.getResponses);
router.post('/:id/responses', authenticate, ticketsController.addResponse);

// Authenticated - activities
router.get('/:id/activities', authenticate, ticketsController.getActivities);

// Authenticated - tags
router.get('/:id/tags', authenticate, ticketsController.getTags);
router.post('/:id/tags', authenticate, requireAdmin, ticketsController.addTag);
router.delete('/:id/tags/:tag', authenticate, requireAdmin, ticketsController.removeTag);

// Admin only
router.patch('/:id/status', authenticate, requireAdmin, ticketsController.updateStatus);
router.patch('/:id/assign', authenticate, requireAdmin, ticketsController.assignEngineer);
router.patch('/:id/priority', authenticate, requireAdmin, ticketsController.updatePriority);
router.post('/:id/analyze', authenticate, requireAdmin, ticketsController.reanalyzeTicket);
router.delete('/:id', authenticate, requireAdmin, ticketsController.deleteTicket);

export default router;
