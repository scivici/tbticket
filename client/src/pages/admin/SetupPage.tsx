import React, { useEffect, useState } from 'react';
import { settings as settingsApi, adminUsers } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Settings, Key, Mail, MessageSquare, Globe, Shield, Save, TestTube, ExternalLink, Brain, Terminal, UserCog, Plus, Pencil, Trash2, X, Eye, EyeOff, Clock, Zap } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

type Tab = 'claude' | 'license' | 'email' | 'webhooks' | 'general' | 'automation' | 'jira' | 'users';

export default function SetupPage() {
  const toast = useToast();
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
    { id: 'automation', label: 'Automation', icon: Clock },
    { id: 'jira', label: 'Jira', icon: ExternalLink },
    { id: 'users', label: 'Admin Users', icon: UserCog },
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
            Configure Claude AI for ticket analysis and automatic engineer assignment.
          </p>

          <div className="space-y-4">
            {/* Analysis Mode */}
            <div className="bg-primary-500/10 rounded-lg p-4 border border-primary-500/30">
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Analysis Mode</label>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { value: 'wrapper', label: 'Wrapper Service (Recommended)', desc: 'HTTP → Claude Code CLI with full server access' },
                  { value: 'ssh', label: 'SSH + Claude Code CLI', desc: 'SFTP files to server, run Claude Code CLI via SSH' },
                  { value: 'api', label: 'HTTP API', desc: 'Send via HTTP API (Anthropic or proxy)' },
                  { value: 'disabled', label: 'Disabled', desc: 'No AI analysis, use scoring fallback only' },
                ].map(mode => (
                  <button key={mode.value} onClick={() => set('claude_analysis_mode', mode.value)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      get('claude_analysis_mode') === mode.value || (!get('claude_analysis_mode') && mode.value === 'ssh')
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{mode.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{mode.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Wrapper Mode Settings */}
            {get('claude_analysis_mode') === 'wrapper' && (
              <div className="bg-[#f2f2f2] dark:bg-tb-bg rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-accent-green" />
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Wrapper Service Connection</h3>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Wrapper Service URL</label>
                    <input type="text" value={get('claude_wrapper_url')} onChange={e => set('claude_wrapper_url', e.target.value)}
                      className="tb-input text-sm" placeholder="http://claude-support-2.telcobridges.lan:4002" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Auth Token</label>
                    <input type="password" value={get('claude_wrapper_auth_token')} onChange={e => set('claude_wrapper_auth_token', e.target.value)}
                      className="tb-input text-sm" placeholder="tb-claude-wrapper-secret" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Timeout (ms)</label>
                    <input type="number" value={get('claude_wrapper_timeout') || '310000'} onChange={e => set('claude_wrapper_timeout', e.target.value)}
                      className="tb-input text-sm" />
                  </div>
                </div>
                <div className="mt-3 p-3 bg-white dark:bg-tb-card rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">How it works:</p>
                  <ol className="list-decimal ml-4 space-y-0.5">
                    <li>Ticket data + base64-encoded attachments sent via HTTP POST</li>
                    <li>Wrapper service saves files and runs <code>claude -p "..." --allowedTools "..." --output-format json</code></li>
                    <li>Claude Code CLI has full access to source code, docs, and analysis tools</li>
                    <li>Structured JSON analysis returned to ticket system</li>
                    <li>Engineer auto-assigned based on confidence threshold</li>
                  </ol>
                  <p className="mt-2 text-accent-green font-medium">Recommended: Best analysis quality with full server capabilities.</p>
                </div>
              </div>
            )}

            {/* SSH Mode Settings */}
            {(get('claude_analysis_mode') === 'ssh' || !get('claude_analysis_mode')) && (
              <div className="bg-[#f2f2f2] dark:bg-tb-bg rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <Terminal className="w-4 h-4 text-accent-blue" />
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">SSH / SFTP Connection</h3>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">SSH Host</label>
                    <input type="text" value={get('claude_ssh_host')} onChange={e => set('claude_ssh_host', e.target.value)}
                      className="tb-input text-sm" placeholder="claude-support-2.telcobridges.lan" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">SSH Port</label>
                    <input type="number" value={get('claude_ssh_port') || '22'} onChange={e => set('claude_ssh_port', e.target.value)}
                      className="tb-input text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Username</label>
                    <input type="text" value={get('claude_ssh_user')} onChange={e => set('claude_ssh_user', e.target.value)}
                      className="tb-input text-sm" placeholder="support" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Password</label>
                    <input type="password" value={get('claude_ssh_pass')} onChange={e => set('claude_ssh_pass', e.target.value)}
                      className="tb-input text-sm" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Remote Ticket Path</label>
                    <input type="text" value={get('claude_ssh_remote_path') || '/home/support/tickets'} onChange={e => set('claude_ssh_remote_path', e.target.value)}
                      className="tb-input text-sm" placeholder="/home/support/tickets" />
                    <p className="text-xs text-gray-500 mt-1">Ticket files will be uploaded to {'{path}/{ticketNumber}/'}</p>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-white dark:bg-tb-card rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">How it works:</p>
                  <ol className="list-decimal ml-4 space-y-0.5">
                    <li>Customer uploads files with ticket</li>
                    <li>Files are transferred via SFTP to <code>{get('claude_ssh_remote_path') || '/home/support/tickets'}/TBT-XXXX/</code></li>
                    <li>Claude Code CLI runs: <code>cd ticket_dir && claude -p "analyze..."</code></li>
                    <li>Report is captured and saved to ticket</li>
                    <li>Engineer is auto-assigned based on report</li>
                  </ol>
                </div>
              </div>
            )}

            {/* API Mode Settings */}
            {get('claude_analysis_mode') === 'api' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Server URL</label>
                  <input type="text" value={get('claude_server_url')} onChange={e => set('claude_server_url', e.target.value)}
                    className="tb-input" placeholder="e.g., https://api.anthropic.com" />
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
              </>
            )}

            {/* Common settings for both SSH and API modes */}
            {get('claude_analysis_mode') !== 'disabled' && (
              <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Model (for API mode)</label>
                <select value={get('claude_model')} onChange={e => set('claude_model', e.target.value)} className="tb-select w-full">
                  <option value="claude-opus-4-20250514">Claude Opus 4</option>
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                  <option value="claude-haiku-4-20250414">Claude Haiku 4</option>
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                  <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Max Tokens (for API mode)</label>
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
              </>
            )}
          </div>

          <div className="flex justify-end mt-6">
            <button onClick={() => saveKeys(['claude_analysis_mode', 'claude_server_url', 'claude_auth_type', 'claude_auth_value', 'claude_model', 'claude_max_tokens', 'claude_auto_assign_threshold', 'claude_ssh_host', 'claude_ssh_port', 'claude_ssh_user', 'claude_ssh_pass', 'claude_ssh_remote_path', 'claude_wrapper_url', 'claude_wrapper_auth_token', 'claude_wrapper_timeout'])}
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

      {/* Tab: Automation */}
      {activeTab === 'automation' && (
        <div className="tb-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <Clock className="w-5 h-5" /> Lifecycle Automation
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Configure automatic ticket lifecycle management. The scheduler runs every 5 minutes.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Auto-close after inactivity (days)</label>
              <input type="number" min="0" value={get('auto_close_days')} onChange={e => set('auto_close_days', e.target.value)}
                className="tb-input w-32" placeholder="14" />
              <p className="text-xs text-gray-500 mt-1">Resolved or pending tickets will be auto-closed after this many days. Set to 0 to disable.</p>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                <input type="checkbox" checked={get('auto_state_transitions') !== 'false'}
                  onChange={e => set('auto_state_transitions', e.target.checked ? 'true' : 'false')}
                  className="rounded border-gray-300 dark:border-gray-600 text-accent-blue" />
                Auto-transition ticket status
              </label>
              <p className="text-xs text-gray-500 ml-6">When a customer replies to a "pending info" ticket, automatically move it to "in progress".</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Idle ticket alert (hours)</label>
              <input type="number" min="0" value={get('idle_ticket_alert_hours')} onChange={e => set('idle_ticket_alert_hours', e.target.value)}
                className="tb-input w-32" placeholder="24" />
              <p className="text-xs text-gray-500 mt-1">Alert admins when assigned tickets have no activity. Set to 0 to disable.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Customer reminder (hours)</label>
              <input type="number" min="0" value={get('customer_reminder_hours')} onChange={e => set('customer_reminder_hours', e.target.value)}
                className="tb-input w-32" placeholder="48" />
              <p className="text-xs text-gray-500 mt-1">Send reminder to customers with pending tickets. Set to 0 to disable.</p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={() => saveKeys(['auto_close_days', 'auto_state_transitions', 'idle_ticket_alert_hours', 'customer_reminder_hours'])}
              disabled={saving} className="tb-btn-success flex items-center gap-2">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Automation Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Jira */}
      {activeTab === 'jira' && (
        <div className="tb-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <ExternalLink className="w-5 h-5" /> Jira Integration
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Connect to your Jira instance to create and track issues from tickets.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Jira Base URL</label>
              <input type="url" value={get('jira_base_url')} onChange={e => set('jira_base_url', e.target.value)}
                className="tb-input" placeholder="https://yourcompany.atlassian.net" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">API Email</label>
              <input type="email" value={get('jira_api_email')} onChange={e => set('jira_api_email', e.target.value)}
                className="tb-input" placeholder="you@company.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">API Token</label>
              <input type="password" value={get('jira_api_token')} onChange={e => set('jira_api_token', e.target.value)}
                className="tb-input" placeholder="Jira API token" />
              <p className="text-xs text-gray-500 mt-1">Generate at: id.atlassian.com/manage-profile/security/api-tokens</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Default Project Key</label>
                <input type="text" value={get('jira_project_key')} onChange={e => set('jira_project_key', e.target.value.toUpperCase())}
                  className="tb-input font-mono" placeholder="SUP" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Default Issue Type</label>
                <input type="text" value={get('jira_issue_type')} onChange={e => set('jira_issue_type', e.target.value)}
                  className="tb-input" placeholder="Bug" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={() => saveKeys(['jira_base_url', 'jira_api_email', 'jira_api_token', 'jira_project_key', 'jira_issue_type'])}
              disabled={saving} className="tb-btn-success flex items-center gap-2">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Jira Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Admin Users */}
      {activeTab === 'users' && <UsersPanel />}
    </div>
  );
}

// ============ Users Panel (embedded) ============

function UsersPanel() {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [changingPw, setChangingPw] = useState<number | null>(null);
  const [changingMyPw, setChangingMyPw] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [pwForm, setPwForm] = useState({ password: '', confirmPassword: '' });
  const [myPwForm, setMyPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const load = () => { setLoading(true); adminUsers.list().then(setUsers).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const resetMessages = () => { setError(''); setSuccess(''); };

  const startCreate = () => { setCreating(true); setEditing(null); setChangingPw(null); setForm({ name: '', email: '', password: '', confirmPassword: '' }); resetMessages(); };
  const startEdit = (u: any) => { setEditing(u.id); setCreating(false); setChangingPw(null); setForm({ name: u.name, email: u.email, password: '', confirmPassword: '' }); resetMessages(); };
  const cancel = () => { setCreating(false); setEditing(null); setChangingPw(null); setChangingMyPw(false); resetMessages(); };

  const handleSave = async () => {
    resetMessages();
    if (creating) {
      if (!form.name || !form.email || !form.password) { setError('All fields are required'); return; }
      if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
      if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    }
    setSaving(true);
    try {
      if (creating) { await adminUsers.create({ email: form.email, name: form.name, password: form.password }); setSuccess('Admin created'); }
      else if (editing) { await adminUsers.update(editing, { email: form.email, name: form.name }); setSuccess('Admin updated'); }
      cancel(); load();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const handleChangePw = async (id: number) => {
    resetMessages();
    if (!pwForm.password || pwForm.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (pwForm.password !== pwForm.confirmPassword) { setError('Passwords do not match'); return; }
    setSaving(true);
    try { await adminUsers.changePassword(id, pwForm.password); setSuccess('Password changed'); setChangingPw(null); setPwForm({ password: '', confirmPassword: '' }); } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const handleChangeMyPw = async () => {
    resetMessages();
    if (!myPwForm.currentPassword || !myPwForm.newPassword) { setError('All fields are required'); return; }
    if (myPwForm.newPassword.length < 6) { setError('New password must be at least 6 characters'); return; }
    if (myPwForm.newPassword !== myPwForm.confirmPassword) { setError('New passwords do not match'); return; }
    setSaving(true);
    try { await adminUsers.changeMyPassword(myPwForm.currentPassword, myPwForm.newPassword); setSuccess('Your password has been changed'); setChangingMyPw(false); setMyPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete admin "${name}"?`)) return;
    try { await adminUsers.delete(id); load(); } catch (err: any) { toast.error(err.message); }
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="tb-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2"><UserCog className="w-5 h-5" /> Admin Users</h2>
          <button onClick={startCreate} className="tb-btn-primary flex items-center gap-2 text-sm"><Plus className="w-4 h-4" /> Add Admin</button>
        </div>

        {error && <div className="mb-4 p-3 bg-status-expired-bg text-status-expired-text rounded-lg text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm">{success}</div>}

        {/* Create/Edit Form */}
        {(creating || editing) && (
          <div className="mb-4 p-4 bg-[#f2f2f2] dark:bg-tb-bg rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">{creating ? 'New Admin' : 'Edit Admin'}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="block text-xs text-gray-500 mb-1">Name *</label><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="tb-input text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Email *</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="tb-input text-sm" /></div>
              {creating && (
                <>
                  <div><label className="block text-xs text-gray-500 mb-1">Password *</label><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="tb-input text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Confirm Password *</label><input type="password" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} className="tb-input text-sm" /></div>
                </>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleSave} disabled={saving} className="tb-btn-success text-sm flex items-center gap-1"><Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save'}</button>
              <button onClick={cancel} className="tb-btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        )}

        {/* User List */}
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between p-3 bg-[#f2f2f2] dark:bg-tb-bg rounded-lg border border-gray-200 dark:border-gray-700">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{u.name}</span>
                  {u.id === currentUser?.id && <span className="px-1.5 py-0.5 bg-primary-500/20 text-accent-blue text-xs rounded">You</span>}
                </div>
                <span className="text-xs text-gray-500">{u.email}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => startEdit(u)} className="p-1.5 text-gray-400 hover:text-accent-blue hover:bg-black/10 dark:hover:bg-white/10 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => { setChangingPw(u.id); setPwForm({ password: '', confirmPassword: '' }); resetMessages(); }} className="p-1.5 text-gray-400 hover:text-accent-amber hover:bg-black/10 dark:hover:bg-white/10 rounded"><Key className="w-3.5 h-3.5" /></button>
                {u.id !== currentUser?.id && <button onClick={() => handleDelete(u.id, u.name)} className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
          ))}
        </div>

        {/* Change Password Form */}
        {changingPw && (
          <div className="mt-4 p-4 bg-[#f2f2f2] dark:bg-tb-bg rounded-lg border border-accent-amber/30">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Change Password for {users.find(u => u.id === changingPw)?.name}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="relative">
                <label className="block text-xs text-gray-500 mb-1">New Password</label>
                <input type={showPw ? 'text' : 'password'} value={pwForm.password} onChange={e => setPwForm(f => ({ ...f, password: e.target.value }))} className="tb-input text-sm pr-10" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-6 p-1 text-gray-400">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">Confirm</label><input type="password" value={pwForm.confirmPassword} onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))} className="tb-input text-sm" /></div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => handleChangePw(changingPw)} disabled={saving} className="tb-btn-success text-sm">Change</button>
              <button onClick={cancel} className="tb-btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Change My Password */}
      <div className="tb-card p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Change Your Password</h3>
          {!changingMyPw && <button onClick={() => { setChangingMyPw(true); resetMessages(); }} className="tb-btn-secondary text-sm flex items-center gap-1"><Key className="w-3 h-3" /> Change</button>}
        </div>
        {changingMyPw && (
          <div className="space-y-3">
            <div><label className="block text-xs text-gray-500 mb-1">Current Password</label><input type="password" value={myPwForm.currentPassword} onChange={e => setMyPwForm(f => ({ ...f, currentPassword: e.target.value }))} className="tb-input text-sm" /></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="block text-xs text-gray-500 mb-1">New Password</label><input type="password" value={myPwForm.newPassword} onChange={e => setMyPwForm(f => ({ ...f, newPassword: e.target.value }))} className="tb-input text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Confirm New</label><input type="password" value={myPwForm.confirmPassword} onChange={e => setMyPwForm(f => ({ ...f, confirmPassword: e.target.value }))} className="tb-input text-sm" /></div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleChangeMyPw} disabled={saving} className="tb-btn-success text-sm">Save</button>
              <button onClick={cancel} className="tb-btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
