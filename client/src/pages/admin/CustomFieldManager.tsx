import React, { useEffect, useState } from 'react';
import { customFields as cfApi, products as productsApi } from '../../api/client';
import { Plus, Pencil, Trash2, X, Save, SlidersHorizontal } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const FIELD_TYPES = ['text', 'number', 'select', 'checkbox', 'date', 'textarea'];

interface CustomField {
  id: number;
  name: string;
  field_key: string;
  field_type: string;
  options: string[] | null;
  is_required: boolean;
  display_order: number;
  product_id: number | null;
  is_active: boolean;
  created_at: string;
}

export default function CustomFieldManager() {
  const toast = useToast();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formKey, setFormKey] = useState('');
  const [formType, setFormType] = useState('text');
  const [formOptions, setFormOptions] = useState('');
  const [formRequired, setFormRequired] = useState(false);
  const [formOrder, setFormOrder] = useState(0);
  const [formProductId, setFormProductId] = useState<string>('');
  const [formActive, setFormActive] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([cfApi.list(), productsApi.list()])
      .then(([f, p]) => { setFields(f); setProducts(p); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setFormName('');
    setFormKey('');
    setFormType('text');
    setFormOptions('');
    setFormRequired(false);
    setFormOrder(0);
    setFormProductId('');
    setFormActive(true);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (field: CustomField) => {
    setEditingId(field.id);
    setFormName(field.name);
    setFormKey(field.field_key);
    setFormType(field.field_type);
    setFormOptions(field.options ? field.options.join(', ') : '');
    setFormRequired(field.is_required);
    setFormOrder(field.display_order);
    setFormProductId(field.product_id ? String(field.product_id) : '');
    setFormActive(field.is_active);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formName,
      fieldKey: formKey,
      fieldType: formType,
      options: formType === 'select' && formOptions.trim()
        ? formOptions.split(',').map(o => o.trim()).filter(Boolean)
        : null,
      isRequired: formRequired,
      displayOrder: formOrder,
      productId: formProductId ? parseInt(formProductId) : null,
      isActive: formActive,
    };

    try {
      if (editingId) {
        await cfApi.update(editingId, data);
      } else {
        await cfApi.create(data);
      }
      resetForm();
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this custom field? All ticket values for this field will also be deleted.')) return;
    try {
      await cfApi.delete(id);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const generateKey = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="w-6 h-6 text-accent-blue" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Custom Fields</h1>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/80 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Field
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="tb-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingId ? 'Edit Custom Field' : 'New Custom Field'}
            </h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input
                type="text"
                value={formName}
                onChange={e => {
                  setFormName(e.target.value);
                  if (!editingId) setFormKey(generateKey(e.target.value));
                }}
                required
                className="tb-input w-full"
                placeholder="e.g., Environment Type"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field Key</label>
              <input
                type="text"
                value={formKey}
                onChange={e => setFormKey(e.target.value)}
                required
                className="tb-input w-full font-mono text-sm"
                placeholder="e.g., environment_type"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
              <select value={formType} onChange={e => setFormType(e.target.value)} className="tb-select w-full">
                {FIELD_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product (optional)</label>
              <select value={formProductId} onChange={e => setFormProductId(e.target.value)} className="tb-select w-full">
                <option value="">All Products</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            {formType === 'select' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Options (comma-separated)</label>
                <input
                  type="text"
                  value={formOptions}
                  onChange={e => setFormOptions(e.target.value)}
                  className="tb-input w-full"
                  placeholder="e.g., Production, Staging, Development, Testing"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Order</label>
              <input
                type="number"
                value={formOrder}
                onChange={e => setFormOrder(parseInt(e.target.value) || 0)}
                className="tb-input w-full"
              />
            </div>
            <div className="flex items-center gap-6 pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formRequired} onChange={e => setFormRequired(e.target.checked)} className="rounded" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Required</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formActive} onChange={e => setFormActive(e.target.checked)} className="rounded" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
              </label>
            </div>
            <div className="md:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={resetForm} className="tb-btn-secondary">Cancel</button>
              <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/80 transition-colors">
                <Save className="w-4 h-4" />
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Fields Table */}
      {fields.length === 0 ? (
        <div className="tb-card p-8 text-center">
          <SlidersHorizontal className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No custom fields defined yet.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Custom fields appear on ticket detail pages for additional data capture.</p>
        </div>
      ) : (
        <div className="tb-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Key</th>
                <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Type</th>
                <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Product</th>
                <th className="text-center px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Required</th>
                <th className="text-center px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Active</th>
                <th className="text-center px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Order</th>
                <th className="text-right px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fields.map(field => {
                const product = products.find((p: any) => p.id === field.product_id);
                return (
                  <tr key={field.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{field.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{field.field_key}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs font-medium">
                        {field.field_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{product?.name || 'All'}</td>
                    <td className="px-4 py-3 text-center">{field.is_required ? '✓' : '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${field.is_active ? 'bg-green-400' : 'bg-gray-400'}`} />
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">{field.display_order}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => startEdit(field)} className="p-1.5 text-gray-400 hover:text-accent-blue transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(field.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
