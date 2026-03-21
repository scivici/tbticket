import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as notificationService from '../services/notification.service';
import { AuthenticatedRequest } from '../types';
import { Response } from 'express';

const router = Router();

router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const notifications = notificationService.getNotifications(req.user!.userId);
  res.json(notifications);
});

router.get('/unread-count', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const count = notificationService.getUnreadCount(req.user!.userId);
  res.json({ count });
});

router.patch('/:id/read', authenticate, (req: AuthenticatedRequest, res: Response) => {
  notificationService.markAsRead(parseInt(req.params.id), req.user!.userId);
  res.json({ message: 'Marked as read' });
});

router.patch('/read-all', authenticate, (req: AuthenticatedRequest, res: Response) => {
  notificationService.markAllAsRead(req.user!.userId);
  res.json({ message: 'All marked as read' });
});

export default router;
