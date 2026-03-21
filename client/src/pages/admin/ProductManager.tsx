import React, { useEffect, useState } from 'react';
import { products as productsApi, adminProducts } from '../../api/client';
import { Package, Plus, Pencil, Trash2, X, Save } from 'lucide-react';

interface FormData { name: string; model: string; description: string; imageUrl: string; }
const emptyForm: FormData = { name: '', model: '', description: '', imageUrl: '' };

export default function ProductManager() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); productsApi.list().then(setItems).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const startCreate = () => { setCreating(true); setEditing(null); setForm(emptyForm); setError(''); };
  const startEdit = (p: any) => { setEditing(p.id); setCreating(false); setForm({ name: p.name, model: p.model, description: p.description, imageUrl: p.image_url || '' }); setError(''); };
  const cancel = () => { setEditing(null); setCreating(false); setError(''); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.model.trim()) { setError('Name and model are required'); return; }
    setSaving(true); setError('');
    try {
      const data = { name: form.name, model: form.model, description: form.description, imageUrl: form.imageUrl || null };
      if (creating) await adminProducts.create(data); else if (editing) await adminProducts.update(editing, data);
      cancel(); load();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" urununu silmek istediginize emin misiniz?`)) return;
    try { await adminProducts.delete(id); load(); } catch (err: any) { alert(err.message); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Product Management</h1>
        <button onClick={startCreate} className="tb-btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Add Product</button>
      </div>

      {(creating || editing) && (
        <div className="tb-card border-primary-500/30 p-6 mb-6">
          <h3 className="font-semibold text-white mb-4">{creating ? 'New Product' : 'Edit Product'}</h3>
          {error && <div className="mb-4 p-3 bg-status-expired-bg text-status-expired-text rounded-lg text-sm">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-300 mb-1">Name *</label><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="tb-input" placeholder="e.g., ProSBC" /></div>
            <div><label className="block text-sm font-medium text-gray-300 mb-1">Model *</label><input type="text" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} className="tb-input" placeholder="e.g., SBC-SW" /></div>
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-300 mb-1">Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="tb-input" /></div>
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-300 mb-1">Image URL</label><input type="text" value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} className="tb-input" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={cancel} className="tb-btn-secondary flex items-center gap-1"><X className="w-4 h-4" /> Cancel</button>
            <button onClick={handleSave} disabled={saving} className="tb-btn-success flex items-center gap-1"><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.map(p => (
          <div key={p.id} className="tb-card p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center"><Package className="w-6 h-6 text-accent-blue" /></div>
              <div><h3 className="font-semibold text-white">{p.name}</h3><p className="text-sm text-gray-400">Model: {p.model}</p><p className="text-sm text-gray-500 mt-0.5 max-w-lg truncate">{p.description}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => startEdit(p)} className="p-2 text-gray-400 hover:text-accent-blue hover:bg-white/10 rounded-lg"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(p.id, p.name)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-center py-12 tb-card text-gray-500">No products yet.</div>}
      </div>
    </div>
  );
}
