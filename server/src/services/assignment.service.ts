import { queryOne, queryAll } from '../db/connection';

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
export async function scoreEngineers(productId: number, categoryId: number): Promise<EngineerScore[]> {
  const engineers = await queryAll<any>(`
    SELECT * FROM engineers WHERE is_active = TRUE AND current_workload < max_workload
  `);

  const filtered: any[] = engineers.filter((engineer: any) => {
    // Shift-based filtering: if engineer has shift defined, check if currently in shift (weekdays only)
    if (engineer.shift_start && engineer.shift_end) {
      const now = new Date();

      // Convert current time to engineer's timezone
      const tz = engineer.timezone || 'UTC';
      let localHour: number, localMinute: number, localDay: number;
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false, weekday: 'short'
        }).formatToParts(now);
        localHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
        localMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
        const dayStr = parts.find(p => p.type === 'weekday')?.value || '';
        localDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dayStr);
      } catch {
        // Fallback to UTC if timezone is invalid
        localHour = now.getUTCHours();
        localMinute = now.getUTCMinutes();
        localDay = now.getUTCDay();
      }

      // Weekday check: 0=Sun, 6=Sat → skip weekends
      if (localDay === 0 || localDay === 6) return false;

      const [startH, startM] = engineer.shift_start.split(':').map(Number);
      const [endH, endM] = engineer.shift_end.split(':').map(Number);
      const currentMinutes = localHour * 60 + localMinute;
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
  });

  const scores: EngineerScore[] = [];

  for (const engineer of filtered) {
    // Product/category expertise (0-5, weighted x3)
    const expertise = await queryOne<any>(`
      SELECT MAX(expertise_level) as level
      FROM engineer_product_expertise
      WHERE engineer_id = ? AND product_id = ? AND (category_id = ? OR category_id IS NULL)
    `, [engineer.id, productId, categoryId]);
    const productExpertiseScore = (expertise?.level || 0) * 3;

    // Average skill proficiency (0-5, weighted x2)
    const skills = await queryOne<any>(`
      SELECT AVG(proficiency) as avg_prof
      FROM engineer_skills
      WHERE engineer_id = ?
    `, [engineer.id]);
    const skillScore = (skills?.avg_prof || 0) * 2;

    // Availability score (0-2, weighted x2)
    const utilizationRatio = engineer.current_workload / engineer.max_workload;
    const availabilityScore = (1 - utilizationRatio) * 2 * 2;

    // Workload penalty
    const workloadPenalty = engineer.current_workload * 0.5;

    const totalScore = productExpertiseScore + skillScore + availabilityScore - workloadPenalty;

    scores.push({
      engineerId: engineer.id,
      engineerName: engineer.name,
      score: Math.round(totalScore * 100) / 100,
      breakdown: {
        productExpertise: productExpertiseScore,
        skillProficiency: skillScore,
        availability: availabilityScore,
        workloadPenalty,
      },
    });
  }

  return scores.sort((a, b) => b.score - a.score);
}

export async function getBestEngineer(productId: number, categoryId: number): Promise<EngineerScore | null> {
  const scores = await scoreEngineers(productId, categoryId);
  return scores.length > 0 ? scores[0] : null;
}

/**
 * Check if an engineer is currently within their working hours (weekdays only).
 * Returns true if no shift is defined (always available).
 */
export function isEngineerOnShift(engineer: { shift_start?: string; shift_end?: string; timezone?: string }): boolean {
  if (!engineer.shift_start || !engineer.shift_end) return true;

  const now = new Date();
  const tz = engineer.timezone || 'UTC';
  let localHour: number, localMinute: number, localDay: number;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false, weekday: 'short'
    }).formatToParts(now);
    localHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    localMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const dayStr = parts.find(p => p.type === 'weekday')?.value || '';
    localDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dayStr);
  } catch {
    localHour = now.getUTCHours();
    localMinute = now.getUTCMinutes();
    localDay = now.getUTCDay();
  }

  if (localDay === 0 || localDay === 6) return false;

  const [startH, startM] = engineer.shift_start.split(':').map(Number);
  const [endH, endM] = engineer.shift_end.split(':').map(Number);
  const currentMinutes = localHour * 60 + localMinute;
  const startMinutes = startH * 60 + (startM || 0);
  const endMinutes = endH * 60 + (endM || 0);

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}
