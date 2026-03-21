import { Request, Response } from 'express';
import { getDb } from '../db/connection';

export function createCategory(req: Request, res: Response): void {
  const db = getDb();
  const { productId, name, description, icon, displayOrder } = req.body;

  if (!productId || !name) {
    res.status(400).json({ error: 'productId and name are required' });
    return;
  }

  const result = db.prepare(
    'INSERT INTO product_categories (product_id, name, description, icon, display_order) VALUES (?, ?, ?, ?, ?)'
  ).run(productId, name, description || null, icon || null, displayOrder || 0);

  res.status(201).json({ id: result.lastInsertRowid, message: 'Category created' });
}

export function updateCategory(req: Request, res: Response): void {
  const db = getDb();
  const { id } = req.params;
  const { name, description, icon, displayOrder, productId } = req.body;

  const existing = db.prepare('SELECT id FROM product_categories WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  db.prepare(`
    UPDATE product_categories SET name = COALESCE(?, name), description = COALESCE(?, description),
    icon = COALESCE(?, icon), display_order = COALESCE(?, display_order),
    product_id = COALESCE(?, product_id)
    WHERE id = ?
  `).run(name, description, icon, displayOrder, productId, id);

  res.json({ message: 'Category updated' });
}

export function deleteCategory(req: Request, res: Response): void {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM product_categories WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const ticketRef = db.prepare('SELECT id FROM tickets WHERE category_id = ? LIMIT 1').get(id) as any;
    if (ticketRef) {
      res.status(409).json({ error: 'Cannot delete category: tickets reference it. Resolve or delete those tickets first.' });
      return;
    }

    db.transaction(() => {
      db.prepare('DELETE FROM question_templates WHERE category_id = ?').run(id);
      db.prepare('DELETE FROM engineer_product_expertise WHERE category_id = ?').run(id);
      db.prepare('DELETE FROM product_categories WHERE id = ?').run(id);
    })();
    res.json({ message: 'Category and its questions deleted' });
  } catch (error: any) {
    console.error('[Admin] Delete category error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to delete category' });
  }
}

export function reorderCategories(req: Request, res: Response): void {
  const db = getDb();
  const items = req.body.items || req.body.categories;

  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'items array is required' });
    return;
  }

  db.transaction(() => {
    const stmt = db.prepare('UPDATE product_categories SET display_order = ? WHERE id = ?');
    for (const cat of items) {
      stmt.run(cat.displayOrder, cat.id);
    }
  })();

  res.json({ message: 'Categories reordered' });
}
