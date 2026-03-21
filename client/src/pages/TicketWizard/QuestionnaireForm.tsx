import React, { useEffect, useState } from 'react';
import { products as productsApi } from '../../api/client';
import { WizardData } from './WizardContainer';

interface Props {
  data: WizardData;
  onUpdate: (partial: Partial<WizardData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function QuestionnaireForm({ data, onUpdate, onNext, onPrev }: Props) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState(data.subject);
  const [description, setDescription] = useState(data.description);
  const [answers, setAnswers] = useState<Record<number, string>>(data.answers);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data.category) {
      productsApi.questions(data.category.id).then(q => { setQuestions(q); setLoading(false); }).catch(console.error);
    }
  }, [data.category]);

  const setAnswer = (questionId: number, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const isVisible = (q: any) => {
    if (!q.conditionalOn) return true;
    return answers[q.conditionalOn] === q.conditionalValue;
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!subject.trim()) errs.subject = 'Subject is required';
    if (!description.trim()) errs.description = 'Description is required';
    for (const q of questions) {
      if (q.isRequired && isVisible(q) && !answers[q.id]?.trim()) {
        errs[`q_${q.id}`] = 'This field is required';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    onUpdate({ subject, description, answers, questions });
    onNext();
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading questions...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tell us about the issue</h2>

      <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Subject *</label>
        <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
          placeholder="Brief summary of the issue"
          className={`tb-input ${errors.subject ? 'border-red-500' : ''}`} />
        {errors.subject && <p className="text-red-400 text-xs mt-1">{errors.subject}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Description *</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          rows={3} placeholder="Describe the issue in detail..."
          className={`tb-input ${errors.description ? 'border-red-500' : ''}`} />
        {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description}</p>}
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      {questions.filter(isVisible).map(q => (
        <div key={q.id}>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
            {q.questionText} {q.isRequired && '*'}
          </label>
          {renderQuestion(q, answers[q.id] || '', (val: string) => setAnswer(q.id, val))}
          {errors[`q_${q.id}`] && <p className="text-red-400 text-xs mt-1">{errors[`q_${q.id}`]}</p>}
        </div>
      ))}

      <div className="flex justify-between pt-4">
        <button onClick={onPrev} className="tb-btn-secondary">Back</button>
        <button onClick={handleNext} className="tb-btn-primary px-6">Next</button>
      </div>
    </div>
  );
}

function renderQuestion(q: any, value: string, onChange: (val: string) => void) {
  switch (q.questionType) {
    case 'text':
      return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={q.placeholder || ''} className="tb-input" />;
    case 'textarea':
      return <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} placeholder={q.placeholder || ''} className="tb-input" />;
    case 'number':
      return <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={q.placeholder || ''} className="tb-input" />;
    case 'date':
      return <input type="date" value={value} onChange={e => onChange(e.target.value)} className="tb-input" />;
    case 'select':
      return (
        <select value={value} onChange={e => onChange(e.target.value)} className="tb-select w-full">
          <option value="">Select an option...</option>
          {(q.options || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    case 'radio':
      return (
        <div className="space-y-2">
          {(q.options || []).map((opt: string) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer text-gray-600 dark:text-gray-300">
              <input type="radio" name={`q_${q.id}`} value={opt} checked={value === opt}
                onChange={() => onChange(opt)} className="text-primary-500 focus:ring-primary-500 bg-white dark:bg-tb-card border-gray-300 dark:border-gray-600" />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      );
    case 'multiselect':
      const selected = value ? value.split(',').filter(Boolean) : [];
      return (
        <div className="space-y-2">
          {(q.options || []).map((opt: string) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={selected.includes(opt)}
                onChange={e => {
                  const newSelected = e.target.checked ? [...selected, opt] : selected.filter(s => s !== opt);
                  onChange(newSelected.join(','));
                }}
                className="rounded text-primary-500 focus:ring-primary-500 bg-white dark:bg-tb-card border-gray-300 dark:border-gray-600" />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 cursor-pointer text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={value === 'true'} onChange={e => onChange(e.target.checked ? 'true' : 'false')}
            className="rounded text-primary-500 focus:ring-primary-500 bg-white dark:bg-tb-card border-gray-300 dark:border-gray-600" />
          <span className="text-sm">{q.questionText}</span>
        </label>
      );
    default:
      return <input type="text" value={value} onChange={e => onChange(e.target.value)} className="tb-input" />;
  }
}
