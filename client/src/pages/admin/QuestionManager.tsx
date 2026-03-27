import React, { useEffect, useState } from 'react';
import { products as productsApi, adminQuestions } from '../../api/client';
import { Plus, Pencil, Trash2, X, Save, ChevronUp, ChevronDown, GitBranch } from 'lucide-react';

const QUESTION_TYPES = [
  { value: 'text', label: 'Text Input' }, { value: 'textarea', label: 'Text Area' },
  { value: 'select', label: 'Dropdown Select' }, { value: 'multiselect', label: 'Multi Select' },
  { value: 'radio', label: 'Radio Buttons' }, { value: 'checkbox', label: 'Single Checkbox' },
  { value: 'number', label: 'Number' }, { value: 'date', label: 'Date' },
];

interface Question { id: number; category_id: number; question_text: string; question_type: string; options: any; is_required: boolean | number; display_order: number; conditional_on: number | null; conditional_value: string | null; placeholder: string | null; }

export default function QuestionManager() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ categoryId: 0, questionText: '', questionType: 'text', options: '', isRequired: true, displayOrder: 0, conditionalOn: null as number | null, conditionalValue: '', placeholder: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { productsApi.list().then(p => { setProducts(p); if (p.length > 0) setSelectedProductId(p[0].id); }).catch(console.error).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (selectedProductId) productsApi.categories(selectedProductId).then(cats => { setCategories(cats); if (cats.length > 0) setSelectedCategoryId(cats[0].id); else { setSelectedCategoryId(0); setQuestions([]); } }).catch(console.error); }, [selectedProductId]);
  useEffect(() => { if (selectedCategoryId) adminQuestions.list(selectedCategoryId).then(setQuestions).catch(console.error); else setQuestions([]); }, [selectedCategoryId]);
  const reload = () => { if (selectedCategoryId) adminQuestions.list(selectedCategoryId).then(setQuestions).catch(console.error); };

  const startCreate = () => { setCreating(true); setEditing(null); setForm({ categoryId: selectedCategoryId, questionText: '', questionType: 'text', options: '', isRequired: true, displayOrder: questions.length + 1, conditionalOn: null, conditionalValue: '', placeholder: '' }); setError(''); };
  const startEdit = (q: Question) => {
    setEditing(q.id); setCreating(false);
    let optionsStr = ''; if (q.options) { try { const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options; optionsStr = Array.isArray(opts) ? opts.join('\n') : String(opts); } catch { optionsStr = String(q.options); } }
    setForm({ categoryId: q.category_id, questionText: q.question_text, questionType: q.question_type, options: optionsStr, isRequired: !!q.is_required, displayOrder: q.display_order, conditionalOn: q.conditional_on, conditionalValue: q.conditional_value || '', placeholder: q.placeholder || '' });
    setError('');
  };
  const cancel = () => { setEditing(null); setCreating(false); setError(''); };
  const needsOptions = ['select', 'multiselect', 'radio'].includes(form.questionType);

  const handleSave = async () => {
    if (!form.questionText.trim()) { setError('Question text is required'); return; }
    if (needsOptions && !form.options.trim()) { setError('Options are required'); return; }
    setSaving(true); setError('');
    try {
      const optionsArray = needsOptions ? form.options.split('\n').map(o => o.trim()).filter(Boolean) : null;
      const data = { categoryId: form.categoryId, questionText: form.questionText, questionType: form.questionType, options: optionsArray, isRequired: form.isRequired, displayOrder: form.displayOrder, conditionalOn: form.conditionalOn || null, conditionalValue: form.conditionalValue || null, placeholder: form.placeholder || null };
      if (creating) await adminQuestions.create(data); else if (editing) await adminQuestions.update(editing, data);
      cancel(); reload();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: number, text: string) => { if (!confirm(`Bu soruyu silmek istediginize emin misiniz?\n"${text}"`)) return; try { await adminQuestions.delete(id); reload(); } catch (err: any) { alert(err.message); } };
  const moveQuestion = async (index: number, direction: -1 | 1) => { const arr = [...questions]; const si = index + direction; if (si < 0 || si >= arr.length) return; [arr[index], arr[si]] = [arr[si], arr[index]]; try { await adminQuestions.reorder(arr.map((q, i) => ({ id: q.id, displayOrder: i + 1 }))); reload(); } catch (err: any) { alert(err.message); } };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Question Templates</h1>
        <button onClick={startCreate} disabled={!selectedCategoryId} className="tb-btn-primary flex items-center gap-2 disabled:opacity-50"><Plus className="w-4 h-4" /> Add Question</button>
      </div>

      <div className="flex gap-4 mb-6">
        <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Product</label><select value={selectedProductId} onChange={e => { setSelectedProductId(parseInt(e.target.value)); cancel(); }} className="tb-select">{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Category</label><select value={selectedCategoryId} onChange={e => { setSelectedCategoryId(parseInt(e.target.value)); cancel(); }} className="tb-select">{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      </div>

      {(creating || editing) && (
        <div className="tb-card border-primary-500/30 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{creating ? 'New Question' : 'Edit Question'}</h3>
          {error && <div className="mb-4 p-3 bg-status-expired-bg text-status-expired-text rounded-lg text-sm">{error}</div>}
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Question Text *</label><input type="text" value={form.questionText} onChange={e => setForm(f => ({ ...f, questionText: e.target.value }))} className="tb-input" /></div>
              <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Type</label><select value={form.questionType} onChange={e => setForm(f => ({ ...f, questionType: e.target.value }))} className="tb-select w-full">{QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Placeholder</label><input type="text" value={form.placeholder} onChange={e => setForm(f => ({ ...f, placeholder: e.target.value }))} className="tb-input" /></div>
            </div>
            {needsOptions && (<div><label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Options (one per line) *</label><textarea value={form.options} onChange={e => setForm(f => ({ ...f, options: e.target.value }))} rows={4} className="tb-input font-mono text-sm" placeholder={"Option 1\nOption 2\nOption 3"} /></div>)}
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isRequired} onChange={e => setForm(f => ({ ...f, isRequired: e.target.checked }))} className="rounded text-primary-500 bg-white dark:bg-tb-card border-gray-300 dark:border-gray-600" /><span className="text-sm font-medium text-gray-600 dark:text-gray-300">Required</span></label>
            <div className="bg-[#f2f2f2] dark:bg-tb-bg rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3"><GitBranch className="w-4 h-4 text-gray-500" /><span className="text-sm font-medium text-gray-600 dark:text-gray-300">Conditional Display</span></div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-500 mb-1">Show only when this question...</label><select value={form.conditionalOn || ''} onChange={e => setForm(f => ({ ...f, conditionalOn: e.target.value ? parseInt(e.target.value) : null }))} className="tb-select w-full"><option value="">Always visible</option>{questions.filter(q => q.id !== editing).map(q => (<option key={q.id} value={q.id}>Q{q.display_order}: {q.question_text.substring(0, 40)}...</option>))}</select></div>
                {form.conditionalOn && (<div><label className="block text-xs text-gray-500 mb-1">...has this answer</label><input type="text" value={form.conditionalValue} onChange={e => setForm(f => ({ ...f, conditionalValue: e.target.value }))} className="tb-input" placeholder="Exact answer value" /></div>)}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={cancel} className="tb-btn-secondary flex items-center gap-1"><X className="w-4 h-4" /> Cancel</button>
            <button onClick={handleSave} disabled={saving} className="tb-btn-success flex items-center gap-1"><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {questions.map((q, index) => (
          <div key={q.id} className="tb-card p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-0.5 mt-1">
                  <button onClick={() => moveQuestion(index, -1)} disabled={index === 0} className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                  <button onClick={() => moveQuestion(index, 1)} disabled={index === questions.length - 1} className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                </div>
                <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-purple-400">{q.display_order}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">{q.question_text}</h3>
                    {q.is_required ? <span className="px-1.5 py-0.5 bg-status-expired-bg text-status-expired-text text-xs rounded">Required</span> : null}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full">{q.question_type}</span>
                    {q.options && <span className="text-xs text-gray-500">{(typeof q.options === 'string' ? JSON.parse(q.options) : q.options).length} options</span>}
                    {q.conditional_on && <span className="flex items-center gap-1 text-xs text-accent-amber"><GitBranch className="w-3 h-3" /> Conditional</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => startEdit(q)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-accent-blue hover:bg-black/10 dark:hover:bg-white/10 rounded-lg"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(q.id, q.question_text)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
        {questions.length === 0 && selectedCategoryId > 0 && <div className="text-center py-12 tb-card text-gray-500">No questions for this category.</div>}
      </div>
    </div>
  );
}
