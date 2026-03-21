import { Router } from 'express';
import * as cannedResponsesController from '../controllers/canned-responses.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, requireAdmin, cannedResponsesController.list);
router.post('/', authenticate, requireAdmin, cannedResponsesController.create);
router.patch('/:id', authenticate, requireAdmin, cannedResponsesController.update);
router.delete('/:id', authenticate, requireAdmin, cannedResponsesController.remove);

export default router;
