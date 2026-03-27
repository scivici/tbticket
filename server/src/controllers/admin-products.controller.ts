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
  const { id } = req.params;
  const { name, model, description, imageUrl, requiredFields } = req.body;

  const existing = await queryOne<any>('SELECT id FROM products WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  await query(`
    UPDATE products SET name = COALESCE(?, name), model = COALESCE(?, model),
    description = COALESCE(?, description), image_url = COALESCE(?, image_url),
    required_fields = COALESCE(?, required_fields)
    WHERE id = ?
  `, [name, model, description, imageUrl, requiredFields ? JSON.stringify(requiredFields) : null, id]);

  res.json({ message: 'Product updated' });
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
      res.status(409).json({ error: 'Cannot delete product: tickets reference it. Resolve or delete those tickets first.' });
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
