import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import * as adminProducts from '../controllers/admin-products.controller';
import * as adminCategories from '../controllers/admin-categories.controller';
import * as adminQuestions from '../controllers/admin-questions.controller';
import * as adminSkills from '../controllers/admin-skills.controller';
import { queryAll, queryOne, query } from '../db/connection';

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

// Custom Fields CRUD
router.get('/custom-fields', async (_req, res) => {
  const fields = await queryAll<any>('SELECT * FROM custom_fields ORDER BY display_order ASC, id ASC');
  res.json(fields);
});

router.post('/custom-fields', async (req, res) => {
  const { name, fieldKey, fieldType, options, isRequired, displayOrder, productId } = req.body;
  if (!name || !fieldKey || !fieldType) {
    res.status(400).json({ error: 'name, fieldKey, and fieldType are required' });
    return;
  }
  const result = await query(
    `INSERT INTO custom_fields (name, field_key, field_type, options, is_required, display_order, product_id)
     VALUES (?, ?, ?, ?::jsonb, ?, ?, ?)
     RETURNING *`,
    [name, fieldKey, fieldType, options ? JSON.stringify(options) : null, isRequired || false, displayOrder || 0, productId || null]
  );
  res.json(result.rows[0]);
});

router.patch('/custom-fields/:id', async (req, res) => {
  const { name, fieldKey, fieldType, options, isRequired, displayOrder, productId, isActive } = req.body;
  const existing = await queryOne<any>('SELECT * FROM custom_fields WHERE id = ?', [req.params.id]);
  if (!existing) { res.status(404).json({ error: 'Custom field not found' }); return; }

  await query(
    `UPDATE custom_fields SET name = ?, field_key = ?, field_type = ?, options = ?::jsonb, is_required = ?, display_order = ?, product_id = ?, is_active = ?
     WHERE id = ?`,
    [
      name ?? existing.name,
      fieldKey ?? existing.field_key,
      fieldType ?? existing.field_type,
      options !== undefined ? JSON.stringify(options) : (existing.options ? JSON.stringify(existing.options) : null),
      isRequired ?? existing.is_required,
      displayOrder ?? existing.display_order,
      productId !== undefined ? productId : existing.product_id,
      isActive ?? existing.is_active,
      req.params.id,
    ]
  );
  const updated = await queryOne<any>('SELECT * FROM custom_fields WHERE id = ?', [req.params.id]);
  res.json(updated);
});

router.delete('/custom-fields/:id', async (req, res) => {
  await query('DELETE FROM ticket_custom_field_values WHERE field_id = ?', [req.params.id]);
  await query('DELETE FROM custom_fields WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

export default router;
