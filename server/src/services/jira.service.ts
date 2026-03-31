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

  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/3/issue`;
  const auth = Buffer.from(`${email}:${token}`).toString('base64');

  const body = {
    fields: {
      project: { key: projectKey },
      summary: `[${data.ticketNumber}] ${data.subject}`,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: `Ticket: ${data.ticketNumber}` },
            ],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: `Product: ${data.productName} / ${data.categoryName}` },
            ],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: `Customer: ${data.customerName} (${data.customerEmail})` },
            ],
          },
          {
            type: 'rule',
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: data.description },
            ],
          },
        ],
      },
      issuetype: { name: issueType },
      priority: { name: PRIORITY_MAP[data.priority] || 'Medium' },
      labels: ['support-ticket', data.ticketNumber],
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[Jira] Create issue failed:', response.status, errorBody);
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
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/3/issue/${issueKey}?fields=status,summary`;
  const auth = Buffer.from(`${email}:${token}`).toString('base64');

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
