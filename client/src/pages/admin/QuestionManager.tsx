import React, { useEffect, useState } from 'react';
import { products as productsApi, adminQuestions } from '../../api/client';
import { HelpCircle, Plus, Pencil, Trash2, X, Save, ChevronUp, ChevronDown, GitBranch } from 'lucide-react';

const QUESTION_TYPES = [
  { value: 'text', label: 'Text Input' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'select', label: 'Dropdown Select' },
  { value: 'multiselect', label: 'Multi Select (Checkboxes)' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'checkbox', label: 'Single Checkbox' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
];

interface Question {
  id: number;
  category_id: number;
  question_text: string;
  question_type: string;
  options: string | null;
  is_required: number;
  display_order: number;
  conditional_on: number | null;
  conditional_value: string | null;
  placeholder: string | null;
  validation_rules: string | null;
}

interface FormData {
  categoryId: number;
  questionText: string;
  questionType: string;
  options: string;
  isRequired: boolean;
  displayOrder: number;
  conditionalOn: number | null;
  conditionalValue: string;
  placeholder: string;
}

const emptyForm: FormData = {
  categoryId: 0, questionText: '', questionType: 'text', options: '',
  isRequired: true, displayOrder: 0, conditionalOn: null, conditionalValue: '', placeholder: '',
};

export default function QuestionManager() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(0);
  const [questions, setQuestions] = useState<Question[]>([]);
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
      productsApi.categories(selectedProductId).then(cats => {
        setCategories(cats);
        if (cats.length > 0) setSelectedCategoryId(cats[0].id);
        else { setSelectedCategoryId(0); setQuestions([]); }
      }).catch(console.error);
    }
  }, [selectedProductId]);

  useEffect(() => {
    if (selectedCategoryId) {
      adminQuestions.list(selectedCategoryId).then(setQuestions).catch(console.error);
    } else {
      setQuestions([]);
    }
  }, [selectedCategoryId]);

  const reload = () => {
    if (selectedCategoryId) adminQuestions.list(selectedCategoryId).then(setQuestions).catch(console.error);
  };

  const startCreate = () => {
    setCreating(true); setEditing(null);
    setForm({ ...emptyForm, categoryId: selectedCategoryId, displayOrder: questions.length + 1 });
    setError('');
  };

  const startEdit = (q: Question) => {
    setEditing(q.id); setCreating(false);
    let optionsStr = '';
    if (q.options) {
      try { optionsStr = JSON.parse(q.options).join('\n'); } catch { optionsStr = q.options; }
    }
    setForm({
      categoryId: q.category_id, questionText: q.question_text, questionType: q.question_type,
      options: optionsStr, isRequired: !!q.is_required, displayOrder: q.display_order,
      conditionalOn: q.conditional_on, conditionalValue: q.conditional_value || '', placeholder: q.placeholder || '',
    });
    setError('');
  };

  const cancel = () => { setEditing(null); setCreating(false); setError(''); };

  const needsOptions = ['select', 'multiselect', 'radio'].includes(form.questionType);

  const handleSave = async () => {
    if (!form.questionText.trim()) { setError('Question text is required'); return; }
    if (needsOptions && !form.options.trim()) { setError('Options are required for this question type'); return; }
    setSaving(true); setError('');
    try {
      const optionsArray = needsOptions ? form.options.split('\n').map(o => o.trim()).filter(Boolean) : null;
      const data = {
        categoryId: form.categoryId,
        questionText: form.questionText,
        questionType: form.questionType,
        options: optionsArray,
        isRequired: form.isRequired,
        displayOrder: form.displayOrder,
        conditionalOn: form.conditionalOn || null,
        conditionalValue: form.conditionalValue || null,
        placeholder: form.placeholder || null,
      };
      if (creating) await adminQuestions.create(data);
      else if (editing) await adminQuestions.update(editing, data);
      cancel(); reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, text: string) => {
    if (!confirm(`Bu soruyu silmek istediginize emin misiniz?\n"${text}"`)) return;
    try { await adminQuestions.delete(id); reload(); } catch (err: any) { alert(err.message); }
  };

  const moveQuestion = async (index: number, direction: -1 | 1) => {
    const arr = [...questions];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= arr.length) return;
    [arr[index], arr[swapIndex]] = [arr[swapIndex], arr[index]];
    const items = arr.map((q, i) => ({ id: q.id, displayOrder: i + 1 }));
    try { await adminQuestions.reorder(items); reload(); } catch (err: any) { alert(err.message); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Question Templates</h1>
        <button onClick={startCreate} disabled={!selectedCategoryId}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
          <Plus className="w-4 h-4" /> Add Question
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
          <select value={selectedProductId} onChange={e => { setSelectedProductId(parseInt(e.target.value)); cancel(); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select value={selectedCategoryId} onChange={e => { setSelectedCategoryId(parseInt(e.target.value)); cancel(); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Create/Edit Form */}
      {(creating || editing) && (
        <div className="bg-white rounded-xl shadow-sm border border-primary-200 p-6 mb-6">
          <h3 className="font-semibold mb-4">{creating ? 'New Question' : 'Edit Question'}</h3>
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Question Text *</label>
                <input type="text" value={form.questionText} onChange={e => setForm(f => ({ ...f, questionText: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., Which protocol is affected?" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={form.questionType} onChange={e => setForm(f => ({ ...f, questionType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
                  {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
                <input type="text" value={form.placeholder} onChange={e => setForm(f => ({ ...f, placeholder: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>

            {needsOptions && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Options (one per line) *</label>
                <textarea value={form.options} onChange={e => setForm(f => ({ ...f, options: e.target.value }))}
                  rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                  placeholder={"Option 1\nOption 2\nOption 3"} />
              </div>
            )}

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isRequired} onChange={e => setForm(f => ({ ...f, isRequired: e.target.checked }))}
                  className="rounded text-primary-600 focus:ring-primary-500" />
                <span className="text-sm font-medium text-gray-700">Required</span>
              </label>
            </div>

            {/* Conditional Logic */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <GitBranch className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Conditional Display (optional)</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Show only when this question...</label>
                  <select value={form.conditionalOn || ''} onChange={e => setForm(f => ({ ...f, conditionalOn: e.target.value ? parseInt(e.target.value) : null }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">Always visible</option>
                    {questions.filter(q => q.id !== editing).map(q => (
                      <option key={q.id} value={q.id}>Q{q.display_order}: {q.question_text.substring(0, 40)}...</option>
                    ))}
                  </select>
                </div>
                {form.conditionalOn && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">...has this answer</label>
                    <input type="text" value={form.conditionalValue} onChange={e => setForm(f => ({ ...f, conditionalValue: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Exact answer value" />
                  </div>
                )}
              </div>
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

      {/* Question List */}
      <div className="space-y-2">
        {questions.map((q, index) => (
          <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-0.5 mt-1">
                  <button onClick={() => moveQuestion(index, -1)} disabled={index === 0}
                    className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-30">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => moveQuestion(index, 1)} disabled={index === questions.length - 1}
                    className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-30">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-sm font-bold text-purple-600">
                  {q.display_order}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{q.question_text}</h3>
                    {q.is_required ? (
                      <span className="px-1.5 py-0.5 bg-red-50 text-red-600 text-xs rounded">Required</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{q.question_type}</span>
                    {q.options && (
                      <span className="text-xs text-gray-400">
                        {JSON.parse(q.options).length} options
                      </span>
                    )}
                    {q.conditional_on && (
                      <span className="flex items-center gap-1 text-xs text-amber-600">
                        <GitBranch className="w-3 h-3" /> Conditional
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => startEdit(q)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(q.id, q.question_text)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {questions.length === 0 && selectedCategoryId > 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-400">
            No questions for this category. Click "Add Question" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
