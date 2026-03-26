import { getDb } from '../db/connection';

interface EngineerScore {
  engineerId: number;
  engineerName: string;
  score: number;
  breakdown: {
    productExpertise: number;
    skillProficiency: number;
    availability: number;
    workloadPenalty: number;
  };
}

/**
 * Fallback scoring algorithm when Claude is unavailable.
 * Score = (product_expertise * 3) + (skill_proficiency * 2) + (availability * 2) - workload_penalty
 */
export function scoreEngineers(productId: number, categoryId: number): EngineerScore[] {
  const db = getDb();

  const engineers = db.prepare(`
    SELECT * FROM engineers WHERE is_active = 1 AND current_workload < max_workload
  `).all() as any[];

  const scores: EngineerScore[] = engineers.filter((engineer: any) => {
    // Shift-based filtering: if engineer has shift defined, check if currently in shift
    if (engineer.shift_start && engineer.shift_end) {
      const now = new Date();
      const [startH, startM] = engineer.shift_start.split(':').map(Number);
      const [endH, endM] = engineer.shift_end.split(':').map(Number);
      const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
      const startMinutes = startH * 60 + (startM || 0);
      const endMinutes = endH * 60 + (endM || 0);

      // Handle overnight shifts (e.g., 22:00 - 06:00)
      if (startMinutes < endMinutes) {
        if (currentMinutes < startMinutes || currentMinutes > endMinutes) return false;
      } else {
        if (currentMinutes < startMinutes && currentMinutes > endMinutes) return false;
      }
    }
    return true;
  }).map((engineer: any) => {
    // Product/category expertise (0-5, weighted x3)
    const expertise = db.prepare(`
      SELECT MAX(expertise_level) as level
      FROM engineer_product_expertise
      WHERE engineer_id = ? AND product_id = ? AND (category_id = ? OR category_id IS NULL)
    `).get(engineer.id, productId, categoryId) as any;
    const productExpertiseScore = (expertise?.level || 0) * 3;

    // Average skill proficiency (0-5, weighted x2)
    const skills = db.prepare(`
      SELECT AVG(proficiency) as avg_prof
      FROM engineer_skills
      WHERE engineer_id = ?
    `).get(engineer.id) as any;
    const skillScore = (skills?.avg_prof || 0) * 2;

    // Availability score (0-2, weighted x2)
    const utilizationRatio = engineer.current_workload / engineer.max_workload;
    const availabilityScore = (1 - utilizationRatio) * 2 * 2;

    // Workload penalty
    const workloadPenalty = engineer.current_workload * 0.5;

    const totalScore = productExpertiseScore + skillScore + availabilityScore - workloadPenalty;

    return {
      engineerId: engineer.id,
      engineerName: engineer.name,
      score: Math.round(totalScore * 100) / 100,
      breakdown: {
        productExpertise: productExpertiseScore,
        skillProficiency: skillScore,
        availability: availabilityScore,
        workloadPenalty,
      },
    };
  });

  return scores.sort((a, b) => b.score - a.score);
}

export function getBestEngineer(productId: number, categoryId: number): EngineerScore | null {
  const scores = scoreEngineers(productId, categoryId);
  return scores.length > 0 ? scores[0] : null;
}
