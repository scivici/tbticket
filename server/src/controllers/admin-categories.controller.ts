import { Request, Response } from 'express';
import { query, queryOne, transaction, clientQuery } from '../db/connection';

export async function createCategory(req: Request, res: Response): Promise<void> {
  const { productId, name, description, icon, displayOrder } = req.body;

  if (!productId || !name) {
    res.status(400).json({ error: 'productId and name are required' });
    return;
  }

  const result = await query(
    'INSERT INTO product_categories (product_id, name, description, icon, display_order) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [productId, name, description || null, icon || null, displayOrder || 0]
  );

  res.status(201).json({ id: result.rows[0].id, message: 'Category created' });
}

export async function updateCategory(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, description, icon, displayOrder, productId } = req.body;

  const existing = await queryOne<any>('SELECT id FROM product_categories WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  await query(`
    UPDATE product_categories SET name = COALESCE(?, name), description = COALESCE(?, description),
    icon = COALESCE(?, icon), display_order = COALESCE(?, display_order),
    product_id = COALESCE(?, product_id)
    WHERE id = ?
  `, [name, description, icon, displayOrder, productId, id]);

  res.json({ message: 'Category updated' });
}

export async function deleteCategory(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await queryOne<any>('SELECT id FROM product_categories WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const ticketRef = await queryOne<any>('SELECT id FROM tickets WHERE category_id = ? LIMIT 1', [id]);
    if (ticketRef) {
      res.status(409).json({ error: 'Cannot delete category: tickets reference it. Resolve or delete those tickets first.' });
      return;
    }

    await transaction(async (client) => {
      await clientQuery(client, 'DELETE FROM question_templates WHERE category_id = ?', [id]);
      await clientQuery(client, 'DELETE FROM engineer_product_expertise WHERE category_id = ?', [id]);
      await clientQuery(client, 'DELETE FROM product_categories WHERE id = ?', [id]);
    });
    res.json({ message: 'Category and its questions deleted' });
  } catch (error: any) {
    console.error('[Admin] Delete category error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to delete category' });
  }
}

export async function reorderCategories(req: Request, res: Response): Promise<void> {
  const items = req.body.items || req.body.categories;

  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'items array is required' });
    return;
  }

  await transaction(async (client) => {
    for (const cat of items) {
      await clientQuery(client, 'UPDATE product_categories SET display_order = ? WHERE id = ?', [cat.displayOrder, cat.id]);
    }
  });

  res.json({ message: 'Categories reordered' });
}
