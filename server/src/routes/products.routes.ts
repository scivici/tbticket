import { Router } from 'express';
import * as productsController from '../controllers/products.controller';

const router = Router();

router.get('/', productsController.getProducts);
router.get('/:productId/categories', productsController.getCategories);
router.get('/categories/:categoryId/questions', productsController.getQuestions);

export default router;
