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
import path from 'path';
import http from 'http';
import { getSettings } from './settings.service';
import { config } from '../config';
import type { ClaudeAnalysisResult } from './claude.service';

/**
 * Make an HTTP request with no socket timeout (supports long-running analyses).
 * Node.js fetch has an implicit ~300s TCP timeout that cannot be overridden.
 */
function httpPost(url: string, body: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 0, // no timeout
    }, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 500, body: data }));
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('Request timeout')); });

    // Disable socket timeout completely for long-running analyses
    req.on('socket', (socket) => {
      socket.setTimeout(0);
      socket.setKeepAlive(true, 30000); // send keepalive every 30s
    });

    req.write(body);
    req.end();
  });
}

interface WrapperConfig {
  url: string;       // e.g. http://claude-support-2.telcobridges.lan:4002
  authToken: string;
  timeout: number;   // ms
}

async function getWrapperConfig(): Promise<WrapperConfig> {
  const s = await getSettings('claude_wrapper_');
  return {
    url: s['claude_wrapper_url'] || 'http://host.docker.internal:4002',
    authToken: s['claude_wrapper_auth_token'] || 'tb-claude-wrapper-secret',
    timeout: parseInt(s['claude_wrapper_timeout'] || '0'), // 0 = no timeout (analyses can take 30+ min)
  };
}

/**
 * Convert container file path to host path for shared filesystem access.
 * Container: /app/server/uploads/uuid.ext → Host: /home/support/incoming/uploads/uuid.ext
 */
function toHostPath(containerPath: string): string | null {
  if (!config.uploadHostPath) return null;
  const filename = path.basename(containerPath);
  return path.posix.join(config.uploadHostPath, filename);
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
  const wrapperConfig = await getWrapperConfig();

  if (!wrapperConfig.url) {
    return { success: false, analysis: null, rawOutput: '', error: 'Wrapper URL not configured' };
  }

  try {
    const useSharedFs = !!config.uploadHostPath;
    let payload: any;

    if (useSharedFs) {
      // Shared filesystem mode: send file paths instead of base64 content
      const filePaths = [];
      for (const att of input.attachments) {
        const hostPath = toHostPath(att.localPath);
        if (hostPath) {
          filePaths.push({ filename: att.originalName, hostPath });
          console.log(`[Wrapper] Shared path: ${att.originalName} → ${hostPath}`);
        }
      }

      payload = {
        ticketNumber: input.ticketNumber,
        subject: input.subject,
        description: input.description,
        productName: input.productName,
        productModel: input.productModel,
        categoryName: input.categoryName,
        productKey: input.productKey,
        answers: input.answers,
        engineers: input.engineers,
        attachments: [],       // empty — no base64 transfer
        filePaths,             // host paths for shared filesystem
      };
      console.log(`[Wrapper] Using shared filesystem mode (${filePaths.length} files via path reference)`);
    } else {
      // Legacy mode: base64 encode attachments over HTTP
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

      payload = {
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
      console.log(`[Wrapper] Using legacy base64 mode (${encodedAttachments.length} files encoded)`);
    }

    const endpoint = `${wrapperConfig.url}/analyze`;
    console.log(`[Wrapper] Sending analysis request to ${endpoint} for ticket ${input.ticketNumber}...`);

    const jsonBody = JSON.stringify(payload);
    const httpResponse = await httpPost(endpoint, jsonBody, {
      'Content-Type': 'application/json',
      'x-auth-token': wrapperConfig.authToken,
    });

    if (httpResponse.status >= 400) {
      throw new Error(`Wrapper returned ${httpResponse.status}: ${httpResponse.body}`);
    }

    const data = JSON.parse(httpResponse.body) as any;

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
      console.error(`[Wrapper] Analysis failed for ${input.ticketNumber}:`, error.message);
    return { success: false, analysis: null, rawOutput: '', error: error.message };
  }
}

/**
 * Cleanup ticket files on the wrapper server after analysis
 */
export async function cleanupWrapperFiles(ticketNumber: string): Promise<void> {
  const wrapperConfig = await getWrapperConfig();
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
