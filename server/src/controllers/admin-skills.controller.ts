import { Request, Response } from 'express';
import { getDb } from '../db/connection';

export function listSkills(_req: Request, res: Response): void {
  const db = getDb();
  const skills = db.prepare('SELECT * FROM skills ORDER BY name').all();
  res.json(skills);
}

export function createSkill(req: Request, res: Response): void {
  const db = getDb();
  const { name, description } = req.body;

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const result = db.prepare(
    'INSERT INTO skills (name, description) VALUES (?, ?)'
  ).run(name, description || null);

  res.status(201).json({ id: result.lastInsertRowid, message: 'Skill created' });
}

export function updateSkill(req: Request, res: Response): void {
  const db = getDb();
  const { id } = req.params;
  const { name, description } = req.body;

  const existing = db.prepare('SELECT id FROM skills WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Skill not found' });
    return;
  }

  db.prepare(`
    UPDATE skills SET name = COALESCE(?, name), description = COALESCE(?, description)
    WHERE id = ?
  `).run(name, description, id);

  res.json({ message: 'Skill updated' });
}

export function deleteSkill(req: Request, res: Response): void {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM skills WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Skill not found' });
    return;
  }

  const ref = db.prepare('SELECT id FROM engineer_skills WHERE skill_id = ? LIMIT 1').get(id) as any;
  if (ref) {
    res.status(409).json({ error: 'Cannot delete skill: engineer skills reference it' });
    return;
  }

  db.prepare('DELETE FROM skills WHERE id = ?').run(id);
  res.json({ message: 'Skill deleted' });
}
