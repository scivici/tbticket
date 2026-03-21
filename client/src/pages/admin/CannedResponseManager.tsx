import React, { useEffect, useState } from 'react';
import { cannedResponses as api } from '../../api/client';
import { MessageSquarePlus, Plus, Pencil, Trash2, Copy, Check, X } from 'lucide-react';

export default function CannedResponseManager() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: '', content: '', category: '' });
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');

  const load = () => {
    setLoading(true);
    api.list().then(setItems).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const categories = Array.from(new Set(items.map(i => i.category).filter(Boolean)));

  const filtered = categoryFilter
    ? items.filter(i => i.category === categoryFilter)
    : items;

  const resetForm = () => {
    setForm({ title: '', content: '', category: '' });
    setEditId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category.trim() || undefined,
      };
      if (editId) {
        await api.update(editId, payload);
      } else {
        await api.create(payload as any);
      }
      resetForm();
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleEdit = (item: any) => {
    setForm({ title: item.title, content: item.content, category: item.category || '' });
    setEditId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number, title: string) => {
    if (!window.confirm(`Delete canned response "${title}"?`)) return;
    try {
      await api.delete(id);
      load();
    } catch (err) { console.error(err); }
  };

  const handleCopy = async (id: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading canned responses...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageSquarePlus className="w-6 h-6 text-accent-blue" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Canned Responses</h1>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-accent-blue text-white rounded-lg hover:bg-accent-blue/80 transition-colors">
          <Plus className="w-4 h-4" />
          New Response
        </button>
      </div>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="mb-6">
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="tb-select">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="tb-card p-6 mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            {editId ? 'Edit Canned Response' : 'New Canned Response'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Title</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Response title..." className="tb-input w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Content</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Response content..." rows={5} className="tb-input w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Category (optional)</label>
              <input type="text" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Greeting, Troubleshooting..." className="tb-input w-full" />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button onClick={handleSave} disabled={saving || !form.title.trim() || !form.content.trim()}
                className="px-4 py-2 text-sm font-medium bg-accent-blue text-white rounded-lg hover:bg-accent-blue/80 disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
              </button>
              <button onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="tb-card p-8 text-center text-gray-500 dark:text-gray-400">
          {categoryFilter ? 'No canned responses in this category.' : 'No canned responses yet. Create your first one!'}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item: any) => (
            <div key={item.id} className="tb-card p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">{item.title}</h4>
                  {item.category && (
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs font-medium">{item.category}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleCopy(item.id, item.content)} title="Copy to clipboard"
                    className="p-1.5 text-gray-400 hover:text-accent-blue transition-colors">
                    {copiedId === item.id ? <Check className="w-4 h-4 text-accent-green" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleEdit(item)} title="Edit"
                    className="p-1.5 text-gray-400 hover:text-accent-blue transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(item.id, item.title)} title="Delete"
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{item.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
