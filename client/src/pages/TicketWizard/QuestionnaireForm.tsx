import React, { useEffect, useState } from 'react';
import { products as productsApi, settings as settingsApi } from '../../api/client';
import { WizardData } from './WizardContainer';
import { Key, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';

interface Props {
  data: WizardData;
  onUpdate: (partial: Partial<WizardData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

// Product Key / Serial Number config per product
function getProductKeyConfig(product: any): { label: string; placeholder: string; pattern: RegExp; hint: string } | null {
  if (!product) return null;
  const name = (product.name || '').toLowerCase();

  if (name.includes('prosbc')) {
    return {
      label: 'Product Key',
      placeholder: 'VTB-XXXX-XXXX',
      pattern: /^VTB-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/,
      hint: 'Format: VTB-XXXX-XXXX (e.g., VTB-1A2V-3C4D)',
    };
  }

  if (name.includes('tmg') || name.includes('tsg')) {
    return {
      label: 'Serial Number',
      placeholder: 'TB0XXXXX',
      pattern: /^TB0\d{5}$/,
      hint: 'Format: TB0 followed by 5 digits (e.g., TB021234)',
    };
  }

  return null;
}

export default function QuestionnaireForm({ data, onUpdate, onNext, onPrev }: Props) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState(data.subject);
  const [description, setDescription] = useState(data.description);
  const [productKey, setProductKey] = useState(data.productKey);
  const [answers, setAnswers] = useState<Record<number, string>>(data.answers);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [licenseChecking, setLicenseChecking] = useState(false);
  const [licenseError, setLicenseError] = useState<{ message: string; redirectUrl?: string } | null>(null);

  const keyConfig = getProductKeyConfig(data.product);

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

    // Product Key / Serial Number validation
    if (keyConfig) {
      if (!productKey.trim()) {
        errs.productKey = `${keyConfig.label} is required`;
      } else if (!keyConfig.pattern.test(productKey.trim())) {
        errs.productKey = `Invalid format. ${keyConfig.hint}`;
      }
    }

    for (const q of questions) {
      if (q.isRequired && isVisible(q) && !answers[q.id]?.trim()) {
        errs[`q_${q.id}`] = 'This field is required';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = async () => {
    if (!validate()) return;
    setLicenseError(null);

    // Check license/support agreement if product key is provided
    if (keyConfig && productKey.trim()) {
      setLicenseChecking(true);
      try {
        const result = await settingsApi.checkLicense(productKey.trim());
        if (!result.hasSupport) {
          setLicenseError({
            message: result.message || 'No active support agreement found.',
            redirectUrl: result.redirectUrl,
          });
          setLicenseChecking(false);
          return;
        }
      } catch {
        // If license check fails (API not configured, network error), allow to proceed
        console.warn('[License] Check failed, proceeding anyway');
      }
      setLicenseChecking(false);
    }

    onUpdate({ subject, description, productKey, answers, questions });
    onNext();
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading questions...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tell us about the issue</h2>

      {/* Product Key / Serial Number — always first, always required */}
      {keyConfig && (
        <div className="bg-primary-500/10 rounded-lg p-4 border border-primary-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-4 h-4 text-accent-blue" />
            <label className="text-sm font-medium text-gray-900 dark:text-white">{keyConfig.label} *</label>
          </div>
          <input
            type="text"
            value={productKey}
            onChange={e => setProductKey(e.target.value.toUpperCase())}
            placeholder={keyConfig.placeholder}
            className={`tb-input font-mono tracking-wider ${errors.productKey ? 'border-red-500' : ''}`}
          />
          <p className="text-xs text-gray-500 mt-1">{keyConfig.hint}</p>
          {errors.productKey && <p className="text-red-400 text-xs mt-1 font-medium">{errors.productKey}</p>}
        </div>
      )}

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

      {/* License/Support error */}
      {licenseError && (
        <div className="bg-status-expired-bg border border-red-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-status-expired-text flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-status-expired-text">{licenseError.message}</p>
              {licenseError.redirectUrl && (
                <a href={licenseError.redirectUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-primary-500 hover:underline">
                  <ExternalLink className="w-4 h-4" />
                  View Support Options
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button onClick={onPrev} className="tb-btn-secondary">Back</button>
        <button onClick={handleNext} disabled={licenseChecking} className="tb-btn-primary px-6 disabled:opacity-50">
          {licenseChecking ? (
            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Checking license...</span>
          ) : 'Next'}
        </button>
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
