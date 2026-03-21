import React, { useEffect, useState } from 'react';
import { adminSkills } from '../../api/client';
import { Wrench, Plus, Pencil, Trash2, X, Save } from 'lucide-react';

export default function SkillManager() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); adminSkills.list().then(setItems).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const startCreate = () => { setCreating(true); setEditing(null); setForm({ name: '', description: '' }); setError(''); };
  const startEdit = (s: any) => { setEditing(s.id); setCreating(false); setForm({ name: s.name, description: s.description }); setError(''); };
  const cancel = () => { setEditing(null); setCreating(false); setError(''); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try { if (creating) await adminSkills.create(form); else if (editing) await adminSkills.update(editing, form); cancel(); load(); } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => { if (!confirm(`"${name}" skill'ini silmek istediginize emin misiniz?`)) return; try { await adminSkills.delete(id); load(); } catch (err: any) { alert(err.message); } };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Skill Management</h1>
        <button onClick={startCreate} className="tb-btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Add Skill</button>
      </div>

      {(creating || editing) && (
        <div className="tb-card border-primary-500/30 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{creating ? 'New Skill' : 'Edit Skill'}</h3>
          {error && <div className="mb-4 p-3 bg-status-expired-bg text-status-expired-text rounded-lg text-sm">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Name *</label><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="tb-input" placeholder="e.g., SIP & VoIP" /></div>
            <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Description</label><input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="tb-input" placeholder="e.g., SIP protocol, VoIP troubleshooting" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={cancel} className="tb-btn-secondary flex items-center gap-1"><X className="w-4 h-4" /> Cancel</button>
            <button onClick={handleSave} disabled={saving} className="tb-btn-success flex items-center gap-1"><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map(s => (
          <div key={s.id} className="tb-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent-amber/20 rounded-lg flex items-center justify-center"><Wrench className="w-5 h-5 text-accent-amber" /></div>
              <div><h3 className="font-medium text-gray-900 dark:text-white">{s.name}</h3><p className="text-sm text-gray-500">{s.description}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => startEdit(s)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-accent-blue hover:bg-black/10 dark:hover:bg-white/10 rounded-lg"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(s.id, s.name)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-center py-12 tb-card text-gray-500">No skills defined.</div>}
      </div>
    </div>
  );
}
