import React, { useEffect, useState } from 'react';
import { engineers as engineersApi } from '../../api/client';
import { User, Star, ChevronDown, ChevronUp, Plus, Pencil, Trash2, X, Save } from 'lucide-react';

interface EngineerForm {
  name: string;
  email: string;
  location: string;
  maxWorkload: number;
  isActive: boolean;
}

const emptyForm: EngineerForm = { name: '', email: '', location: '', maxWorkload: 5, isActive: true };

export default function EngineerManager() {
  const [engineers, setEngineers] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);

  // CRUD state
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<EngineerForm>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      engineersApi.list(),
      engineersApi.skills(),
    ]).then(([e, s]) => {
      setEngineers(e);
      setSkills(s);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleExpand = async (id: number) => {
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(id);
    const d = await engineersApi.get(id);
    setDetail(d);
  };

  const updateSkill = async (engineerId: number, skillId: number, proficiency: number) => {
    if (!detail) return;
    const currentSkills = detail.skills.map((s: any) => ({
      skillId: s.id,
      proficiency: s.id === skillId ? proficiency : s.proficiency,
    }));
    if (!currentSkills.find((s: any) => s.skillId === skillId)) {
      currentSkills.push({ skillId, proficiency });
    }
    await engineersApi.updateSkills(engineerId, currentSkills);
    const d = await engineersApi.get(engineerId);
    setDetail(d);
  };

  // CRUD handlers
  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm(emptyForm);
    setError('');
  };

  const startEdit = (eng: any) => {
    setEditing(eng.id);
    setCreating(false);
    setForm({
      name: eng.name,
      email: eng.email,
      location: eng.location,
      maxWorkload: eng.maxWorkload,
      isActive: eng.isActive,
    });
    setError('');
  };

  const cancel = () => {
    setCreating(false);
    setEditing(null);
    setForm(emptyForm);
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.location.trim()) {
      setError('Name, email, and location are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (creating) {
        await engineersApi.create(form);
      } else if (editing) {
        await engineersApi.update(editing, form);
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
    if (!confirm(`"${name}" muhendisini silmek istediginize emin misiniz?`)) return;
    try {
      await engineersApi.delete(id);
      if (expanded === id) { setExpanded(null); setDetail(null); }
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading engineers...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Engineer Management</h1>
        <button onClick={startCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
          <Plus className="w-4 h-4" /> Add Engineer
        </button>
      </div>

      {/* Create/Edit Form */}
      {(creating || editing) && (
        <div className="bg-white rounded-xl shadow-sm border border-primary-200 p-6 mb-6">
          <h3 className="font-semibold mb-4">{creating ? 'New Engineer' : 'Edit Engineer'}</h3>
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="e.g., Alice Chen" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="e.g., alice@company.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
              <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="e.g., San Francisco" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Workload</label>
              <input type="number" min={1} max={20} value={form.maxWorkload} onChange={e => setForm(f => ({ ...f, maxWorkload: parseInt(e.target.value) || 5 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
            </div>
            {editing && (
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    className="rounded text-primary-600 focus:ring-primary-500" />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
              </div>
            )}
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

      {/* Engineer List */}
      <div className="space-y-3">
        {engineers.map(eng => (
          <div key={eng.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <button onClick={() => toggleExpand(eng.id)} className="flex items-center gap-3 flex-1 text-left hover:bg-gray-50 -m-2 p-2 rounded-lg">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="font-medium">{eng.name}</p>
                  <p className="text-sm text-gray-500">{eng.email} - {eng.location}</p>
                </div>
              </button>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium">Workload: {eng.currentWorkload}/{eng.maxWorkload}</p>
                  <div className="w-24 bg-gray-100 rounded-full h-2 mt-1">
                    <div className={`h-2 rounded-full ${eng.currentWorkload / eng.maxWorkload > 0.8 ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{ width: `${(eng.currentWorkload / eng.maxWorkload) * 100}%` }} />
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${eng.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {eng.isActive ? 'Active' : 'Inactive'}
                </span>
                <button onClick={() => startEdit(eng)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(eng.id, eng.name)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => toggleExpand(eng.id)} className="p-1 text-gray-400">
                  {expanded === eng.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {expanded === eng.id && detail && (
              <div className="border-t border-gray-100 p-4 bg-gray-50">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Skills */}
                  <div>
                    <h4 className="font-medium text-sm mb-3">Skills</h4>
                    <div className="space-y-2">
                      {skills.map((skill: any) => {
                        const engineerSkill = detail.skills?.find((s: any) => s.id === skill.id);
                        const proficiency = engineerSkill?.proficiency || 0;
                        return (
                          <div key={skill.id} className="flex items-center justify-between">
                            <span className="text-sm">{skill.name}</span>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map(level => (
                                <button key={level}
                                  onClick={() => updateSkill(eng.id, skill.id, level)}
                                  className="p-0.5">
                                  <Star className={`w-4 h-4 ${level <= proficiency ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Product Expertise */}
                  <div>
                    <h4 className="font-medium text-sm mb-3">Product Expertise</h4>
                    <div className="space-y-2">
                      {(detail.expertise || []).map((exp: any, i: number) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm">{exp.productName} / {exp.categoryName || 'General'}</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(level => (
                              <Star key={level}
                                className={`w-4 h-4 ${level <= exp.expertiseLevel ? 'fill-blue-400 text-blue-400' : 'text-gray-300'}`} />
                            ))}
                          </div>
                        </div>
                      ))}
                      {(!detail.expertise || detail.expertise.length === 0) && (
                        <p className="text-sm text-gray-400">No product expertise assigned yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {engineers.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-400">
            No engineers yet. Click "Add Engineer" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
