import { Request, Response } from 'express';
import { getDb } from '../db/connection';

export function createProduct(req: Request, res: Response): void {
  const db = getDb();
  const { name, model, description, imageUrl } = req.body;

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const result = db.prepare(
    'INSERT INTO products (name, model, description, image_url) VALUES (?, ?, ?, ?)'
  ).run(name, model || null, description || null, imageUrl || null);

  res.status(201).json({ id: result.lastInsertRowid, message: 'Product created' });
}

export function updateProduct(req: Request, res: Response): void {
  const db = getDb();
  const { id } = req.params;
  const { name, model, description, imageUrl, requiredFields } = req.body;

  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  db.prepare(`
    UPDATE products SET name = COALESCE(?, name), model = COALESCE(?, model),
    description = COALESCE(?, description), image_url = COALESCE(?, image_url),
    required_fields = COALESCE(?, required_fields)
    WHERE id = ?
  `).run(name, model, description, imageUrl, requiredFields ? JSON.stringify(requiredFields) : null, id);

  res.json({ message: 'Product updated' });
}

export function deleteProduct(req: Request, res: Response): void {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const ticketRef = db.prepare('SELECT id FROM tickets WHERE product_id = ? LIMIT 1').get(id) as any;
    if (ticketRef) {
      res.status(409).json({ error: 'Cannot delete product: tickets reference it. Resolve or delete those tickets first.' });
      return;
    }

    db.transaction(() => {
      const catIds = db.prepare('SELECT id FROM product_categories WHERE product_id = ?').all(id) as any[];
      for (const cat of catIds) {
        db.prepare('DELETE FROM question_templates WHERE category_id = ?').run(cat.id);
      }
      db.prepare('DELETE FROM product_categories WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM engineer_product_expertise WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
    })();
    res.json({ message: 'Product and all related data deleted' });
  } catch (error: any) {
    console.error('[Admin] Delete product error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to delete product' });
  }
}
