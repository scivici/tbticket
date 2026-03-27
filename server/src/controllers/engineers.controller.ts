import { Request, Response } from 'express';
import { query, queryOne, queryAll, transaction, clientQuery } from '../db/connection';

export async function listEngineers(_req: Request, res: Response): Promise<void> {
  const engineers = await queryAll<any>('SELECT * FROM engineers ORDER BY name');
  res.json(engineers.map(mapEngineer));
}

export async function getEngineer(req: Request, res: Response): Promise<void> {
  const engineer = await queryOne<any>('SELECT * FROM engineers WHERE id = ?', [req.params.id]);
  if (!engineer) {
    res.status(404).json({ error: 'Engineer not found' });
    return;
  }

  const skills = await queryAll<any>(`
    SELECT s.id, s.name, s.description, es.proficiency
    FROM engineer_skills es
    JOIN skills s ON es.skill_id = s.id
    WHERE es.engineer_id = ?
  `, [engineer.id]);

  const expertise = await queryAll<any>(`
    SELECT epe.*, p.name as product_name, pc.name as category_name
    FROM engineer_product_expertise epe
    JOIN products p ON epe.product_id = p.id
    LEFT JOIN product_categories pc ON epe.category_id = pc.id
    WHERE epe.engineer_id = ?
  `, [engineer.id]);

  res.json({
    ...mapEngineer(engineer),
    skills,
    expertise: expertise.map((e: any) => ({
      productId: e.product_id,
      productName: e.product_name,
      categoryId: e.category_id,
      categoryName: e.category_name,
      expertiseLevel: e.expertise_level,
    })),
  });
}

export async function createEngineer(req: Request, res: Response): Promise<void> {
  const { name, email, location, maxWorkload } = req.body;

  if (!name || !email || !location) {
    res.status(400).json({ error: 'name, email, and location are required' });
    return;
  }

  const result = await query(
    'INSERT INTO engineers (name, email, location, max_workload) VALUES (?, ?, ?, ?) RETURNING id',
    [name, email, location, maxWorkload || 5]
  );

  res.status(201).json({ id: result.rows[0].id, message: 'Engineer created' });
}

export async function updateEngineer(req: Request, res: Response): Promise<void> {
  const { name, email, location, isActive, maxWorkload, shiftStart, shiftEnd, timezone } = req.body;
  const { id } = req.params;

  await query(`
    UPDATE engineers SET name = COALESCE(?, name), email = COALESCE(?, email),
    location = COALESCE(?, location), is_active = COALESCE(?, is_active),
    max_workload = COALESCE(?, max_workload),
    shift_start = COALESCE(?, shift_start), shift_end = COALESCE(?, shift_end),
    timezone = COALESCE(?, timezone),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [name, email, location, isActive !== undefined ? (isActive ? true : false) : null, maxWorkload, shiftStart || null, shiftEnd || null, timezone || null, id]);

  res.json({ message: 'Engineer updated' });
}

export async function updateSkills(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { skills } = req.body;

  if (!Array.isArray(skills)) {
    res.status(400).json({ error: 'skills array is required' });
    return;
  }

  await transaction(async (client) => {
    await clientQuery(client, 'DELETE FROM engineer_skills WHERE engineer_id = ?', [id]);
    for (const skill of skills) {
      await clientQuery(client, 'INSERT INTO engineer_skills (engineer_id, skill_id, proficiency) VALUES (?, ?, ?)', [id, skill.skillId, skill.proficiency]);
    }
  });

  res.json({ message: 'Skills updated' });
}

export async function updateExpertise(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { expertise } = req.body;

  if (!Array.isArray(expertise)) {
    res.status(400).json({ error: 'expertise array is required' });
    return;
  }

  await transaction(async (client) => {
    await clientQuery(client, 'DELETE FROM engineer_product_expertise WHERE engineer_id = ?', [id]);
    for (const e of expertise) {
      await clientQuery(client, 'INSERT INTO engineer_product_expertise (engineer_id, product_id, category_id, expertise_level) VALUES (?, ?, ?, ?)', [id, e.productId, e.categoryId || null, e.expertiseLevel]);
    }
  });

  res.json({ message: 'Expertise updated' });
}

export async function deleteEngineer(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const hasTickets = await queryOne<any>('SELECT COUNT(*) as c FROM tickets WHERE assigned_engineer_id = ?', [id]);
  if (hasTickets.c > 0) {
    res.status(409).json({ error: 'Cannot delete engineer with assigned tickets. Reassign tickets first.' });
    return;
  }

  await transaction(async (client) => {
    await clientQuery(client, 'DELETE FROM engineer_skills WHERE engineer_id = ?', [id]);
    await clientQuery(client, 'DELETE FROM engineer_product_expertise WHERE engineer_id = ?', [id]);
    await clientQuery(client, 'DELETE FROM engineers WHERE id = ?', [id]);
  });

  res.json({ message: 'Engineer deleted' });
}

export async function getSkillsList(_req: Request, res: Response): Promise<void> {
  const skills = await queryAll<any>('SELECT * FROM skills ORDER BY name');
  res.json(skills);
}

function mapEngineer(e: any) {
  return {
    id: e.id,
    name: e.name,
    email: e.email,
    location: e.location,
    isActive: !!e.is_active,
    currentWorkload: e.current_workload,
    maxWorkload: e.max_workload,
  };
}
