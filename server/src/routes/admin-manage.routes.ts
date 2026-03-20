import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import * as adminProducts from '../controllers/admin-products.controller';
import * as adminCategories from '../controllers/admin-categories.controller';
import * as adminQuestions from '../controllers/admin-questions.controller';
import * as adminSkills from '../controllers/admin-skills.controller';

const router = Router();

// All routes require admin authentication
router.use(authenticate as any, requireAdmin as any);

// Products
router.post('/products', adminProducts.createProduct);
router.patch('/products/:id', adminProducts.updateProduct);
router.delete('/products/:id', adminProducts.deleteProduct);

// Categories
router.post('/categories', adminCategories.createCategory);
router.put('/categories/reorder', adminCategories.reorderCategories);
router.patch('/categories/:id', adminCategories.updateCategory);
router.delete('/categories/:id', adminCategories.deleteCategory);

// Questions
router.get('/questions/category/:categoryId', adminQuestions.listQuestions);
router.post('/questions', adminQuestions.createQuestion);
router.put('/questions/reorder', adminQuestions.reorderQuestions);
router.patch('/questions/:id', adminQuestions.updateQuestion);
router.delete('/questions/:id', adminQuestions.deleteQuestion);

// Skills
router.get('/skills', adminSkills.listSkills);
router.post('/skills', adminSkills.createSkill);
router.patch('/skills/:id', adminSkills.updateSkill);
router.delete('/skills/:id', adminSkills.deleteSkill);

export default router;
