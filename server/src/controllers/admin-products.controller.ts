import { Request, Response } from 'express';
import { query, queryOne, queryAll, transaction, clientQuery } from '../db/connection';

export async function createProduct(req: Request, res: Response): Promise<void> {
  const { name, model, description, imageUrl } = req.body;

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const result = await query(
    'INSERT INTO products (name, model, description, image_url) VALUES (?, ?, ?, ?) RETURNING id',
    [name, model || null, description || null, imageUrl || null]
  );

  res.status(201).json({ id: result.rows[0].id, message: 'Product created' });
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, model, description, imageUrl } = req.body;

    const existing = await queryOne<any>('SELECT id FROM products WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    await query(`
      UPDATE products SET name = COALESCE(?, name), model = COALESCE(?, model),
      description = COALESCE(?, description), image_url = COALESCE(?, image_url)
      WHERE id = ?
    `, [name, model, description, imageUrl, id]);

    res.json({ message: 'Product updated' });
  } catch (error: any) {
    console.error('[Admin] Update product error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to update product' });
  }
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await queryOne<any>('SELECT id FROM products WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const ticketRef = await queryOne<any>('SELECT id FROM tickets WHERE product_id = ? LIMIT 1', [id]);
    if (ticketRef) {
      // Soft delete: tickets reference this product; keep the row so historical
      // tickets still resolve their product/category, but hide it everywhere else.
      await transaction(async (client) => {
        await clientQuery(client, 'UPDATE products SET deleted_at = NOW() WHERE id = ?', [id]);
        await clientQuery(client, 'UPDATE product_categories SET deleted_at = NOW() WHERE product_id = ? AND deleted_at IS NULL', [id]);
        await clientQuery(client, `
          UPDATE question_templates SET deleted_at = NOW()
          WHERE category_id IN (SELECT id FROM product_categories WHERE product_id = ?)
            AND deleted_at IS NULL
        `, [id]);
      });
      res.json({ message: 'Product archived (referenced by existing tickets)' });
      return;
    }

    await transaction(async (client) => {
      const catIds = await queryAll<any>('SELECT id FROM product_categories WHERE product_id = ?', [id]);
      for (const cat of catIds) {
        await clientQuery(client, 'DELETE FROM question_templates WHERE category_id = ?', [cat.id]);
      }
      await clientQuery(client, 'DELETE FROM product_categories WHERE product_id = ?', [id]);
      await clientQuery(client, 'DELETE FROM engineer_product_expertise WHERE product_id = ?', [id]);
      await clientQuery(client, 'DELETE FROM products WHERE id = ?', [id]);
    });
    res.json({ message: 'Product and all related data deleted' });
  } catch (error: any) {
    console.error('[Admin] Delete product error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to delete product' });
  }
}
