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
  // New Jira-specific fields
  labels?: string[];
  account?: { id: string; name?: string };
  affectedVersion?: string;
  escalationNotes?: string;
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
      const info: any = await res.json();
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

  console.warn(`[Jira] ⚠ Could not detect API version for ${baseUrl} — all serverInfo endpoints failed. Check the Base URL. Defaulting to v2 (NOT cached).`);
  // Do NOT cache failed detection — re-try next time
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

  const base = baseUrl.replace(/\/$/, '');
  const auth = Buffer.from(`${email}:${token}`).toString('base64');

  // Detect Jira version: try v3 (Cloud) first, fall back to v2 (Server/Data Center)
  const apiVersion = await detectJiraApiVersion(base, auth);
  const url = `${base}/rest/api/${apiVersion}/issue`;

  // Determine component: SBC products → SBC, everything else → TMG
  const sbcProducts = ['prosbc', 'freesbc'];
  const componentName = sbcProducts.some(p => data.productName.toLowerCase().includes(p)) ? 'SBC' : 'TMG';

  // Description: use escalation notes if provided, otherwise build from ticket data
  const descText = data.escalationNotes
    ? `${data.escalationNotes}\n\n---\nTicket: ${data.ticketNumber}\nProduct: ${data.productName} / ${data.categoryName}\nCustomer: ${data.customerName} (${data.customerEmail})`
    : `Ticket: ${data.ticketNumber}\nProduct: ${data.productName} / ${data.categoryName}\nCustomer: ${data.customerName} (${data.customerEmail})\n\n${data.description}`;

  // API v3 (Cloud) uses ADF format, v2 (Server) uses plain string
  const description = apiVersion === '3'
    ? {
        type: 'doc',
        version: 1,
        content: descText.split('\n').map(line =>
          line === '---'
            ? { type: 'rule' }
            : { type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] }
        ),
      }
    : descText;

  // Build labels array
  const labels = [...(data.labels || []), 'support-ticket', data.ticketNumber];

  // Build fields
  const fields: any = {
    project: { key: projectKey },
    summary: `[${data.ticketNumber}] ${data.subject}`,
    description,
    issuetype: { name: 'Incident' },
    priority: { name: PRIORITY_MAP[data.priority] || 'Medium' },
    labels,
    components: [{ name: componentName }],
  };

  // Affected version
  if (data.affectedVersion) {
    fields.versions = [{ name: data.affectedVersion }];
  }

  // Account (Tempo custom field) — we need to find the field key via createmeta
  if (data.account?.id) {
    try {
      const headers = { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' };
      const metaRes = await fetch(`${base}/rest/api/${apiVersion}/issue/createmeta?projectKeys=${projectKey}&issuetypeNames=Incident&expand=projects.issuetypes.fields`, { headers });
      if (metaRes.ok) {
        const meta: any = await metaRes.json();
        const issueType = meta.projects?.[0]?.issuetypes?.[0];
        if (issueType?.fields) {
          for (const [key, field] of Object.entries(issueType.fields) as any[]) {
            if (field.name && field.name.toLowerCase().includes('account') && !field.name.toLowerCase().includes('regression')) {
              fields[key] = { id: data.account.id };
              console.log(`[Jira] Mapped Account to field ${key} (${field.name}) = ${data.account.id}`);
              break;
            }
          }
        }
      }
    } catch (e: any) { console.log(`[Jira] Account field mapping failed: ${e.message}`); }
  }

  const body = { fields };

  try {
    console.log(`[Jira] Creating issue: POST ${url} (API v${apiVersion}, project: ${projectKey})`);
    console.log(`[Jira] Request body:`, JSON.stringify(body, null, 2).substring(0, 500));

    const fetchHeaders = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Try multiple API versions: detected → other version → latest
    const urlsToTry = [
      url,
      `${base}/rest/api/${apiVersion === '3' ? '2' : '3'}/issue`,
      `${base}/rest/api/latest/issue`,
    ];

    let response: Response | null = null;
    let lastUrl = url;

    for (const tryUrl of urlsToTry) {
      console.log(`[Jira] Trying: POST ${tryUrl}`);
      response = await fetch(tryUrl, {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify(body),
      });
      lastUrl = tryUrl;

      if (response.status !== 404) break;
      console.log(`[Jira] ${tryUrl} returned 404, trying next...`);
    }

    if (!response || !response.ok) {
      const errorBody = await response!.text();
      console.error(`[Jira] Create issue failed: ${response!.status} at ${lastUrl}`, errorBody.substring(0, 500));

      // If HTML 404, provide a clearer error message
      if (response!.status === 404 && errorBody.includes('<!DOCTYPE')) {
        return { success: false, error: `Jira API endpoint not found (404). Check that the Jira Base URL is correct (tried: ${lastUrl}). The URL should include any context path (e.g., https://jira.company.com/jira).` };
      }

      return { success: false, error: `Jira API error (${response!.status}): ${errorBody.substring(0, 200)}` };
    }

    const result: any = await response.json();
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

/**
 * Fetch Jira project metadata: labels, components, versions, and accounts (Tempo custom field).
 */
export async function getJiraMetadata(engineerId?: number): Promise<{
  labels: string[];
  components: { id: string; name: string }[];
  versions: { id: string; name: string; released: boolean }[];
  accounts: { id: string; name: string }[];
} | null> {
  const creds = await resolveJiraCredentials(engineerId);
  if (!creds) return null;

  const { baseUrl, email, apiToken: token, projectKey } = creds;
  const base = baseUrl.replace(/\/$/, '');
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const apiVersion = await detectJiraApiVersion(base, auth);
  const headers = { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' };

  const results = { labels: [] as string[], components: [] as any[], versions: [] as any[], accounts: [] as any[] };

  // Fetch labels — try multiple endpoints (Cloud vs Server differ)
  try {
    let res = await fetch(`${base}/rest/api/${apiVersion}/label?maxResults=200`, { headers });
    if (!res.ok) {
      res = await fetch(`${base}/rest/api/2/label?maxResults=200`, { headers });
    }
    if (!res.ok) {
      // Some Jira versions use /labels (plural)
      res = await fetch(`${base}/rest/api/${apiVersion}/labels?maxResults=200`, { headers });
    }
    if (res.ok) {
      const data: any = await res.json();
      results.labels = data.values || data.suggestions || data || [];
      if (Array.isArray(results.labels) && results.labels.length > 0 && typeof results.labels[0] === 'object') {
        results.labels = results.labels.map((l: any) => l.label || l.name || l);
      }
      console.log(`[Jira] Fetched ${results.labels.length} labels`);
    } else {
      console.log(`[Jira] Labels fetch returned ${res.status}`);
    }
  } catch (e: any) { console.log(`[Jira] Labels fetch failed: ${e.message}`); }

  // Fetch components for project
  try {
    const res = await fetch(`${base}/rest/api/${apiVersion}/project/${projectKey}/components`, { headers });
    if (res.ok) {
      const data: any = await res.json();
      results.components = (data as any[]).map((c: any) => ({ id: c.id, name: c.name }));
    }
  } catch (e: any) { console.log(`[Jira] Components fetch failed: ${e.message}`); }

  // Fetch versions for project
  try {
    let res = await fetch(`${base}/rest/api/${apiVersion}/project/${projectKey}/versions`, { headers });
    if (!res.ok && apiVersion !== '2') {
      res = await fetch(`${base}/rest/api/2/project/${projectKey}/versions`, { headers });
    }
    if (!res.ok) {
      res = await fetch(`${base}/rest/api/latest/project/${projectKey}/versions`, { headers });
    }
    if (res.ok) {
      const data: any = await res.json();
      const versions = Array.isArray(data) ? data : (data.values || []);
      results.versions = versions.map((v: any) => ({ id: String(v.id), name: v.name, released: v.released || false }));
      console.log(`[Jira] Fetched ${results.versions.length} versions for ${projectKey}`);
    } else {
      console.log(`[Jira] Versions fetch returned ${res.status} for ${projectKey}`);
    }
  } catch (e: any) { console.log(`[Jira] Versions fetch failed: ${e.message}`); }

  // Fetch Tempo accounts (custom field) — try Tempo REST API first, then createmeta
  try {
    // Try Tempo Accounts API
    let res = await fetch(`${base}/rest/tempo-accounts/1/account`, { headers });
    if (res.ok) {
      const data: any = await res.json();
      results.accounts = (Array.isArray(data) ? data : data.results || []).map((a: any) => ({ id: String(a.id || a.key), name: a.name || a.value }));
    } else {
      // Fallback: try createmeta to find Account custom field allowed values
      const metaRes = await fetch(`${base}/rest/api/${apiVersion}/issue/createmeta?projectKeys=${projectKey}&issuetypeNames=Incident&expand=projects.issuetypes.fields`, { headers });
      if (metaRes.ok) {
        const meta: any = await metaRes.json();
        const project = meta.projects?.[0];
        const issueType = project?.issuetypes?.[0];
        if (issueType?.fields) {
          // Find Account field (usually customfield with "Account" or "Tempo Account")
          for (const [key, field] of Object.entries(issueType.fields) as any[]) {
            if (field.name && (field.name.toLowerCase().includes('account') && !field.name.toLowerCase().includes('regression'))) {
              if (field.allowedValues) {
                results.accounts = field.allowedValues.map((v: any) => ({ id: String(v.id || v.value), name: v.name || v.value }));
              }
              break;
            }
          }
        }
      }
    }
    console.log(`[Jira] Fetched ${results.accounts.length} accounts`);
  } catch (e: any) { console.log(`[Jira] Accounts fetch failed: ${e.message}`); }

  console.log(`[Jira] Metadata summary — labels: ${results.labels.length}, components: ${results.components.length}, versions: ${results.versions.length}, accounts: ${results.accounts.length}`);
  return results;
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

    const data: any = await response.json();
    return {
      status: data.fields?.status?.name || 'Unknown',
      summary: data.fields?.summary || '',
      url: `${baseUrl.replace(/\/$/, '')}/browse/${issueKey}`,
    };
  } catch {
    return null;
  }
}
