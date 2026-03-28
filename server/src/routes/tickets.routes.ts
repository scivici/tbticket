import { Router } from 'express';
import * as ticketsController from '../controllers/tickets.controller';
import { authenticate, optionalAuth, requireAdmin } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

// Public
router.get('/track/:ticketNumber', ticketsController.trackTicket);

// Authenticated or anonymous (with optional auth)
router.post('/', optionalAuth, upload.array('files', 10), ticketsController.createTicket);

// Authenticated
router.get('/', authenticate, ticketsController.listTickets);

// Bulk operations (must come before /:id routes)
router.post('/bulk/status', authenticate, requireAdmin, ticketsController.bulkUpdateStatus);
router.post('/bulk/assign', authenticate, requireAdmin, ticketsController.bulkAssign);
router.post('/bulk/delete', authenticate, requireAdmin, ticketsController.bulkDelete);

// Active timer (must come before /:id routes)
router.get('/timer/active', authenticate, ticketsController.getActiveTimer);

router.get('/:id', authenticate, ticketsController.getTicket);

// Authenticated - attachments
router.post('/:id/attachments', authenticate, upload.array('files', 10), ticketsController.addAttachments);

// Authenticated - responses
router.get('/:id/responses', authenticate, ticketsController.getResponses);
router.post('/:id/responses', authenticate, ticketsController.addResponse);

// Authenticated - activities
router.get('/:id/activities', authenticate, ticketsController.getActivities);

// Authenticated - tags
router.get('/:id/tags', authenticate, ticketsController.getTags);
router.post('/:id/tags', authenticate, requireAdmin, ticketsController.addTag);
router.delete('/:id/tags/:tag', authenticate, requireAdmin, ticketsController.removeTag);

// Authenticated - CC users
router.get('/:id/cc', authenticate, ticketsController.getCcUsers);
router.post('/:id/cc', authenticate, ticketsController.addCcUser);
router.delete('/:id/cc/:email', authenticate, ticketsController.removeCcUser);

// Authenticated - linked tickets
router.get('/:id/links', authenticate, ticketsController.getLinkedTickets);
router.post('/:id/links', authenticate, requireAdmin, ticketsController.linkTicket);
router.delete('/:id/links/:linkId', authenticate, requireAdmin, ticketsController.unlinkTicket);

// Time entries
router.get('/:id/time-entries', authenticate, ticketsController.getTimeEntries);
router.post('/:id/time-entries', authenticate, requireAdmin, ticketsController.addTimeEntry);
router.delete('/:id/time-entries/:entryId', authenticate, requireAdmin, ticketsController.deleteTimeEntry);

// Timer (start/stop)
router.post('/:id/timer/start', authenticate, requireAdmin, ticketsController.startTimer);
router.post('/:id/timer/stop', authenticate, requireAdmin, ticketsController.stopTimer);
router.delete('/:id/timer', authenticate, requireAdmin, ticketsController.cancelTimer);

// AI suggested reply
router.post('/:id/suggest-reply', authenticate, requireAdmin, ticketsController.suggestReply);

// Convert to KB article
router.post('/:id/create-kb-article', authenticate, requireAdmin, ticketsController.createKbArticle);

// AI extract data from attachment
router.post('/:id/extract-data/:attachmentId', authenticate, requireAdmin, ticketsController.extractAttachmentData);

// Customer submits satisfaction (authenticated, before admin-only routes)
router.post('/:id/satisfaction', authenticate, ticketsController.submitSatisfaction);
router.get('/:id/satisfaction', authenticate, ticketsController.getSatisfaction);

// Admin only
router.patch('/:id/status', authenticate, requireAdmin, ticketsController.updateStatus);
router.patch('/:id/assign', authenticate, requireAdmin, ticketsController.assignEngineer);
router.patch('/:id/priority', authenticate, requireAdmin, ticketsController.updatePriority);
router.patch('/:id/jira', authenticate, requireAdmin, ticketsController.updateJiraKey);
router.post('/:id/escalate-jira', authenticate, requireAdmin, ticketsController.escalateToJira);
router.get('/:id/jira-status', authenticate, requireAdmin, ticketsController.getJiraStatus);
router.post('/:id/analyze', authenticate, requireAdmin, ticketsController.reanalyzeTicket);
router.delete('/:id', authenticate, requireAdmin, ticketsController.deleteTicket);

export default router;
