import { Router } from 'express';
import * as productsController from '../controllers/products.controller';
import { queryAll } from '../db/connection';

const router = Router();

router.get('/', productsController.getProducts);
router.get('/:productId/categories', productsController.getCategories);
router.get('/categories/:categoryId/questions', productsController.getQuestions);

// Public custom fields for a product (used by ticket submission wizard)
router.get('/:productId/custom-fields', async (req, res) => {
  const fields = await queryAll<any>(
    `SELECT id, name, field_key, field_type, options, is_required, display_order
     FROM custom_fields
     WHERE is_active = TRUE AND (product_id = ? OR product_id IS NULL)
     ORDER BY display_order ASC`,
    [req.params.productId]
  );
  res.json(fields);
});

// Public release notes
router.get('/release-notes', async (_req, res) => {
  const notes = await queryAll<any>(`
    SELECT rn.id, rn.version, rn.title, rn.content, rn.created_at,
           p.name as product_name, p.id as product_id
    FROM release_notes rn
    JOIN products p ON rn.product_id = p.id
    WHERE rn.published = TRUE
    ORDER BY rn.created_at DESC
    LIMIT 50
  `);
  res.json(notes);
});

export default router;
