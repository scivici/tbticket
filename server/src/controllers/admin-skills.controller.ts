import { Request, Response } from 'express';
import { query, queryOne, queryAll, transaction, clientQuery } from '../db/connection';

export async function listSkills(_req: Request, res: Response): Promise<void> {
  const skills = await queryAll<any>('SELECT * FROM skills ORDER BY name');
  res.json(skills);
}

export async function createSkill(req: Request, res: Response): Promise<void> {
  const { name, description } = req.body;

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const result = await query(
    'INSERT INTO skills (name, description) VALUES (?, ?) RETURNING id',
    [name, description || null]
  );

  res.status(201).json({ id: result.rows[0].id, message: 'Skill created' });
}

export async function updateSkill(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, description } = req.body;

  const existing = await queryOne<any>('SELECT id FROM skills WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'Skill not found' });
    return;
  }

  await query(`
    UPDATE skills SET name = COALESCE(?, name), description = COALESCE(?, description)
    WHERE id = ?
  `, [name, description, id]);

  res.json({ message: 'Skill updated' });
}

export async function deleteSkill(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const existing = await queryOne<any>('SELECT id FROM skills WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'Skill not found' });
    return;
  }

  await transaction(async (client) => {
    await clientQuery(client, 'DELETE FROM engineer_skills WHERE skill_id = ?', [id]);
    await clientQuery(client, 'DELETE FROM skills WHERE id = ?', [id]);
  });
  res.json({ message: 'Skill deleted' });
}
