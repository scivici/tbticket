import { Router } from 'express';
import * as ticketsController from '../controllers/tickets.controller';
import { authenticate, optionalAuth, requireAdmin, requireAdminOrEngineer } from '../middleware/auth';
import { upload, validateFileContent } from '../middleware/upload';
import { antivirusScan } from '../middleware/antivirus';

const router = Router();

// Public
router.get('/track/:ticketNumber', ticketsController.trackTicket);

// Authenticated users only — upload pipeline: multer → magic bytes → antivirus → controller
router.post('/', authenticate, upload.array('files', 10), validateFileContent, antivirusScan, ticketsController.createTicket);

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
router.post('/:id/attachments', authenticate, upload.array('files', 10), validateFileContent, antivirusScan, ticketsController.addAttachments);

// Authenticated - responses
router.get('/:id/responses', authenticate, ticketsController.getResponses);
router.post('/:id/responses', authenticate, ticketsController.addResponse);

// Authenticated - activities
router.get('/:id/activities', authenticate, ticketsController.getActivities);

// Authenticated - tags
router.get('/:id/tags', authenticate, ticketsController.getTags);
router.post('/:id/tags', authenticate, requireAdminOrEngineer, ticketsController.addTag);
router.delete('/:id/tags/:tag', authenticate, requireAdminOrEngineer, ticketsController.removeTag);

// Authenticated - CC users
router.get('/:id/cc', authenticate, ticketsController.getCcUsers);
router.post('/:id/cc', authenticate, ticketsController.addCcUser);
router.delete('/:id/cc/:email', authenticate, ticketsController.removeCcUser);

// Authenticated - linked tickets
router.get('/:id/links', authenticate, ticketsController.getLinkedTickets);
router.post('/:id/links', authenticate, requireAdminOrEngineer, ticketsController.linkTicket);
router.delete('/:id/links/:linkId', authenticate, requireAdminOrEngineer, ticketsController.unlinkTicket);

// Time entries
router.get('/:id/time-entries', authenticate, ticketsController.getTimeEntries);
router.post('/:id/time-entries', authenticate, requireAdminOrEngineer, ticketsController.addTimeEntry);
router.delete('/:id/time-entries/:entryId', authenticate, requireAdminOrEngineer, ticketsController.deleteTimeEntry);

// Timer (start/stop)
router.post('/:id/timer/start', authenticate, requireAdminOrEngineer, ticketsController.startTimer);
router.post('/:id/timer/stop', authenticate, requireAdminOrEngineer, ticketsController.stopTimer);
router.delete('/:id/timer', authenticate, requireAdminOrEngineer, ticketsController.cancelTimer);

// AI suggested reply
router.post('/:id/suggest-reply', authenticate, requireAdminOrEngineer, ticketsController.suggestReply);

// Convert to KB article
router.post('/:id/create-kb-article', authenticate, requireAdminOrEngineer, ticketsController.createKbArticle);

// AI extract data from attachment
router.post('/:id/extract-data/:attachmentId', authenticate, requireAdminOrEngineer, ticketsController.extractAttachmentData);

// Customer submits satisfaction (authenticated, before admin-only routes)
router.post('/:id/satisfaction', authenticate, ticketsController.submitSatisfaction);
router.get('/:id/satisfaction', authenticate, ticketsController.getSatisfaction);

// Admin or Engineer
router.patch('/:id/status', authenticate, requireAdminOrEngineer, ticketsController.updateStatus);
router.patch('/:id/assign', authenticate, requireAdminOrEngineer, ticketsController.assignEngineer);
router.patch('/:id/priority', authenticate, requireAdminOrEngineer, ticketsController.updatePriority);
router.patch('/:id/jira', authenticate, requireAdminOrEngineer, ticketsController.updateJiraKey);
router.post('/:id/escalate-jira', authenticate, requireAdminOrEngineer, ticketsController.escalateToJira);
router.get('/:id/jira-status', authenticate, requireAdminOrEngineer, ticketsController.getJiraStatus);
router.post('/:id/analyze', authenticate, requireAdminOrEngineer, ticketsController.reanalyzeTicket);
router.post('/:id/merge', authenticate, requireAdminOrEngineer, ticketsController.mergeTickets);
// Admin only
router.delete('/:id', authenticate, requireAdmin, ticketsController.deleteTicket);

export default router;
