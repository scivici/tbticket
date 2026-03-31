import { getSetting } from './settings.service';

interface JiraIssueData {
  ticketNumber: string;
  subject: string;
  description: string;
  priority: string;
  productName: string;
  categoryName: string;
  customerName: string;
  customerEmail: string;
}

interface JiraCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
}

interface JiraResult {
  success: boolean;
  issueKey?: string;
  issueUrl?: string;
  error?: string;
}

// Cache detected API version per base URL
const apiVersionCache: Record<string, { version: string; ts: number }> = {};

async function detectJiraApiVersion(baseUrl: string, auth: string): Promise<string> {
  const cached = apiVersionCache[baseUrl];
  if (cached && Date.now() - cached.ts < 3600000) return cached.version; // cache 1 hour

  const headers = { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' };

  // Try v3 (Cloud)
  try {
    const res = await fetch(`${baseUrl}/rest/api/3/serverInfo`, { headers });
    if (res.ok) {
      apiVersionCache[baseUrl] = { version: '3', ts: Date.now() };
      console.log(`[Jira] Detected API v3 (Cloud) for ${baseUrl}`);
      return '3';
    }
    console.log(`[Jira] v3 serverInfo returned ${res.status} for ${baseUrl}`);
  } catch (e: any) { console.log(`[Jira] v3 check failed for ${baseUrl}: ${e.message}`); }

  // Try v2 (Server/Data Center)
  try {
    const res = await fetch(`${baseUrl}/rest/api/2/serverInfo`, { headers });
    if (res.ok) {
      const info = await res.json();
      console.log(`[Jira] Detected API v2 (Server) for ${baseUrl} — version: ${info.version || 'unknown'}`);
      apiVersionCache[baseUrl] = { version: '2', ts: Date.now() };
      return '2';
    }
    console.log(`[Jira] v2 serverInfo returned ${res.status} for ${baseUrl}`);
  } catch (e: any) { console.log(`[Jira] v2 check failed for ${baseUrl}: ${e.message}`); }

  // Try /rest/api/latest as last resort
  try {
    const res = await fetch(`${baseUrl}/rest/api/latest/serverInfo`, { headers });
    if (res.ok) {
      console.log(`[Jira] Using API 'latest' for ${baseUrl}`);
      apiVersionCache[baseUrl] = { version: 'latest', ts: Date.now() };
      return 'latest';
    }
    console.log(`[Jira] 'latest' serverInfo returned ${res.status} for ${baseUrl}`);
  } catch (e: any) { console.log(`[Jira] 'latest' check failed for ${baseUrl}: ${e.message}`); }

  console.warn(`[Jira] Could not detect API version for ${baseUrl}, defaulting to v2`);
  apiVersionCache[baseUrl] = { version: '2', ts: Date.now() };
  return '2';
}

const PRIORITY_MAP: Record<string, string> = {
  critical: 'Highest',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/**
 * Resolve Jira credentials: use engineer-specific if available, otherwise fall back to global settings.
 */
export async function resolveJiraCredentials(engineerId?: number): Promise<JiraCredentials | null> {
  if (engineerId) {
    const { queryOne } = await import('../db/connection');
    const eng = await queryOne<any>('SELECT jira_base_url, jira_email, jira_api_token, jira_project_key FROM engineers WHERE id = ?', [engineerId]);
    if (eng?.jira_base_url && eng?.jira_email && eng?.jira_api_token) {
      return {
        baseUrl: eng.jira_base_url,
        email: eng.jira_email,
        apiToken: eng.jira_api_token,
        projectKey: eng.jira_project_key || await getSetting('jira_project_key') || '',
      };
    }
  }
  // Fallback to global settings
  const baseUrl = await getSetting('jira_base_url');
  const email = await getSetting('jira_api_email');
  const token = await getSetting('jira_api_token');
  const projectKey = await getSetting('jira_project_key');
  if (baseUrl && email && token && projectKey) {
    return { baseUrl, email, apiToken: token, projectKey };
  }
  return null;
}

export async function createJiraIssue(data: JiraIssueData, engineerId?: number): Promise<JiraResult> {
  const creds = await resolveJiraCredentials(engineerId);
  if (!creds) {
    return { success: false, error: 'Jira integration not configured. Configure Jira credentials in Setup or in the assigned specialist\'s profile.' };
  }

  const { baseUrl, email, apiToken: token, projectKey } = creds;
  const issueType = await getSetting('jira_issue_type') || 'Bug';

  const base = baseUrl.replace(/\/$/, '');
  const auth = Buffer.from(`${email}:${token}`).toString('base64');

  // Detect Jira version: try v3 (Cloud) first, fall back to v2 (Server/Data Center)
  const apiVersion = await detectJiraApiVersion(base, auth);
  const url = `${base}/rest/api/${apiVersion}/issue`;

  const descriptionText = `Ticket: ${data.ticketNumber}\nProduct: ${data.productName} / ${data.categoryName}\nCustomer: ${data.customerName} (${data.customerEmail})\n\n${data.description}`;

  // API v3 (Cloud) uses ADF format, v2 (Server) uses plain string
  const description = apiVersion === '3'
    ? {
        type: 'doc',
        version: 1,
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: `Ticket: ${data.ticketNumber}` }] },
          { type: 'paragraph', content: [{ type: 'text', text: `Product: ${data.productName} / ${data.categoryName}` }] },
          { type: 'paragraph', content: [{ type: 'text', text: `Customer: ${data.customerName} (${data.customerEmail})` }] },
          { type: 'rule' },
          { type: 'paragraph', content: [{ type: 'text', text: data.description }] },
        ],
      }
    : descriptionText;

  const body = {
    fields: {
      project: { key: projectKey },
      summary: `[${data.ticketNumber}] ${data.subject}`,
      description,
      issuetype: { name: issueType },
      priority: { name: PRIORITY_MAP[data.priority] || 'Medium' },
      labels: ['support-ticket', data.ticketNumber],
    },
  };

  try {
    console.log(`[Jira] Creating issue: POST ${url} (API v${apiVersion}, project: ${projectKey})`);

    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // If v2 also 404s, try latest (some Jira versions use /rest/api/latest)
    if (response.status === 404) {
      const latestUrl = `${base}/rest/api/latest/issue`;
      console.log(`[Jira] v${apiVersion} returned 404, retrying: POST ${latestUrl}`);
      response = await fetch(latestUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Jira] Create issue failed: ${response.status} at ${url}`, errorBody.substring(0, 300));
      return { success: false, error: `Jira API error (${response.status}): ${errorBody.substring(0, 200)}` };
    }

    const result = await response.json();
    const issueKey = result.key;
    const issueUrl = `${baseUrl.replace(/\/$/, '')}/browse/${issueKey}`;

    console.log(`[Jira] Created issue ${issueKey} for ticket ${data.ticketNumber}`);
    return { success: true, issueKey, issueUrl };
  } catch (error: any) {
    console.error('[Jira] Error creating issue:', error);
    return { success: false, error: error.message };
  }
}

export async function isJiraConfigured(engineerId?: number): Promise<boolean> {
  const creds = await resolveJiraCredentials(engineerId);
  return !!creds;
}

export async function getJiraIssueStatus(issueKey: string, engineerId?: number): Promise<{ status: string; summary: string; url: string } | null> {
  const creds = await resolveJiraCredentials(engineerId);
  if (!creds) return null;

  const { baseUrl, email, apiToken: token } = creds;
  const base = baseUrl.replace(/\/$/, '');
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const apiVersion = await detectJiraApiVersion(base, auth);
  const url = `${base}/rest/api/${apiVersion}/issue/${issueKey}?fields=status,summary`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      status: data.fields?.status?.name || 'Unknown',
      summary: data.fields?.summary || '',
      url: `${baseUrl.replace(/\/$/, '')}/browse/${issueKey}`,
    };
  } catch {
    return null;
  }
}
