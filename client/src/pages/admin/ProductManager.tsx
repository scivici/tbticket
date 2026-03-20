import React, { useEffect, useState } from 'react';
import { products as productsApi, adminProducts } from '../../api/client';
import { Package, Plus, Pencil, Trash2, X, Save } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  model: string;
  description: string;
  image_url?: string;
}

interface FormData {
  name: string;
  model: string;
  description: string;
  imageUrl: string;
}

const emptyForm: FormData = { name: '', model: '', description: '', imageUrl: '' };

export default function ProductManager() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    productsApi.list().then(setItems).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm(emptyForm);
    setError('');
  };

  const startEdit = (p: Product) => {
    setEditing(p.id);
    setCreating(false);
    setForm({ name: p.name, model: p.model, description: p.description, imageUrl: p.image_url || '' });
    setError('');
  };

  const cancel = () => {
    setEditing(null);
    setCreating(false);
    setForm(emptyForm);
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.model.trim()) {
      setError('Name and model are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const data = { name: form.name, model: form.model, description: form.description, imageUrl: form.imageUrl || null };
      if (creating) {
        await adminProducts.create(data);
      } else if (editing) {
        await adminProducts.update(editing, data);
      }
      cancel();
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" urununu silmek istediginize emin misiniz?`)) return;
    try {
      await adminProducts.delete(id);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Product Management</h1>
        <button onClick={startCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {/* Create/Edit Form */}
      {(creating || editing) && (
        <div className="bg-white rounded-xl shadow-sm border border-primary-200 p-6 mb-6">
          <h3 className="font-semibold mb-4">{creating ? 'New Product' : 'Edit Product'}</h3>
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="e.g., SmartHome Hub" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
              <input type="text" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="e.g., SH-2000" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
              <input type="text" value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="/images/product.png" />
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

      {/* Product List */}
      <div className="space-y-3">
        {items.map(p => (
          <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-sm text-gray-500">Model: {p.model}</p>
                <p className="text-sm text-gray-400 mt-0.5 max-w-lg truncate">{p.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => startEdit(p)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(p.id, p.name)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-400">
            No products yet. Click "Add Product" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
