import { Router } from 'express';
import * as engineersController from '../controllers/engineers.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/skills', engineersController.getSkillsList);
router.get('/', authenticate, requireAdmin, engineersController.listEngineers);
router.get('/:id', authenticate, requireAdmin, engineersController.getEngineer);
router.post('/', authenticate, requireAdmin, engineersController.createEngineer);
router.patch('/:id', authenticate, requireAdmin, engineersController.updateEngineer);
router.delete('/:id', authenticate, requireAdmin, engineersController.deleteEngineer);
router.put('/:id/skills', authenticate, requireAdmin, engineersController.updateSkills);
router.put('/:id/expertise', authenticate, requireAdmin, engineersController.updateExpertise);

export default router;
