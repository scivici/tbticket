/**
 * Claude Wrapper Service
 *
 * Calls the Claude Analysis Wrapper HTTP service running on the Claude Code server.
 * This is the recommended integration mode — it gives Claude full access to
 * source code, documentation (bmad_docs/), and analysis tools on the server.
 *
 * Wrapper service endpoint: http://claude-support-2.telcobridges.lan:4002/analyze
 */

import fs from 'fs';
import { getSettings } from './settings.service';
import { config } from '../config';
import type { ClaudeAnalysisResult } from './claude.service';

interface WrapperConfig {
  url: string;       // e.g. http://claude-support-2.telcobridges.lan:4002
  authToken: string;
  timeout: number;   // ms
}

function getWrapperConfig(): WrapperConfig {
  const s = getSettings('claude_wrapper_');
  return {
    url: s['claude_wrapper_url'] || 'http://claude-support-2.telcobridges.lan:4002',
    authToken: s['claude_wrapper_auth_token'] || 'tb-claude-wrapper-secret',
    timeout: parseInt(s['claude_wrapper_timeout'] || '310000'), // slightly above CLI timeout
  };
}

interface WrapperInput {
  ticketNumber: string;
  subject: string;
  description: string;
  productName: string;
  productModel: string;
  categoryName: string;
  productKey?: string;
  answers: { question: string; answer: string }[];
  attachments: { localPath: string; filename: string; originalName: string }[];
  engineers: { id: number; name: string; skills: string; expertise: string; workload: string }[];
}

export interface WrapperResponse {
  success: boolean;
  analysis: ClaudeAnalysisResult | null;
  rawOutput: string;
  executionTimeSeconds?: number;
  error?: string;
}

export async function analyzeTicketViaWrapper(input: WrapperInput): Promise<WrapperResponse> {
  const wrapperConfig = getWrapperConfig();

  if (!wrapperConfig.url) {
    return { success: false, analysis: null, rawOutput: '', error: 'Wrapper URL not configured' };
  }

  try {
    // Encode attachments as base64
    const encodedAttachments = [];
    for (const att of input.attachments) {
      try {
        if (fs.existsSync(att.localPath)) {
          const fileBuffer = fs.readFileSync(att.localPath);
          encodedAttachments.push({
            filename: att.originalName,
            content: fileBuffer.toString('base64'),
          });
          console.log(`[Wrapper] Encoding attachment: ${att.originalName} (${(fileBuffer.length / 1024).toFixed(1)}KB)`);
        }
      } catch (err) {
        console.warn(`[Wrapper] Could not read attachment ${att.originalName}:`, err);
      }
    }

    const payload = {
      ticketNumber: input.ticketNumber,
      subject: input.subject,
      description: input.description,
      productName: input.productName,
      productModel: input.productModel,
      categoryName: input.categoryName,
      productKey: input.productKey,
      answers: input.answers,
      engineers: input.engineers,
      attachments: encodedAttachments,
    };

    const endpoint = `${wrapperConfig.url}/analyze`;
    console.log(`[Wrapper] Sending analysis request to ${endpoint} for ticket ${input.ticketNumber}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), wrapperConfig.timeout);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': wrapperConfig.authToken,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Wrapper returned ${response.status}: ${errorText}`);
    }

    const data = await response.json() as any;

    if (data.success && data.analysis) {
      console.log(`[Wrapper] Analysis complete for ${input.ticketNumber} in ${data.executionTimeSeconds}s`);
      return {
        success: true,
        analysis: data.analysis,
        rawOutput: data.rawOutput || '',
        executionTimeSeconds: data.executionTimeSeconds,
      };
    } else if (data.success && data.rawOutput) {
      // Wrapper returned raw output without parsed analysis
      console.log(`[Wrapper] Got raw output for ${input.ticketNumber}, no structured analysis`);
      return {
        success: true,
        analysis: null,
        rawOutput: data.rawOutput || '',
        executionTimeSeconds: data.executionTimeSeconds,
      };
    } else {
      throw new Error(data.error || 'Unknown wrapper error');
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`[Wrapper] Request timed out for ${input.ticketNumber}`);
      return { success: false, analysis: null, rawOutput: '', error: 'Wrapper request timed out' };
    }
    console.error(`[Wrapper] Analysis failed for ${input.ticketNumber}:`, error.message);
    return { success: false, analysis: null, rawOutput: '', error: error.message };
  }
}

/**
 * Cleanup ticket files on the wrapper server after analysis
 */
export async function cleanupWrapperFiles(ticketNumber: string): Promise<void> {
  const wrapperConfig = getWrapperConfig();
  try {
    await fetch(`${wrapperConfig.url}/tickets/${ticketNumber}`, {
      method: 'DELETE',
      headers: { 'x-auth-token': wrapperConfig.authToken },
    });
    console.log(`[Wrapper] Cleaned up files for ${ticketNumber}`);
  } catch (err) {
    console.warn(`[Wrapper] Cleanup failed for ${ticketNumber}:`, err);
  }
}
