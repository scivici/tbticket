import React, { useEffect, useState } from 'react';
import { products as productsApi, adminCategories } from '../../api/client';
import { FolderOpen, Plus, Pencil, Trash2, X, Save, ChevronUp, ChevronDown } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const ICONS = ['wifi', 'microphone', 'cpu', 'link', 'download', 'activity', 'server', 'network', 'bell', 'trending-up', 'shield', 'settings', 'alert-triangle', 'database', 'monitor'];

export default function CategoryManager() {
  const toast = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ productId: 0, name: '', description: '', icon: '', displayOrder: 0 });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { productsApi.list().then(p => { setProducts(p); if (p.length > 0) setSelectedProductId(p[0].id); }).catch(console.error).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (selectedProductId) productsApi.categories(selectedProductId).then(setCategories).catch(console.error); }, [selectedProductId]);
  const reload = () => { if (selectedProductId) productsApi.categories(selectedProductId).then(setCategories).catch(console.error); };

  const startCreate = () => { setCreating(true); setEditing(null); setForm({ productId: selectedProductId, name: '', description: '', icon: '', displayOrder: categories.length + 1 }); setError(''); };
  const startEdit = (c: any) => { setEditing(c.id); setCreating(false); setForm({ productId: c.product_id, name: c.name, description: c.description, icon: c.icon || '', displayOrder: c.display_order }); setError(''); };
  const cancel = () => { setEditing(null); setCreating(false); setError(''); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try { if (creating) await adminCategories.create(form); else if (editing) await adminCategories.update(editing, form); cancel(); reload(); } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => { if (!confirm(`"${name}" kategorisini silmek istediginize emin misiniz?`)) return; try { await adminCategories.delete(id); reload(); } catch (err: any) { toast.error(err.message); } };

  const moveCategory = async (index: number, direction: -1 | 1) => {
    const arr = [...categories]; const si = index + direction; if (si < 0 || si >= arr.length) return;
    [arr[index], arr[si]] = [arr[si], arr[index]];
    try { await adminCategories.reorder(arr.map((c, i) => ({ id: c.id, displayOrder: i + 1 }))); reload(); } catch (err: any) { toast.error(err.message); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Category Management</h1>
        <button onClick={startCreate} disabled={!selectedProductId} className="tb-btn-primary flex items-center gap-2 disabled:opacity-50"><Plus className="w-4 h-4" /> Add Category</button>
      </div>

      <div className="mb-6"><label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Select Product</label>
        <select value={selectedProductId} onChange={e => { setSelectedProductId(parseInt(e.target.value)); cancel(); }} className="tb-select">
          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.model})</option>)}
        </select>
      </div>

      {(creating || editing) && (
        <div className="tb-card border-primary-500/30 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{creating ? 'New Category' : 'Edit Category'}</h3>
          {error && <div className="mb-4 p-3 bg-status-expired-bg text-status-expired-text rounded-lg text-sm">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Name *</label><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="tb-input" /></div>
            <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Icon</label><select value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} className="tb-select w-full"><option value="">None</option>{ICONS.map(i => <option key={i} value={i}>{i}</option>)}</select></div>
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="tb-input" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={cancel} className="tb-btn-secondary flex items-center gap-1"><X className="w-4 h-4" /> Cancel</button>
            <button onClick={handleSave} disabled={saving} className="tb-btn-success flex items-center gap-1"><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {categories.map((c, index) => (
          <div key={c.id} className="tb-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveCategory(index, -1)} disabled={index === 0} className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                <button onClick={() => moveCategory(index, 1)} disabled={index === categories.length - 1} className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
              </div>
              <div className="w-10 h-10 bg-accent-blue/20 rounded-lg flex items-center justify-center"><FolderOpen className="w-5 h-5 text-accent-blue" /></div>
              <div><h3 className="font-medium text-gray-900 dark:text-white">{c.name}</h3><p className="text-sm text-gray-500">{c.description}</p></div>
              {c.icon && <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded">{c.icon}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => startEdit(c)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-accent-blue hover:bg-black/10 dark:hover:bg-white/10 rounded-lg"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(c.id, c.name)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {categories.length === 0 && selectedProductId && <div className="text-center py-12 tb-card text-gray-500">No categories for this product.</div>}
      </div>
    </div>
  );
}
