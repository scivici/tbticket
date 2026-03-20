import { config } from '../config';
import { getDb } from '../db/connection';

interface ClaudeAnalysisInput {
  ticket: {
    subject: string;
    description: string;
    productName: string;
    productModel: string;
    categoryName: string;
    answers: { question: string; answer: string }[];
  };
  engineers: {
    id: number;
    name: string;
    location: string;
    currentWorkload: number;
    maxWorkload: number;
    skills: { name: string; proficiency: number }[];
    productExpertise: { productName: string; categoryName: string; level: number }[];
  }[];
}

export interface ClaudeAnalysisResult {
  classification: string;
  severity: string;
  rootCauseHypothesis: string;
  recommendedEngineerId: number;
  recommendedEngineerName: string;
  confidence: number;
  reasoning: string;
  suggestedSkills: string[];
  estimatedComplexity: string;
}

function buildPrompt(input: ClaudeAnalysisInput): string {
  const answersText = input.ticket.answers
    .map(a => `Q: ${a.question}\nA: ${a.answer}`)
    .join('\n\n');

  const engineersText = input.engineers
    .map(e => {
      const skills = e.skills.map(s => `${s.name} (${s.proficiency}/5)`).join(', ');
      const expertise = e.productExpertise.map(pe =>
        `${pe.productName}/${pe.categoryName} (${pe.level}/5)`
      ).join(', ');
      return `- ${e.name} (${e.location}): Workload ${e.currentWorkload}/${e.maxWorkload}, Skills: [${skills}], Expertise: [${expertise}]`;
    })
    .join('\n');

  return `You are a technical support ticket analyzer for a technology company. Analyze the following support ticket and recommend the best engineer to handle it.

## Ticket Information
- **Product**: ${input.ticket.productName} (${input.ticket.productModel})
- **Category**: ${input.ticket.categoryName}
- **Subject**: ${input.ticket.subject}
- **Description**: ${input.ticket.description}

## Customer Questionnaire Responses
${answersText}

## Available Engineers
${engineersText}

## Instructions
Analyze this ticket and respond with a JSON object (no markdown, just pure JSON) containing:
1. **classification**: A brief technical classification of the issue
2. **severity**: One of "low", "medium", "high", "critical" based on impact
3. **rootCauseHypothesis**: Your best guess at the root cause
4. **recommendedEngineerId**: The ID of the best-suited engineer
5. **recommendedEngineerName**: Their name
6. **confidence**: A number 0-1 indicating your confidence in the recommendation
7. **reasoning**: Why you chose this engineer (consider skills, expertise, workload, and location)
8. **suggestedSkills**: Array of skill names most relevant to this issue
9. **estimatedComplexity**: One of "low", "medium", "high"

Consider these factors for engineer selection:
- Product and category expertise (highest weight)
- Relevant technical skills
- Current workload (prefer less loaded engineers)
- Availability (must be under max workload)`;
}

function gatherAnalysisInput(ticketId: number): ClaudeAnalysisInput | null {
  const db = getDb();

  const ticket = db.prepare(`
    SELECT t.subject, t.description, p.name as product_name, p.model as product_model,
           pc.name as category_name, t.product_id, t.category_id
    FROM tickets t
    JOIN products p ON t.product_id = p.id
    JOIN product_categories pc ON t.category_id = pc.id
    WHERE t.id = ?
  `).get(ticketId) as any;

  if (!ticket) return null;

  const answers = db.prepare(`
    SELECT qt.question_text, ta.answer
    FROM ticket_answers ta
    JOIN question_templates qt ON ta.question_template_id = qt.id
    WHERE ta.ticket_id = ?
    ORDER BY qt.display_order
  `).all(ticketId) as any[];

  const engineers = db.prepare(`
    SELECT * FROM engineers WHERE is_active = 1 AND current_workload < max_workload
  `).all() as any[];

  const enrichedEngineers = engineers.map((e: any) => {
    const skills = db.prepare(`
      SELECT s.name, es.proficiency
      FROM engineer_skills es
      JOIN skills s ON es.skill_id = s.id
      WHERE es.engineer_id = ?
    `).all(e.id) as any[];

    const expertise = db.prepare(`
      SELECT p.name as product_name, COALESCE(pc.name, 'General') as category_name, epe.expertise_level as level
      FROM engineer_product_expertise epe
      JOIN products p ON epe.product_id = p.id
      LEFT JOIN product_categories pc ON epe.category_id = pc.id
      WHERE epe.engineer_id = ?
    `).all(e.id) as any[];

    return {
      id: e.id,
      name: e.name,
      location: e.location,
      currentWorkload: e.current_workload,
      maxWorkload: e.max_workload,
      skills: skills.map((s: any) => ({ name: s.name, proficiency: s.proficiency })),
      productExpertise: expertise.map((pe: any) => ({
        productName: pe.product_name,
        categoryName: pe.category_name,
        level: pe.level,
      })),
    };
  });

  return {
    ticket: {
      subject: ticket.subject,
      description: ticket.description,
      productName: ticket.product_name,
      productModel: ticket.product_model,
      categoryName: ticket.category_name,
      answers: answers.map((a: any) => ({ question: a.question_text, answer: a.answer })),
    },
    engineers: enrichedEngineers,
  };
}

export async function analyzeTicket(ticketId: number): Promise<ClaudeAnalysisResult | null> {
  const input = gatherAnalysisInput(ticketId);
  if (!input) return null;

  if (input.engineers.length === 0) {
    console.log('[Claude] No available engineers for assignment');
    return null;
  }

  const prompt = buildPrompt(input);

  try {
    console.log(`[Claude] Sending analysis request for ticket ${ticketId}...`);

    const response = await fetch(`${config.claudeServerUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.claudeModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude server returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as any;
    const content = data.content?.[0]?.text || data.message?.content || data.text || '';

    // Extract JSON from response (handle possible markdown wrapping)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    const result = JSON.parse(jsonMatch[0]) as ClaudeAnalysisResult;
    console.log(`[Claude] Analysis complete. Confidence: ${result.confidence}, Recommended: ${result.recommendedEngineerName}`);
    return result;
  } catch (error) {
    console.error('[Claude] Analysis failed:', error);
    return null;
  }
}
