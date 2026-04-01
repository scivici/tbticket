import { Router } from 'express';
import * as engineersController from '../controllers/engineers.controller';
import { authenticate, requireAdmin, requireAdminOrEngineer } from '../middleware/auth';

const router = Router();

router.get('/skills', engineersController.getSkillsList);
router.get('/', authenticate, requireAdminOrEngineer, engineersController.listEngineers);
router.get('/:id', authenticate, requireAdminOrEngineer, engineersController.getEngineer);
router.post('/', authenticate, requireAdmin, engineersController.createEngineer);
router.patch('/:id', authenticate, requireAdmin, engineersController.updateEngineer);
router.delete('/:id', authenticate, requireAdmin, engineersController.deleteEngineer);
router.put('/:id/skills', authenticate, requireAdmin, engineersController.updateSkills);
router.put('/:id/expertise', authenticate, requireAdmin, engineersController.updateExpertise);

export default router;
