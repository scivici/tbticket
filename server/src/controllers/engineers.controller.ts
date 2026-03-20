import { Request, Response } from 'express';
import { getDb } from '../db/connection';

export function listEngineers(_req: Request, res: Response): void {
  const db = getDb();
  const engineers = db.prepare('SELECT * FROM engineers ORDER BY name').all();
  res.json(engineers.map(mapEngineer));
}

export function getEngineer(req: Request, res: Response): void {
  const db = getDb();
  const engineer = db.prepare('SELECT * FROM engineers WHERE id = ?').get(req.params.id) as any;
  if (!engineer) {
    res.status(404).json({ error: 'Engineer not found' });
    return;
  }

  const skills = db.prepare(`
    SELECT s.id, s.name, s.description, es.proficiency
    FROM engineer_skills es
    JOIN skills s ON es.skill_id = s.id
    WHERE es.engineer_id = ?
  `).all(engineer.id);

  const expertise = db.prepare(`
    SELECT epe.*, p.name as product_name, pc.name as category_name
    FROM engineer_product_expertise epe
    JOIN products p ON epe.product_id = p.id
    LEFT JOIN product_categories pc ON epe.category_id = pc.id
    WHERE epe.engineer_id = ?
  `).all(engineer.id);

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

export function createEngineer(req: Request, res: Response): void {
  const db = getDb();
  const { name, email, location, maxWorkload } = req.body;

  if (!name || !email || !location) {
    res.status(400).json({ error: 'name, email, and location are required' });
    return;
  }

  const result = db.prepare(
    'INSERT INTO engineers (name, email, location, max_workload) VALUES (?, ?, ?, ?)'
  ).run(name, email, location, maxWorkload || 5);

  res.status(201).json({ id: result.lastInsertRowid, message: 'Engineer created' });
}

export function updateEngineer(req: Request, res: Response): void {
  const db = getDb();
  const { name, email, location, isActive, maxWorkload } = req.body;
  const { id } = req.params;

  db.prepare(`
    UPDATE engineers SET name = COALESCE(?, name), email = COALESCE(?, email),
    location = COALESCE(?, location), is_active = COALESCE(?, is_active),
    max_workload = COALESCE(?, max_workload), updated_at = datetime('now')
    WHERE id = ?
  `).run(name, email, location, isActive !== undefined ? (isActive ? 1 : 0) : null, maxWorkload, id);

  res.json({ message: 'Engineer updated' });
}

export function updateSkills(req: Request, res: Response): void {
  const db = getDb();
  const { id } = req.params;
  const { skills } = req.body; // [{ skillId, proficiency }]

  if (!Array.isArray(skills)) {
    res.status(400).json({ error: 'skills array is required' });
    return;
  }

  db.transaction(() => {
    db.prepare('DELETE FROM engineer_skills WHERE engineer_id = ?').run(id);
    const insert = db.prepare('INSERT INTO engineer_skills (engineer_id, skill_id, proficiency) VALUES (?, ?, ?)');
    for (const skill of skills) {
      insert.run(id, skill.skillId, skill.proficiency);
    }
  })();

  res.json({ message: 'Skills updated' });
}

export function updateExpertise(req: Request, res: Response): void {
  const db = getDb();
  const { id } = req.params;
  const { expertise } = req.body; // [{ productId, categoryId?, expertiseLevel }]

  if (!Array.isArray(expertise)) {
    res.status(400).json({ error: 'expertise array is required' });
    return;
  }

  db.transaction(() => {
    db.prepare('DELETE FROM engineer_product_expertise WHERE engineer_id = ?').run(id);
    const insert = db.prepare(
      'INSERT INTO engineer_product_expertise (engineer_id, product_id, category_id, expertise_level) VALUES (?, ?, ?, ?)'
    );
    for (const e of expertise) {
      insert.run(id, e.productId, e.categoryId || null, e.expertiseLevel);
    }
  })();

  res.json({ message: 'Expertise updated' });
}

export function deleteEngineer(req: Request, res: Response): void {
  const db = getDb();
  const { id } = req.params;

  const hasTickets = db.prepare('SELECT COUNT(*) as c FROM tickets WHERE assigned_engineer_id = ?').get(id) as any;
  if (hasTickets.c > 0) {
    res.status(409).json({ error: 'Cannot delete engineer with assigned tickets. Reassign tickets first.' });
    return;
  }

  db.transaction(() => {
    db.prepare('DELETE FROM engineer_skills WHERE engineer_id = ?').run(id);
    db.prepare('DELETE FROM engineer_product_expertise WHERE engineer_id = ?').run(id);
    db.prepare('DELETE FROM engineers WHERE id = ?').run(id);
  })();

  res.json({ message: 'Engineer deleted' });
}

export function getSkillsList(_req: Request, res: Response): void {
  const db = getDb();
  const skills = db.prepare('SELECT * FROM skills ORDER BY name').all();
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
