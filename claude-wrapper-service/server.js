/**
 * Claude Code CLI Wrapper Service
 *
 * Runs on the Claude Code server (claude-support-2.telcobridges.lan:4002)
 * Accepts ticket analysis requests via HTTP and invokes Claude Code CLI.
 *
 * Claude Code runs from the toolpack repository with full access to:
 *   - CLAUDE.md project configuration and rules
 *   - bmad_docs/ documentation (project-context, log-analysis, component inventories)
 *   - Read-only toolpack source code repository (updated daily from trunk)
 *   - Analysis tools: gdb, addr2line, objdump, readelf, nm, strings, etc.
 *   - Uploaded ticket attachments via shared filesystem
 *
 * Environment aligns with the support team CLAUDE.md:
 *   - Uploaded files at /home/support/incoming/
 *   - Archive extraction to /tmp/
 *   - Read-only shell commands (no network tools, no sudo, no write tools)
 *
 * Deploy: Copy this folder to the Claude server, npm install, npm start
 */

const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
app.use(express.json({ limit: '50mb' }));

// --- Configuration ---
const PORT = process.env.WRAPPER_PORT || 4002;
const TICKETS_DIR = process.env.TICKETS_DIR || '/home/support/incoming/tickets';
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const CLAUDE_PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || '/opt/claude-support/repos/tb';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'tb-claude-wrapper-secret'; // Change in production
const ANALYSIS_TIMEOUT = parseInt(process.env.ANALYSIS_TIMEOUT || '0'); // 0 = no timeout (complex analyses can take 30+ min)

// Allowed tools — mirrors the support team settings.json permissions
// Claude Code will use these tools iteratively (multi-turn) to analyze files
const ALLOWED_TOOLS = process.env.ALLOWED_TOOLS || [
  'Read', 'Grep', 'Glob',
  // File inspection
  'Bash(cat:*)', 'Bash(head:*)', 'Bash(tail:*)', 'Bash(wc:*)',
  'Bash(file:*)', 'Bash(strings:*)', 'Bash(hexdump:*)', 'Bash(od:*)',
  // Search and text processing
  'Bash(grep:*)', 'Bash(zgrep:*)', 'Bash(zcat:*)',
  'Bash(sort:*)', 'Bash(sed:*)', 'Bash(awk:*)',
  'Bash(uniq:*)', 'Bash(cut:*)', 'Bash(tr:*)', 'Bash(diff:*)',
  // Directory and file listing
  'Bash(ls:*)', 'Bash(find:*)', 'Bash(du:*)', 'Bash(stat:*)',
  // Archive extraction (to /tmp)
  'Bash(tar:*)', 'Bash(gunzip:*)',
  'Bash(mkdir:*)', 'Bash(mkdir -p /tmp/*)', 'Bash(mkdir /tmp/*)',
  'Bash(cp:*)', 'Bash(rm:*)',
  // Binary analysis and debugging
  'Bash(gdb:*)', 'Bash(addr2line:*)', 'Bash(objdump:*)',
  'Bash(readelf:*)', 'Bash(nm:*)',
  // Log and data analysis
  'Bash(date:*)', 'Bash(basename:*)', 'Bash(dirname:*)',
  'Bash(tee:*)', 'Bash(xargs:*)', 'Bash(echo:*)',
  'Bash(for:*)', 'Bash(for *)',
  // TelcoBridges tools (if available)
  'Bash(tbconfig:*)', 'Bash(tbstatus:*)',
  // MCP tools
  'mcp__tb-log-tools__list_logs', 'mcp__tb-log-tools__merge_logs',
].join(',');

// --- File upload for attachments ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const ticketDir = path.join(TICKETS_DIR, req.params.ticketNumber || 'unknown');
    fs.mkdirSync(ticketDir, { recursive: true });
    cb(null, ticketDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

// --- Auth middleware ---
function authenticate(req, res, next) {
  const token = req.headers['x-auth-token'] || req.headers['authorization']?.replace('Bearer ', '');
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// --- Health check ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'claude-analysis-wrapper', timestamp: new Date().toISOString() });
});

// --- Main analysis endpoint ---
app.post('/analyze', authenticate, async (req, res) => {
  const {
    ticketNumber,
    subject,
    description,
    productName,
    productModel,
    categoryName,
    productKey,
    answers = [],
    engineers = [],
    attachments = []    // Array of { filename, content (base64) }
  } = req.body;

  const filePaths = req.body.filePaths || [];  // Shared filesystem mode

  if (!ticketNumber || !subject) {
    return res.status(400).json({ error: 'ticketNumber and subject are required' });
  }

  const ticketDir = path.join(TICKETS_DIR, ticketNumber);
  const tmpDir = `/tmp/${ticketNumber}`;
  console.log(`[Analyze] Ticket ${ticketNumber} — ${subject}`);

  try {
    // Step 1: Prepare attachments
    fs.mkdirSync(ticketDir, { recursive: true });

    const savedFiles = [];

    if (filePaths.length > 0) {
      // Shared filesystem mode: symlink existing files into ticket directory
      for (const fp of filePaths) {
        if (fp.hostPath && fp.filename && fs.existsSync(fp.hostPath)) {
          const linkPath = path.join(ticketDir, fp.filename);
          // Remove existing symlink/file if present
          try { fs.unlinkSync(linkPath); } catch { /* doesn't exist */ }
          try {
            fs.symlinkSync(fp.hostPath, linkPath);
            savedFiles.push(fp.filename);
            console.log(`[Analyze] Linked: ${fp.filename} → ${fp.hostPath}`);
          } catch (linkErr) {
            // Fallback to copy if symlink fails (e.g. cross-device)
            fs.copyFileSync(fp.hostPath, linkPath);
            savedFiles.push(fp.filename);
            console.log(`[Analyze] Copied (symlink failed): ${fp.filename} from ${fp.hostPath}`);
          }
        } else if (fp.hostPath) {
          console.warn(`[Analyze] Shared file not found: ${fp.hostPath}`);
        }
      }
      console.log(`[Analyze] Shared filesystem mode: ${savedFiles.length} files linked`);
    } else {
      // Legacy base64 mode: decode and write attachments to disk
      for (const att of attachments) {
        if (att.filename && att.content) {
          const filePath = path.join(ticketDir, att.filename);
          fs.writeFileSync(filePath, Buffer.from(att.content, 'base64'));
          savedFiles.push(att.filename);
          console.log(`[Analyze] Saved attachment: ${att.filename}`);
        }
      }
    }

    // Step 2: Write ticket context file
    const contextFile = path.join(ticketDir, '_ticket_context.md');
    const answersText = answers.map(a => `**Q:** ${a.question}\n**A:** ${a.answer}`).join('\n\n');
    const engineersText = engineers.map(e =>
      `- **${e.name}** (ID: ${e.id}): Skills [${e.skills}], Expertise [${e.expertise}], Workload: ${e.workload}`
    ).join('\n');
    const filesText = savedFiles.length > 0
      ? `## Attached Files\nFiles are located at: ${ticketDir}/\n${savedFiles.map(f => `- ${ticketDir}/${f}`).join('\n')}`
      : 'No attachments.';

    const contextContent = `# Support Ticket: ${ticketNumber}

## Product
- **Name:** ${productName || 'N/A'} (${productModel || 'N/A'})
- **Category:** ${categoryName || 'N/A'}
${productKey ? `- **Serial/License Key:** ${productKey}` : ''}

## Subject
${subject}

## Customer Description
${description || 'No description provided.'}

## Questionnaire Responses
${answersText || 'No questionnaire responses.'}

${filesText}

## Available Engineers
${engineersText || 'No engineers available.'}
`;
    fs.writeFileSync(contextFile, contextContent);

    // Step 3: Build the Claude CLI prompt
    // This prompt works in conjunction with the project CLAUDE.md which provides
    // detailed rules about the environment, available resources, and analysis approach.
    const prompt = `You are performing first-line triage for a TelcoBridges support ticket.
Your analysis will be read by support engineers and potentially shared with the customer.

IMPORTANT: Take your time. Use tools iteratively — read files, analyze what you find, then dig deeper.
Do NOT rush to produce output. Analyze as thoroughly as you would in an interactive support session.

## Your Task

1. Read the ticket context at: ${ticketDir}/_ticket_context.md
2. Analyze ALL attached files in ${ticketDir}/ — extract archives to ${tmpDir}/ first if needed:
   \`mkdir -p ${tmpDir} && tar xzf <file> -C ${tmpDir}\`
3. For EVERY file you find, read it and analyze it:
   - Log files: search for errors (TBLV0), warnings (TBLV1), crashes, anomalies. Quote exact lines.
   - pcap files: use \`strings\` and \`hexdump\` to extract SIP messages, look at SDP bodies for codec/ptime/IP info, identify RTP streams from headers
   - Config files: check for misconfigurations
   - Core dumps: use gdb if available
   - tbreport contents: examine ALL files in the extracted archive
4. Cross-reference with bmad_docs/ and source code — grep for error messages, read relevant components
5. Select the best engineer from the list in the ticket context

## Analysis Approach — Work like an expert support engineer

- Read each file multiple times if needed — first scan for obvious issues, then deep dive
- For pcap files: extract SIP INVITE/200OK messages with \`strings <file> | grep -A20 "INVITE sip:\\|SIP/2.0 200\\|Content-Type: application/sdp" \` to find SDP negotiation details (codecs, ptime, IPs, ports)
- For pcap files: look for RTP analysis clues — \`hexdump -C <file> | grep -c "80 00\\|80 08\\|80 12"\` to estimate packet counts by codec
- Compare good vs bad captures if both are provided
- Look for ptime mismatches, codec mismatches, NAT issues, one-way media paths
- Consult bmad_docs/project-context.md and relevant component docs
- If you find something interesting, investigate further — read source code to understand the behavior

## Cite Your Sources
For EVERY finding: quote the exact evidence (log line, SDP body, config value) and where you found it.
Mark inferences explicitly: "Based on [evidence], this suggests [inference]"

## Output Format
After completing your full analysis, produce your final answer as a JSON object.
No markdown fences around the JSON. The JSON must be the very last thing you output.

{
  "classification": "Specific technical classification of the issue",
  "severity": "low|medium|high|critical",
  "rootCauseHypothesis": "Detailed root cause with evidence citations",
  "recommendedEngineerId": <ID>,
  "recommendedEngineerName": "<name>",
  "confidence": <0.0 to 1.0>,
  "reasoning": "Why this engineer, citing their specific skills match",
  "suggestedSkills": ["skill1", "skill2"],
  "estimatedComplexity": "low|medium|high",
  "suggestedActions": ["Specific step 1", "Step 2", "..."],
  "fullReport": "DETAILED technical report with sections: Summary, Evidence Found (with exact quotes), Architecture Context (citing bmad_docs), Root Cause Analysis (observations vs inferences), Impact Assessment, Recommended Actions, Escalation Notes"
}`;

    // Step 4: Execute Claude Code CLI (from project dir so CLAUDE.md is loaded)
    console.log(`[Analyze] Running Claude Code CLI for ${ticketNumber} (cwd: ${CLAUDE_PROJECT_DIR})...`);
    const startTime = Date.now();

    const result = await runClaude(prompt, CLAUDE_PROJECT_DIR);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Analyze] Claude finished in ${elapsed}s for ${ticketNumber}`);

    // Step 5: Cleanup /tmp extraction directory
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        console.log(`[Analyze] Cleaned up ${tmpDir}`);
      }
    } catch { /* ignore cleanup errors */ }

    if (!result.success) {
      console.error(`[Analyze] CLI failed: ${result.error}`);
      return res.status(500).json({
        error: 'Claude analysis failed',
        detail: result.error,
        stderr: result.stderr,
      });
    }

    // Step 6: Parse response
    const parsed = parseClaudeOutput(result.output);

    if (parsed) {
      console.log(`[Analyze] Success — confidence: ${parsed.confidence}, engineer: ${parsed.recommendedEngineerName}`);
      return res.json({
        success: true,
        analysis: parsed,
        rawOutput: result.output,
        executionTimeSeconds: parseFloat(elapsed),
      });
    } else {
      // Couldn't parse structured JSON, return raw output
      console.warn(`[Analyze] Could not parse structured JSON, returning raw output`);
      return res.json({
        success: true,
        analysis: null,
        rawOutput: result.output,
        executionTimeSeconds: parseFloat(elapsed),
      });
    }

  } catch (error) {
    console.error(`[Analyze] Error for ${ticketNumber}:`, error.message);
    return res.status(500).json({ error: 'Internal server error', detail: error.message });
  }
});

// --- Upload endpoint (alternative: send files separately) ---
app.post('/upload/:ticketNumber', authenticate, upload.array('files', 10), (req, res) => {
  const files = req.files || [];
  console.log(`[Upload] ${files.length} files saved for ticket ${req.params.ticketNumber}`);
  res.json({
    success: true,
    ticketNumber: req.params.ticketNumber,
    files: files.map(f => f.originalname),
  });
});

// --- List analyzed tickets ---
app.get('/tickets', authenticate, (req, res) => {
  try {
    if (!fs.existsSync(TICKETS_DIR)) {
      return res.json({ tickets: [] });
    }
    const dirs = fs.readdirSync(TICKETS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        const contextPath = path.join(TICKETS_DIR, d.name, '_ticket_context.md');
        return {
          ticketNumber: d.name,
          hasContext: fs.existsSync(contextPath),
          files: fs.readdirSync(path.join(TICKETS_DIR, d.name)).filter(f => f !== '_ticket_context.md'),
        };
      });
    res.json({ tickets: dirs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Cleanup old ticket files ---
app.delete('/tickets/:ticketNumber', authenticate, (req, res) => {
  const ticketDir = path.join(TICKETS_DIR, req.params.ticketNumber);
  if (fs.existsSync(ticketDir)) {
    fs.rmSync(ticketDir, { recursive: true, force: true });
    console.log(`[Cleanup] Removed ${req.params.ticketNumber}`);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Ticket directory not found' });
  }
});

// --- Helper: Run Claude Code CLI ---
function runClaude(prompt, cwd) {
  return new Promise((resolve) => {
    const args = [
      '-p', prompt,
      '--allowedTools', ALLOWED_TOOLS,
      '--output-format', 'json',
    ];

    const proc = execFile(CLAUDE_BIN, args, {
      cwd,
      timeout: ANALYSIS_TIMEOUT,
      maxBuffer: 50 * 1024 * 1024, // 50MB output buffer
      env: { ...process.env, CLAUDE_DISABLE_TELEMETRY: '1' },
    }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          output: stdout || '',
          stderr: stderr || '',
          error: error.message,
        });
      } else {
        resolve({
          success: true,
          output: stdout || '',
          stderr: stderr || '',
          error: null,
        });
      }
    });

    // Close stdin immediately to prevent "no stdin data" warning
    proc.stdin.end();
  });
}

// --- Helper: Parse Claude output ---
function parseClaudeOutput(output) {
  if (!output) return null;

  try {
    // Claude --output-format json wraps output in a JSON envelope
    const envelope = JSON.parse(output);
    const text = envelope?.result || envelope?.content?.[0]?.text || envelope?.text || output;

    // Try parsing the inner text as JSON
    try {
      return JSON.parse(text);
    } catch {
      // Look for JSON block in the text
      const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*"classification"[\s\S]*\})/);
      if (jsonMatch) {
        return JSON.parse((jsonMatch[1] || jsonMatch[0]).trim());
      }
    }
  } catch {
    // Output wasn't a JSON envelope, try direct parse
    try {
      return JSON.parse(output);
    } catch {
      const jsonMatch = output.match(/```json\s*([\s\S]*?)```/) || output.match(/(\{[\s\S]*"classification"[\s\S]*\})/);
      if (jsonMatch) {
        try {
          return JSON.parse((jsonMatch[1] || jsonMatch[0]).trim());
        } catch { /* give up */ }
      }
    }
  }

  return null;
}

// --- Start server ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=== Claude Analysis Wrapper Service ===`);
  console.log(`Port:         ${PORT}`);
  console.log(`Tickets dir:  ${TICKETS_DIR}`);
  console.log(`Project dir:  ${CLAUDE_PROJECT_DIR}`);
  console.log(`Claude bin:   ${CLAUDE_BIN}`);
  console.log(`Timeout:      ${ANALYSIS_TIMEOUT / 1000}s`);
  console.log(`========================================\n`);
});
