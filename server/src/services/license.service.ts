import { getSettings } from './settings.service';

export interface LicenseCheckResult {
  valid: boolean;
  hasSupport: boolean;
  message: string;
  details?: any;
}

export async function checkLicense(productKey: string): Promise<LicenseCheckResult> {
  const settings = getSettings('license_api_');
  const url = settings['license_api_url'];

  if (!url) {
    // No API configured, allow all
    console.log('[License] No API configured, skipping check');
    return { valid: true, hasSupport: true, message: 'License check skipped (no API configured)' };
  }

  try {
    const method = settings['license_api_method'] || 'GET';
    const headersStr = settings['license_api_headers'] || '{}';
    const headers = JSON.parse(headersStr);
    const authType = settings['license_api_auth_type'] || 'none';
    const authValue = settings['license_api_auth_value'] || '';

    // Auth
    if (authType === 'basic' && authValue) {
      headers['Authorization'] = 'Basic ' + Buffer.from(authValue).toString('base64');
    } else if (authType === 'bearer' && authValue) {
      headers['Authorization'] = 'Bearer ' + authValue;
    }

    // Build URL/body with productKey placeholder
    let finalUrl = url.replace(/\{\{productKey\}\}/g, encodeURIComponent(productKey));
    let body: string | undefined;

    if (method === 'POST') {
      const bodyTemplate = settings['license_api_body_template'] || '{}';
      body = bodyTemplate.replace(/\{\{productKey\}\}/g, productKey);
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    console.log(`[License] Checking ${productKey} via ${method} ${finalUrl}`);

    const response = await fetch(finalUrl, {
      method,
      headers,
      body: method === 'POST' ? body : undefined,
    });

    if (!response.ok) {
      console.error(`[License] API returned ${response.status}`);
      return { valid: false, hasSupport: false, message: 'License validation service error' };
    }

    const data = await response.json();

    // Navigate response path
    const responsePath = settings['license_api_response_path'] || 'valid';
    let result = data;
    for (const part of responsePath.split('.')) {
      result = result?.[part];
    }

    const hasSupport = !!result;
    return {
      valid: true,
      hasSupport,
      message: hasSupport ? 'Active support agreement found' : 'No active support agreement',
      details: data,
    };
  } catch (error: any) {
    console.error('[License] Check failed:', error.message);
    return { valid: false, hasSupport: false, message: 'License check failed: ' + error.message };
  }
}
