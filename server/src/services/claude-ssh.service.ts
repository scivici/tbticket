import { Client } from 'ssh2';
import SftpClient from 'ssh2-sftp-client';
import fs from 'fs';
import path from 'path';
import { getSettings } from './settings.service';
import { config } from '../config';

interface SshConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  remotePath: string;
}

function getSshConfig(): SshConfig {
  const s = getSettings('claude_ssh_');
  return {
    host: s['claude_ssh_host'] || 'claude-support-2.telcobridges.lan',
    port: parseInt(s['claude_ssh_port'] || '22'),
    username: s['claude_ssh_user'] || 'support',
    password: s['claude_ssh_pass'] || 'support',
    remotePath: s['claude_ssh_remote_path'] || '/home/support/tickets',
  };
}

/**
 * Upload ticket files to Claude server via SFTP.
 * Creates /home/support/tickets/{ticketNumber}/ and uploads all files.
 */
export async function uploadFilesToClaude(
  ticketNumber: string,
  localFiles: { localPath: string; filename: string }[]
): Promise<{ success: boolean; remotePath: string; error?: string }> {
  const cfg = getSshConfig();
  if (!cfg.host) {
    return { success: false, remotePath: '', error: 'SSH host not configured' };
  }

  const sftp = new SftpClient();
  const remoteDir = `${cfg.remotePath}/${ticketNumber}`;

  try {
    console.log(`[SFTP] Connecting to ${cfg.host}:${cfg.port} as ${cfg.username}...`);
    await sftp.connect({
      host: cfg.host,
      port: cfg.port,
      username: cfg.username,
      password: cfg.password,
    });

    // Create ticket directory
    const dirExists = await sftp.exists(remoteDir);
    if (!dirExists) {
      await sftp.mkdir(remoteDir, true);
    }

    // Upload each file
    for (const file of localFiles) {
      if (fs.existsSync(file.localPath)) {
        const remotefile = `${remoteDir}/${file.filename}`;
        console.log(`[SFTP] Uploading ${file.filename} → ${remotefile}`);
        await sftp.put(file.localPath, remotefile);
      } else {
        console.warn(`[SFTP] Local file not found: ${file.localPath}`);
      }
    }

    console.log(`[SFTP] Upload complete: ${localFiles.length} files → ${remoteDir}`);
    await sftp.end();
    return { success: true, remotePath: remoteDir };
  } catch (error: any) {
    console.error('[SFTP] Upload failed:', error.message);
    try { await sftp.end(); } catch {}
    return { success: false, remotePath: remoteDir, error: error.message };
  }
}

/**
 * Run Claude Code CLI on the remote server via SSH.
 * Sends a prompt and captures the output.
 */
export async function runClaudeAnalysis(
  ticketNumber: string,
  prompt: string
): Promise<{ success: boolean; output: string; error?: string }> {
  const cfg = getSshConfig();
  if (!cfg.host) {
    return { success: false, output: '', error: 'SSH host not configured' };
  }

  return new Promise((resolve) => {
    const conn = new Client();
    let output = '';
    let errorOutput = '';
    const timeout = setTimeout(() => {
      conn.end();
      resolve({ success: false, output, error: 'SSH command timed out (5 min)' });
    }, 300000); // 5 min timeout

    conn.on('ready', () => {
      console.log(`[SSH] Connected to ${cfg.host}, running Claude Code for ${ticketNumber}...`);

      // Use claude CLI with --print flag for non-interactive output
      // cd to ticket directory first so Claude can see the files
      const remoteDir = `${cfg.remotePath}/${ticketNumber}`;
      const escapedPrompt = prompt.replace(/'/g, "'\\''");
      const command = `cd "${remoteDir}" && claude -p '${escapedPrompt}'`;

      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          conn.end();
          resolve({ success: false, output: '', error: err.message });
          return;
        }

        stream.on('close', (code: number) => {
          clearTimeout(timeout);
          conn.end();
          console.log(`[SSH] Claude Code finished with exit code ${code}`);
          console.log(`[SSH] Output length: ${output.length} chars`);
          resolve({
            success: code === 0,
            output: output.trim(),
            error: code !== 0 ? `Exit code: ${code}. ${errorOutput}` : undefined,
          });
        });

        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timeout);
      console.error('[SSH] Connection error:', err.message);
      resolve({ success: false, output: '', error: err.message });
    });

    console.log(`[SSH] Connecting to ${cfg.host}:${cfg.port}...`);
    conn.connect({
      host: cfg.host,
      port: cfg.port,
      username: cfg.username,
      password: cfg.password,
    });
  });
}

/**
 * Full analysis flow:
 * 1. Upload files via SFTP
 * 2. Build prompt with ticket context
 * 3. Run Claude Code CLI
 * 4. Return the analysis report
 */
export async function analyzeTicketViaSsh(ticket: {
  ticketNumber: string;
  productName: string;
  productModel: string;
  categoryName: string;
  subject: string;
  description: string;
  productKey?: string;
  answers: { question: string; answer: string }[];
  attachments: { localPath: string; filename: string; originalName: string }[];
  engineers: { id: number; name: string; skills: string; expertise: string; workload: string }[];
}): Promise<{ success: boolean; report: string; error?: string }> {

  // Step 1: Upload files
  if (ticket.attachments.length > 0) {
    const uploadResult = await uploadFilesToClaude(
      ticket.ticketNumber,
      ticket.attachments.map(a => ({ localPath: a.localPath, filename: a.originalName }))
    );

    if (!uploadResult.success) {
      console.warn(`[Claude-SSH] File upload failed: ${uploadResult.error}. Continuing with text-only analysis.`);
    }
  }

  // Step 2: Build prompt
  const fileList = ticket.attachments.map(a => a.originalName).join(', ');
  const answersText = ticket.answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n');
  const engineersText = ticket.engineers.map(e =>
    `- ${e.name}: Skills [${e.skills}], Expertise [${e.expertise}], Workload: ${e.workload}`
  ).join('\n');

  const prompt = `You are analyzing a TelcoBridges technical support ticket.

## Ticket: ${ticket.ticketNumber}
- Product: ${ticket.productName} (${ticket.productModel})
- Category: ${ticket.categoryName}
- Subject: ${ticket.subject}
${ticket.productKey ? `- Product Key/Serial: ${ticket.productKey}` : ''}

## Customer Description
${ticket.description}

## Questionnaire Responses
${answersText || 'No questionnaire responses.'}

${ticket.attachments.length > 0 ? `## Attached Files (in current directory)
${fileList}
Please read and analyze these files.` : ''}

## Available Engineers
${engineersText}

## Your Task
1. Analyze the issue thoroughly. If there are log files or config files in the current directory, read and analyze them.
2. Provide a detailed technical analysis report.
3. Identify the root cause or most likely root cause.
4. Recommend which engineer should handle this based on their skills and expertise.
5. Suggest initial troubleshooting steps.

Respond with a structured report in this format:

**Classification:** [brief technical classification]
**Severity:** [low/medium/high/critical]
**Root Cause Analysis:** [detailed analysis]
**Recommended Engineer:** [name and reason]
**Confidence:** [0-1 score]
**Suggested Actions:**
1. [step 1]
2. [step 2]
...

Also include a JSON block at the end:
\`\`\`json
{"classification":"...","severity":"...","rootCauseHypothesis":"...","recommendedEngineerId":N,"recommendedEngineerName":"...","confidence":0.X,"reasoning":"...","suggestedSkills":["..."],"estimatedComplexity":"low|medium|high"}
\`\`\``;

  // Step 3: Run Claude Code
  const result = await runClaudeAnalysis(ticket.ticketNumber, prompt);

  return {
    success: result.success,
    report: result.output,
    error: result.error,
  };
}
