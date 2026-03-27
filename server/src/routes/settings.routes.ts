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

export default router;
