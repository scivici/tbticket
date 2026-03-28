import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { query, queryOne, queryAll } from '../db/connection';
import { getSettings } from './settings.service';

interface ClaudeAnalysisInput {
  ticket: {
    subject: string;
    description: string;
    productName: string;
    productModel: string;
    categoryName: string;
    answers: { question: string; answer: string }[];
    attachments: { originalName: string; mimeType: string; path: string }[];
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

async function getClaudeConfig() {
  const s = await getSettings('claude_');
  return {
    serverUrl: s['claude_server_url'] || config.claudeServerUrl,
    authType: s['claude_auth_type'] || 'basic',
    authValue: s['claude_auth_value'] || `${config.claudeUser}:${config.claudePass}`,
    model: s['claude_model'] || config.claudeModel,
    autoAssignThreshold: parseFloat(s['claude_auto_assign_threshold'] || String(config.autoAssignThreshold)),
  };
}

function getAuthHeader(authType: string, authValue: string): Record<string, string> {
  if (!authValue) return {};
  switch (authType) {
    case 'basic':
      return { 'Authorization': `Basic ${Buffer.from(authValue).toString('base64')}` };
    case 'bearer':
      return { 'Authorization': `Bearer ${authValue}` };
    case 'api-key':
      return { 'x-api-key': authValue, 'anthropic-version': '2023-06-01' };
    default:
      return {};
  }
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

  const attachmentsList = input.ticket.attachments.length > 0
    ? `\n## Attached Files\n${input.ticket.attachments.map(a => `- ${a.originalName} (${a.mimeType})`).join('\n')}\nNote: File contents are included in the message if they are text-based or images.`
    : '';

  return `You are a technical support ticket analyzer for TelcoBridges, a telecom equipment company. Analyze the following support ticket and recommend the best engineer to handle it.

## Ticket Information
- **Product**: ${input.ticket.productName} (${input.ticket.productModel})
- **Category**: ${input.ticket.categoryName}
- **Subject**: ${input.ticket.subject}
- **Description**: ${input.ticket.description}

## Customer Questionnaire Responses
${answersText}
${attachmentsList}

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
10. **shouldEscalateToJira**: true/false - whether this issue should be escalated to Jira for the engineering/development team
11. **escalationReason**: If shouldEscalateToJira is true, explain why (e.g., "Likely a software bug requiring code fix", "Feature request", "Hardware defect requiring RMA")
12. **suggestedAction**: One of "support_can_resolve", "needs_jira_escalation", "needs_working_session", "needs_rma" - the recommended next action

Consider these factors for engineer selection:
- Product and category expertise (highest weight)
- Relevant technical skills
- Current workload (prefer less loaded engineers)
- Availability (must be under max workload)

Escalate to Jira when:
- The issue appears to be a software bug or regression
- A code fix or firmware update is needed
- The issue cannot be resolved through configuration or troubleshooting
- It's a feature request or enhancement`;
}

function buildMessageContent(input: ClaudeAnalysisInput): any[] {
  const content: any[] = [];

  // Add text prompt
  content.push({ type: 'text', text: buildPrompt(input) });

  // Add file contents where possible
  for (const att of input.ticket.attachments) {
    try {
      const filePath = att.path;
      if (!fs.existsSync(filePath)) continue;

      // Text-based files: include content directly
      if (att.mimeType.startsWith('text/') || att.mimeType === 'application/json' ||
          att.originalName.endsWith('.log') || att.originalName.endsWith('.cfg') ||
          att.originalName.endsWith('.conf') || att.originalName.endsWith('.pcap.txt')) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const truncated = fileContent.length > 10000 ? fileContent.substring(0, 10000) + '\n... [truncated]' : fileContent;
        content.push({
          type: 'text',
          text: `\n--- File: ${att.originalName} ---\n${truncated}\n--- End of file ---`,
        });
      }
      // Images: include as base64
      else if (att.mimeType.startsWith('image/') && ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(att.mimeType)) {
        const fileBuffer = fs.readFileSync(filePath);
        // Only include images under 5MB
        if (fileBuffer.length < 5 * 1024 * 1024) {
          const base64 = fileBuffer.toString('base64');
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: att.mimeType,
              data: base64,
            },
          });
        }
      }
    } catch (err) {
      console.warn(`[Claude] Could not read attachment ${att.originalName}:`, err);
    }
  }

  return content;
}

async function gatherAnalysisInput(ticketId: number): Promise<ClaudeAnalysisInput | null> {
  const ticket = await queryOne<any>(`
    SELECT t.subject, t.description, p.name as product_name, p.model as product_model,
           pc.name as category_name, t.product_id, t.category_id
    FROM tickets t
    JOIN products p ON t.product_id = p.id
    JOIN product_categories pc ON t.category_id = pc.id
    WHERE t.id = ?
  `, [ticketId]);

  if (!ticket) return null;

  const answers = await queryAll<any>(`
    SELECT qt.question_text, ta.answer
    FROM ticket_answers ta
    JOIN question_templates qt ON ta.question_template_id = qt.id
    WHERE ta.ticket_id = ?
    ORDER BY qt.display_order
  `, [ticketId]);

  const attachments = await queryAll<any>(`
    SELECT original_name, mime_type, path FROM ticket_attachments WHERE ticket_id = ?
  `, [ticketId]);

  const engineers = await queryAll<any>(`
    SELECT * FROM engineers WHERE is_active = TRUE AND current_workload < max_workload
  `);

  const enrichedEngineers = [];
  for (const e of engineers) {
    const skills = await queryAll<any>(`
      SELECT s.name, es.proficiency
      FROM engineer_skills es JOIN skills s ON es.skill_id = s.id
      WHERE es.engineer_id = ?
    `, [e.id]);

    const expertise = await queryAll<any>(`
      SELECT p.name as product_name, COALESCE(pc.name, 'General') as category_name, epe.expertise_level as level
      FROM engineer_product_expertise epe
      JOIN products p ON epe.product_id = p.id
      LEFT JOIN product_categories pc ON epe.category_id = pc.id
      WHERE epe.engineer_id = ?
    `, [e.id]);

    enrichedEngineers.push({
      id: e.id, name: e.name, location: e.location,
      currentWorkload: e.current_workload, maxWorkload: e.max_workload,
      skills: skills.map((s: any) => ({ name: s.name, proficiency: s.proficiency })),
      productExpertise: expertise.map((pe: any) => ({ productName: pe.product_name, categoryName: pe.category_name, level: pe.level })),
    });
  }

  return {
    ticket: {
      subject: ticket.subject, description: ticket.description,
      productName: ticket.product_name, productModel: ticket.product_model,
      categoryName: ticket.category_name,
      answers: answers.map((a: any) => ({ question: a.question_text, answer: a.answer })),
      attachments: attachments.map((a: any) => ({ originalName: a.original_name, mimeType: a.mime_type, path: a.path })),
    },
    engineers: enrichedEngineers,
  };
}

export async function getAutoAssignThreshold(): Promise<number> {
  const claudeConfig = await getClaudeConfig();
  return claudeConfig.autoAssignThreshold;
}

export async function analyzeTicket(ticketId: number): Promise<ClaudeAnalysisResult | null> {
  const input = await gatherAnalysisInput(ticketId);
  if (!input) return null;

  if (input.engineers.length === 0) {
    console.log('[Claude] No available engineers for assignment');
    return null;
  }

  const claudeConfig = await getClaudeConfig();
  const messageContent = buildMessageContent(input);

  if (!claudeConfig.serverUrl) {
    console.log('[Claude] No server URL configured, skipping analysis');
    return null;
  }

  try {
    // Determine endpoint: if using api-key auth, use Anthropic API format
    const isAnthropicApi = claudeConfig.authType === 'api-key';
    const endpoint = isAnthropicApi
      ? `${claudeConfig.serverUrl}/v1/messages`
      : `${claudeConfig.serverUrl}/api/chat`;

    console.log(`[Claude] Sending analysis request for ticket ${ticketId} to ${endpoint}...`);
    console.log(`[Claude] Model: ${claudeConfig.model}, Auth: ${claudeConfig.authType}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...getAuthHeader(claudeConfig.authType, claudeConfig.authValue),
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: claudeConfig.model,
        messages: [{ role: 'user', content: messageContent }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude server returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as any;
    const content = data.content?.[0]?.text || data.message?.content || data.text || '';

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
