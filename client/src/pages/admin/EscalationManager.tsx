import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { admin } from '../../api/client';
import { AlertTriangle, Plus, Pencil, Trash2, X, Check, ShieldAlert } from 'lucide-react';
import { PriorityBadge } from '../../components/StatusBadge';

const ACTION_LABELS: Record<string, string> = {
  notify_admin: 'Notify Admin',
  increase_priority: 'Increase Priority',
  reassign: 'Reassign',
};

export default function EscalationManager() {
  const [rules, setRules] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ priority: 'low', hours: '', action: 'notify_admin' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      admin.escalationRules().catch(() => []),
      admin.escalationAlerts().catch(() => []),
    ]).then(([r, a]) => {
      setRules(r);
      setAlerts(a);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ priority: 'low', hours: '', action: 'notify_admin' });
    setEditId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.hours || Number(form.hours) <= 0) return;
    setSaving(true);
    try {
      const payload = {
        priority: form.priority,
        hoursWithoutResponse: Number(form.hours),
        action: form.action,
      };
      if (editId) {
        await admin.updateEscalationRule(editId, payload);
      } else {
        await admin.createEscalationRule(payload);
      }
      resetForm();
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (rule: any) => {
    setForm({
      priority: rule.priority,
      hours: String(rule.hoursWithoutResponse || rule.hours_without_response),
      action: rule.action,
    });
    setEditId(rule.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this escalation rule?')) return;
    try {
      await admin.deleteEscalationRule(id);
      load();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleActive = async (rule: any) => {
    try {
      await admin.updateEscalationRule(rule.id, { active: !rule.active });
      load();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading escalation data...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Escalation Manager</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Configure escalation rules and view current alerts.</p>
      </div>

      {/* Section 1: Escalation Rules */}
      <div className="tb-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-accent-blue" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Escalation Rules</h2>
          </div>
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="tb-btn-primary flex items-center gap-2 px-3 py-2 text-sm">
              <Plus className="w-4 h-4" /> Add Rule
            </button>
          )}
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-white/5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              {editId ? 'Edit Rule' : 'Add New Rule'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value })}
                  className="tb-select w-full"
                >
                  {['low', 'medium', 'high', 'critical'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Hours Without Response</label>
                <input
                  type="number"
                  min={1}
                  value={form.hours}
                  onChange={e => setForm({ ...form, hours: e.target.value })}
                  placeholder="e.g. 24"
                  className="tb-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Action</label>
                <select
                  value={form.action}
                  onChange={e => setForm({ ...form, action: e.target.value })}
                  className="tb-select w-full"
                >
                  <option value="notify_admin">Notify Admin</option>
                  <option value="increase_priority">Increase Priority</option>
                  <option value="reassign">Reassign</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSave} disabled={saving || !form.hours}
                className="tb-btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50">
                <Check className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={resetForm} className="tb-btn-secondary flex items-center gap-2 px-4 py-2 text-sm">
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* Rules Table */}
        {rules.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No escalation rules configured.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Priority</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Hours Without Response</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Active</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {rules.map((rule: any) => (
                  <tr key={rule.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                    <td className="px-4 py-3"><PriorityBadge priority={rule.priority} /></td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{rule.hoursWithoutResponse || rule.hours_without_response}h</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{ACTION_LABELS[rule.action] || rule.action}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(rule)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          rule.active ? 'bg-accent-green' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          rule.active ? 'translate-x-4.5' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEdit(rule)} className="p-1.5 text-gray-400 hover:text-accent-blue transition-colors" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(rule.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Current Escalation Alerts */}
      <div className="tb-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Current Escalation Alerts</h2>
          <span className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold ${
            alerts.length > 0 ? 'bg-red-500/20 text-red-400' : 'bg-accent-green/20 text-accent-green'
          }`}>
            {alerts.length}
          </span>
        </div>

        {alerts.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No escalation alerts. All tickets are within response thresholds.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ticket</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subject</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Customer</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Priority</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Hours Open</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rule Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {alerts.map((alert: any, i: number) => {
                  const hoursOpen = alert.hoursOpen || alert.hours_open || 0;
                  const severity = hoursOpen >= 48 ? 'red' : hoursOpen >= 24 ? 'amber' : 'yellow';
                  const rowBg = severity === 'red'
                    ? 'bg-red-500/10'
                    : severity === 'amber'
                      ? 'bg-amber-500/10'
                      : '';
                  return (
                    <tr key={i} className={`${rowBg} hover:bg-black/5 dark:hover:bg-white/5`}>
                      <td className="px-4 py-3">
                        <Link to={`/admin/tickets/${alert.ticketId || alert.ticket_id}`}
                          className="text-sm font-mono text-accent-blue hover:underline">
                          {alert.ticketNumber || alert.ticket_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 max-w-xs truncate">{alert.subject}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{alert.customerName || alert.customer_name}</td>
                      <td className="px-4 py-3"><PriorityBadge priority={alert.priority} /></td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${
                          severity === 'red' ? 'text-red-500' : severity === 'amber' ? 'text-amber-500' : 'text-gray-700 dark:text-gray-200'
                        }`}>
                          {typeof hoursOpen === 'number' ? hoursOpen.toFixed(1) : hoursOpen}h
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                        {ACTION_LABELS[alert.ruleAction || alert.rule_action] || alert.ruleAction || alert.rule_action}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
