import { Router, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import * as settingsService from '../services/settings.service';
import * as licenseService from '../services/license.service';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Get all settings (admin only)
router.get('/', authenticate, requireAdmin, async (_req: any, res: Response) => {
  res.json(await settingsService.getAllSettings());
});

// Update multiple settings
router.patch('/', authenticate, requireAdmin, async (req: any, res: Response) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    res.status(400).json({ error: 'settings object is required' });
    return;
  }
  await settingsService.updateSettings(settings);

  // Reset cached transporter if SMTP settings changed
  const smtpKeys = Object.keys(settings).filter(k => k.startsWith('smtp_'));
  if (smtpKeys.length > 0) {
    const { resetTransporter } = require('../services/email.service');
    resetTransporter();
  }

  res.json({ message: 'Settings updated' });
});

// License check endpoint (public, used by wizard)
router.post('/check-license', async (req: any, res: Response) => {
  const { productKey } = req.body;
  if (!productKey) {
    res.status(400).json({ error: 'productKey is required' });
    return;
  }
  const result = await licenseService.checkLicense(productKey);

  // Also return the no-support URL and message if needed
  if (!result.hasSupport) {
    result.message = await settingsService.getSetting('license_no_support_message') || result.message;
    (result as any).redirectUrl = await settingsService.getSetting('license_no_support_url');
  }

  res.json(result);
});

// Test license API (admin)
router.post('/test-license-api', authenticate, requireAdmin, async (req: any, res: Response) => {
  const { productKey } = req.body;
  const result = await licenseService.checkLicense(productKey || 'VTB-TEST-TEST');
  res.json(result);
});

// Test Jira connection and fetch projects (admin)
router.post('/test-jira', authenticate, requireAdmin, async (req: any, res: Response) => {
  const { baseUrl, email, token } = req.body;

  // Use provided values or fall back to saved settings
  const jiraUrl = baseUrl || await settingsService.getSetting('jira_base_url');
  const jiraEmail = email || await settingsService.getSetting('jira_api_email');
  const jiraToken = token || await settingsService.getSetting('jira_api_token');

  if (!jiraUrl || !jiraEmail || !jiraToken) {
    res.status(400).json({ success: false, error: 'Jira Base URL, Email, and API Token are required' });
    return;
  }

  const auth = Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64');
  const base = jiraUrl.replace(/\/$/, '');
  try {
    // Try v3 (Cloud) first, fall back to v2 (Server/Data Center)
    let response = await fetch(`${base}/rest/api/3/project`, {
      headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
    });
    if (response.status === 404) {
      response = await fetch(`${base}/rest/api/2/project`, {
        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
      });
    }
    if (!response.ok) {
      const body = await response.text();
      res.json({ success: false, error: `Jira API error (${response.status}): ${body.substring(0, 200)}` });
      return;
    }
    const projects: any = await response.json();
    res.json({
      success: true,
      projects: projects.map((p: any) => ({ key: p.key, name: p.name, projectTypeKey: p.projectTypeKey })),
    });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

// Fetch Jira metadata (labels, components, versions, accounts)
router.get('/jira-metadata', authenticate, requireAdmin, async (req: any, res: Response) => {
  try {
    const engineerId = req.query.engineerId ? parseInt(req.query.engineerId) : undefined;
    const { getJiraMetadata } = require('../services/jira.service');
    const metadata = await getJiraMetadata(engineerId);
    if (!metadata) {
      res.status(400).json({ error: 'Jira not configured' });
      return;
    }
    res.json(metadata);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
