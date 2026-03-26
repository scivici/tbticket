import { Router } from 'express';
import * as productsController from '../controllers/products.controller';
import { getDb } from '../db/connection';

const router = Router();

router.get('/', productsController.getProducts);
router.get('/:productId/categories', productsController.getCategories);
router.get('/categories/:categoryId/questions', productsController.getQuestions);

// Public release notes
router.get('/release-notes', (_req, res) => {
  const db = getDb();
  const notes = db.prepare(`
    SELECT rn.id, rn.version, rn.title, rn.content, rn.created_at,
           p.name as product_name, p.id as product_id
    FROM release_notes rn
    JOIN products p ON rn.product_id = p.id
    WHERE rn.published = 1
    ORDER BY rn.created_at DESC
    LIMIT 50
  `).all();
  res.json(notes);
});

export default router;
