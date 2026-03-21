import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import * as adminUsers from '../controllers/admin-users.controller';

const router = Router();

// All routes require admin authentication
router.use(authenticate as any, requireAdmin as any);

router.get('/', adminUsers.listAdmins);
router.post('/', adminUsers.createAdmin);
router.patch('/me/password', adminUsers.changeMyPassword);
router.patch('/:id', adminUsers.updateAdmin);
router.patch('/:id/password', adminUsers.changePassword);
router.delete('/:id', adminUsers.deleteAdmin);

export default router;
