import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { getDb } from '../db/connection';

export function list(_req: AuthenticatedRequest, res: Response): void {
  const db = getDb();
  const responses = db.prepare('SELECT * FROM canned_responses ORDER BY created_at DESC').all();
  res.json(responses);
}

export function create(req: AuthenticatedRequest, res: Response): void {
  const { title, content, category } = req.body;
  if (!title || !content) {
    res.status(400).json({ error: 'title and content are required' });
    return;
  }
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO canned_responses (title, content, category, created_by) VALUES (?, ?, ?, ?)'
  ).run(title, content, category || null, req.user!.userId);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Canned response created' });
}

export function update(req: AuthenticatedRequest, res: Response): void {
  const { id } = req.params;
  const { title, content, category } = req.body;
  const db = getDb();
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
  db.prepare(`UPDATE canned_responses SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ message: 'Canned response updated' });
}

export function remove(req: AuthenticatedRequest, res: Response): void {
  const { id } = req.params;
  const db = getDb();
  db.prepare('DELETE FROM canned_responses WHERE id = ?').run(id);
  res.json({ message: 'Canned response deleted' });
}
