import React, { useEffect, useState } from 'react';
import { adminSkills } from '../../api/client';
import { Wrench, Plus, Pencil, Trash2, X, Save } from 'lucide-react';

interface Skill {
  id: number;
  name: string;
  description: string;
}

interface FormData {
  name: string;
  description: string;
}

const emptyForm: FormData = { name: '', description: '' };

export default function SkillManager() {
  const [items, setItems] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    adminSkills.list().then(setItems).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const startCreate = () => { setCreating(true); setEditing(null); setForm(emptyForm); setError(''); };

  const startEdit = (s: Skill) => {
    setEditing(s.id); setCreating(false);
    setForm({ name: s.name, description: s.description });
    setError('');
  };

  const cancel = () => { setEditing(null); setCreating(false); setError(''); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      if (creating) await adminSkills.create(form);
      else if (editing) await adminSkills.update(editing, form);
      cancel(); load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" skill'ini silmek istediginize emin misiniz?`)) return;
    try { await adminSkills.delete(id); load(); } catch (err: any) { alert(err.message); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Skill Management</h1>
        <button onClick={startCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
          <Plus className="w-4 h-4" /> Add Skill
        </button>
      </div>

      {/* Create/Edit Form */}
      {(creating || editing) && (
        <div className="bg-white rounded-xl shadow-sm border border-primary-200 p-6 mb-6">
          <h3 className="font-semibold mb-4">{creating ? 'New Skill' : 'Edit Skill'}</h3>
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="e.g., Machine Learning" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="e.g., Model training, deployment, MLOps" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={cancel} className="flex items-center gap-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
              <X className="w-4 h-4" /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Skill List */}
      <div className="space-y-2">
        {items.map(s => (
          <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                <Wrench className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-medium">{s.name}</h3>
                <p className="text-sm text-gray-400">{s.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => startEdit(s)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(s.id, s.name)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-400">
            No skills defined. Click "Add Skill" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
