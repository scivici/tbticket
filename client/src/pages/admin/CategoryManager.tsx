import React, { useEffect, useState } from 'react';
import { products as productsApi, adminCategories } from '../../api/client';
import { FolderOpen, Plus, Pencil, Trash2, X, Save, GripVertical } from 'lucide-react';

interface Category {
  id: number;
  product_id: number;
  name: string;
  description: string;
  icon: string;
  display_order: number;
}

interface FormData {
  productId: number;
  name: string;
  description: string;
  icon: string;
  displayOrder: number;
}

const ICONS = ['wifi', 'microphone', 'cpu', 'link', 'download', 'activity', 'server', 'network', 'bell', 'trending-up', 'settings', 'alert-triangle', 'database', 'monitor', 'shield'];

const emptyForm: FormData = { productId: 0, name: '', description: '', icon: '', displayOrder: 0 };

export default function CategoryManager() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    productsApi.list().then(p => {
      setProducts(p);
      if (p.length > 0) setSelectedProductId(p[0].id);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      productsApi.categories(selectedProductId).then(setCategories).catch(console.error);
    }
  }, [selectedProductId]);

  const reload = () => {
    if (selectedProductId) {
      productsApi.categories(selectedProductId).then(setCategories).catch(console.error);
    }
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ ...emptyForm, productId: selectedProductId, displayOrder: categories.length + 1 });
    setError('');
  };

  const startEdit = (c: Category) => {
    setEditing(c.id);
    setCreating(false);
    setForm({ productId: c.product_id, name: c.name, description: c.description, icon: c.icon || '', displayOrder: c.display_order });
    setError('');
  };

  const cancel = () => { setEditing(null); setCreating(false); setError(''); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const data = { productId: form.productId, name: form.name, description: form.description, icon: form.icon, displayOrder: form.displayOrder };
      if (creating) {
        await adminCategories.create(data);
      } else if (editing) {
        await adminCategories.update(editing, data);
      }
      cancel();
      reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" kategorisini silmek istediginize emin misiniz?`)) return;
    try {
      await adminCategories.delete(id);
      reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const moveCategory = async (index: number, direction: -1 | 1) => {
    const newCategories = [...categories];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= newCategories.length) return;
    [newCategories[index], newCategories[swapIndex]] = [newCategories[swapIndex], newCategories[index]];
    const items = newCategories.map((c, i) => ({ id: c.id, displayOrder: i + 1 }));
    try {
      await adminCategories.reorder(items);
      reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Category Management</h1>
        <button onClick={startCreate} disabled={!selectedProductId}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {/* Product Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Product</label>
        <select value={selectedProductId} onChange={e => { setSelectedProductId(parseInt(e.target.value)); cancel(); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-auto">
          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.model})</option>)}
        </select>
      </div>

      {/* Create/Edit Form */}
      {(creating || editing) && (
        <div className="bg-white rounded-xl shadow-sm border border-primary-200 p-6 mb-6">
          <h3 className="font-semibold mb-4">{creating ? 'New Category' : 'Edit Category'}</h3>
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="e.g., Connectivity Issues" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
              <select value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
                <option value="">None</option>
                {ICONS.map(icon => <option key={icon} value={icon}>{icon}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
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

      {/* Category List */}
      <div className="space-y-2">
        {categories.map((c, index) => (
          <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveCategory(index, -1)} disabled={index === 0}
                  className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-30">
                  <GripVertical className="w-4 h-4 rotate-180" />
                </button>
                <button onClick={() => moveCategory(index, 1)} disabled={index === categories.length - 1}
                  className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-30">
                  <GripVertical className="w-4 h-4" />
                </button>
              </div>
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium">{c.name}</h3>
                <p className="text-sm text-gray-400">{c.description}</p>
              </div>
              {c.icon && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">{c.icon}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => startEdit(c)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(c.id, c.name)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {categories.length === 0 && selectedProductId && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-400">
            No categories for this product. Click "Add Category" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
