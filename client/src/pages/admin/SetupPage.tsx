import React, { useEffect, useState } from 'react';
import { settings as settingsApi } from '../../api/client';
import { Settings, Key, Mail, MessageSquare, Globe, Shield, Save, TestTube, ExternalLink, Brain } from 'lucide-react';

type Tab = 'claude' | 'license' | 'email' | 'webhooks' | 'general';

export default function SetupPage() {
  const [activeTab, setActiveTab] = useState<Tab>('claude');
  const [allSettings, setAllSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // License test
  const [testKey, setTestKey] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await settingsApi.getAll();
      const map: Record<string, string> = {};
      for (const row of data as any[]) {
        map[row.key] = row.value;
      }
      setAllSettings(map);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const get = (key: string) => allSettings[key] || '';
  const set = (key: string, value: string) => setAllSettings(prev => ({ ...prev, [key]: value }));

  const saveKeys = async (keys: string[]) => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const obj: Record<string, string> = {};
      for (const k of keys) obj[k] = get(k);
      await settingsApi.update(obj);
      setMessage('Settings saved successfully.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestLicense = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await settingsApi.testLicenseApi(testKey || 'VTB-TEST-TEST');
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'claude', label: 'Claude AI', icon: Brain },
    { id: 'license', label: 'License API', icon: Key },
    { id: 'email', label: 'Email (SMTP)', icon: Mail },
    { id: 'webhooks', label: 'Webhooks', icon: MessageSquare },
    { id: 'general', label: 'General', icon: Globe },
  ];

  if (loading) return <div className="text-center py-12 text-gray-500">Loading settings...</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-7 h-7 text-primary-500 dark:text-accent-blue" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Setup</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setMessage(''); setError(''); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Messages */}
      {message && (
        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-status-expired-bg text-status-expired-text rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tab: Claude AI */}
      {activeTab === 'claude' && (
        <div className="tb-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <Brain className="w-5 h-5" /> Claude AI Configuration
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Configure the Claude AI server for ticket analysis and automatic engineer assignment.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Server URL</label>
              <input type="text" value={get('claude_server_url')} onChange={e => set('claude_server_url', e.target.value)}
                className="tb-input" placeholder="e.g., http://claude-support-2.telcobridges.lan or https://api.anthropic.com" />
              <p className="text-xs text-gray-500 mt-1">Leave empty to disable AI analysis. For Anthropic API use https://api.anthropic.com</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Auth Type</label>
                <select value={get('claude_auth_type')} onChange={e => set('claude_auth_type', e.target.value)} className="tb-select w-full">
                  <option value="none">None</option>
                  <option value="basic">Basic Auth (username:password)</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="api-key">Anthropic API Key</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                  {get('claude_auth_type') === 'basic' ? 'Credentials (user:pass)' :
                   get('claude_auth_type') === 'api-key' ? 'API Key' :
                   get('claude_auth_type') === 'bearer' ? 'Bearer Token' : 'Auth Value'}
                </label>
                <input type="password" value={get('claude_auth_value')} onChange={e => set('claude_auth_value', e.target.value)}
                  className="tb-input"
                  placeholder={get('claude_auth_type') === 'basic' ? 'support:support' :
                    get('claude_auth_type') === 'api-key' ? 'sk-ant-...' : ''} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Model</label>
                <select value={get('claude_model')} onChange={e => set('claude_model', e.target.value)} className="tb-select w-full">
                  <option value="claude-opus-4-20250514">Claude Opus 4</option>
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                  <option value="claude-haiku-4-20250414">Claude Haiku 4</option>
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                  <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Max Tokens</label>
                <input type="number" value={get('claude_max_tokens')} onChange={e => set('claude_max_tokens', e.target.value)}
                  className="tb-input" min="500" max="8000" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Auto-Assign Confidence Threshold</label>
              <div className="flex items-center gap-3">
                <input type="range" min="0" max="1" step="0.05"
                  value={get('claude_auto_assign_threshold') || '0.7'}
                  onChange={e => set('claude_auto_assign_threshold', e.target.value)}
                  className="flex-1 accent-primary-500" />
                <span className="text-sm font-mono text-gray-900 dark:text-white w-12 text-right">
                  {(parseFloat(get('claude_auto_assign_threshold') || '0.7') * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">If AI confidence is above this threshold, the ticket will be auto-assigned. Below = flagged for manual review.</p>
            </div>

            <div className="bg-[#f2f2f2] dark:bg-tb-bg rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Connection Types</h3>
              <div className="text-xs text-gray-500 space-y-1">
                <p><strong>Office Claude Server:</strong> Set URL to your server (e.g., http://claude-support-2.telcobridges.lan), Auth Type = Basic, Credentials = user:pass</p>
                <p><strong>Anthropic API Direct:</strong> Set URL to https://api.anthropic.com, Auth Type = Anthropic API Key, paste your sk-ant-... key</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button onClick={() => saveKeys(['claude_server_url', 'claude_auth_type', 'claude_auth_value', 'claude_model', 'claude_max_tokens', 'claude_auto_assign_threshold'])}
              disabled={saving} className="tb-btn-success flex items-center gap-2">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Claude Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Tab: License API */}
      {activeTab === 'license' && (
        <div className="tb-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <Shield className="w-5 h-5" /> License API Configuration
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Configure how the system validates product license keys against your license API. Leave the URL empty to skip license checks.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">License API URL</label>
              <input
                type="text"
                value={get('license_api_url')}
                onChange={e => set('license_api_url', e.target.value)}
                className="tb-input"
                placeholder="https://api.example.com/license/check?key={{productKey}}"
              />
              <p className="text-xs text-gray-400 mt-1">Use {'{{productKey}}'} as a placeholder in the URL for GET requests.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">HTTP Method</label>
                <select
                  value={get('license_api_method')}
                  onChange={e => set('license_api_method', e.target.value)}
                  className="tb-select"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Response Path</label>
                <input
                  type="text"
                  value={get('license_api_response_path')}
                  onChange={e => set('license_api_response_path', e.target.value)}
                  className="tb-input"
                  placeholder="valid"
                />
                <p className="text-xs text-gray-400 mt-1">JSON path to the boolean field (e.g., "valid" or "data.hasSupport").</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Headers (JSON)</label>
              <textarea
                value={get('license_api_headers')}
                onChange={e => set('license_api_headers', e.target.value)}
                className="tb-input font-mono text-sm"
                rows={3}
                placeholder='{"Content-Type":"application/json"}'
              />
            </div>

            {get('license_api_method') === 'POST' && (
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Body Template (JSON)</label>
                <textarea
                  value={get('license_api_body_template')}
                  onChange={e => set('license_api_body_template', e.target.value)}
                  className="tb-input font-mono text-sm"
                  rows={3}
                  placeholder='{"productKey":"{{productKey}}"}'
                />
                <p className="text-xs text-gray-400 mt-1">Use {'{{productKey}}'} placeholder for the license key value.</p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Auth Type</label>
                <select
                  value={get('license_api_auth_type')}
                  onChange={e => set('license_api_auth_type', e.target.value)}
                  className="tb-select"
                >
                  <option value="none">None</option>
                  <option value="basic">Basic</option>
                  <option value="bearer">Bearer Token</option>
                </select>
              </div>
              {get('license_api_auth_type') !== 'none' && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                    {get('license_api_auth_type') === 'basic' ? 'Credentials (username:password)' : 'Bearer Token'}
                  </label>
                  <input
                    type="password"
                    value={get('license_api_auth_value')}
                    onChange={e => set('license_api_auth_value', e.target.value)}
                    className="tb-input"
                    placeholder={get('license_api_auth_type') === 'basic' ? 'user:pass' : 'token'}
                  />
                </div>
              )}
            </div>

            <hr className="border-gray-200 dark:border-gray-700" />

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">No Support Redirect URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={get('license_no_support_url')}
                  onChange={e => set('license_no_support_url', e.target.value)}
                  className="tb-input flex-1"
                  placeholder="https://example.com/support-options/"
                />
                {get('license_no_support_url') && (
                  <a
                    href={get('license_no_support_url')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tb-btn-secondary flex items-center gap-1 shrink-0"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">No Support Message</label>
              <textarea
                value={get('license_no_support_message')}
                onChange={e => set('license_no_support_message', e.target.value)}
                className="tb-input"
                rows={3}
                placeholder="Your product does not have an active support agreement."
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => saveKeys([
                'license_api_url', 'license_api_method', 'license_api_headers',
                'license_api_body_template', 'license_api_response_path',
                'license_api_auth_type', 'license_api_auth_value',
                'license_no_support_url', 'license_no_support_message',
              ])}
              disabled={saving}
              className="tb-btn-success flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save License Settings'}
            </button>
          </div>

          {/* Test Section */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <TestTube className="w-4 h-4" /> Test License API
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={testKey}
                onChange={e => setTestKey(e.target.value)}
                className="tb-input flex-1"
                placeholder="Enter a test product key (default: VTB-TEST-TEST)"
              />
              <button
                onClick={handleTestLicense}
                disabled={testing}
                className="tb-btn-primary flex items-center gap-2 shrink-0"
              >
                <TestTube className="w-4 h-4" /> {testing ? 'Testing...' : 'Test'}
              </button>
            </div>
            {testResult && (
              <div className={`mt-3 p-3 rounded-lg text-sm font-mono whitespace-pre-wrap ${
                testResult.hasSupport
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-status-expired-bg text-status-expired-text'
              }`}>
                {JSON.stringify(testResult, null, 2)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Email (SMTP) */}
      {activeTab === 'email' && (
        <div className="tb-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <Mail className="w-5 h-5" /> SMTP Configuration
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Configure email delivery for ticket notifications. Leave host empty to disable email.
          </p>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">SMTP Host</label>
                <input
                  type="text"
                  value={get('smtp_host')}
                  onChange={e => set('smtp_host', e.target.value)}
                  className="tb-input"
                  placeholder="smtp.example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">SMTP Port</label>
                <input
                  type="number"
                  value={get('smtp_port')}
                  onChange={e => set('smtp_port', e.target.value)}
                  className="tb-input"
                  placeholder="587"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">SMTP Username</label>
                <input
                  type="text"
                  value={get('smtp_user')}
                  onChange={e => set('smtp_user', e.target.value)}
                  className="tb-input"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">SMTP Password</label>
                <input
                  type="password"
                  value={get('smtp_pass')}
                  onChange={e => set('smtp_pass', e.target.value)}
                  className="tb-input"
                  placeholder="Password"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">From Address</label>
                <input
                  type="email"
                  value={get('smtp_from')}
                  onChange={e => set('smtp_from', e.target.value)}
                  className="tb-input"
                  placeholder="support@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Use TLS</label>
                <select
                  value={get('smtp_secure')}
                  onChange={e => set('smtp_secure', e.target.value)}
                  className="tb-select"
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => saveKeys([
                'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'smtp_secure',
              ])}
              disabled={saving}
              className="tb-btn-success flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Email Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Webhooks */}
      {activeTab === 'webhooks' && (
        <div className="tb-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> Webhook Configuration
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Configure Slack and Microsoft Teams webhooks for real-time ticket notifications.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Slack Webhook URL</label>
              <input
                type="text"
                value={get('slack_webhook_url')}
                onChange={e => set('slack_webhook_url', e.target.value)}
                className="tb-input"
                placeholder="https://hooks.slack.com/services/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Microsoft Teams Webhook URL</label>
              <input
                type="text"
                value={get('teams_webhook_url')}
                onChange={e => set('teams_webhook_url', e.target.value)}
                className="tb-input"
                placeholder="https://outlook.office.com/webhook/..."
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => saveKeys(['slack_webhook_url', 'teams_webhook_url'])}
              disabled={saving}
              className="tb-btn-success flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Webhook Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Tab: General */}
      {activeTab === 'general' && (
        <div className="tb-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <Globe className="w-5 h-5" /> General Settings
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Company information used in emails and the user interface.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Company Name</label>
              <input
                type="text"
                value={get('company_name')}
                onChange={e => set('company_name', e.target.value)}
                className="tb-input"
                placeholder="TelcoBridges"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Support Email</label>
              <input
                type="email"
                value={get('support_email')}
                onChange={e => set('support_email', e.target.value)}
                className="tb-input"
                placeholder="support@example.com"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => saveKeys(['company_name', 'support_email'])}
              disabled={saving}
              className="tb-btn-success flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save General Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
