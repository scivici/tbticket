import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { query, queryAll } from '../db/connection';

export async function list(_req: AuthenticatedRequest, res: Response): Promise<void> {
  const responses = await queryAll<any>('SELECT * FROM canned_responses ORDER BY created_at DESC');
  res.json(responses);
}

export async function create(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { title, content, category } = req.body;
  if (!title || !content) {
    res.status(400).json({ error: 'title and content are required' });
    return;
  }
  const result = await query(
    'INSERT INTO canned_responses (title, content, category, created_by) VALUES (?, ?, ?, ?) RETURNING id',
    [title, content, category || null, req.user!.userId]
  );
  res.status(201).json({ id: result.rows[0].id, message: 'Canned response created' });
}

export async function update(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { title, content, category } = req.body;
  const fields: string[] = [];
  const values: any[] = [];
  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (content !== undefined) { fields.push('content = ?'); values.push(content); }
  if (category !== undefined) { fields.push('category = ?'); values.push(category); }
  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }
  values.push(id);
  await query(`UPDATE canned_responses SET ${fields.join(', ')} WHERE id = ?`, values);
  res.json({ message: 'Canned response updated' });
}

export async function remove(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  await query('DELETE FROM canned_responses WHERE id = ?', [id]);
  res.json({ message: 'Canned response deleted' });
}
