import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { tickets } from '../../api/client';
import { WizardData } from './WizardContainer';
import { CheckCircle, FileText } from 'lucide-react';

interface Props {
  data: WizardData;
  onUpdate: (partial: Partial<WizardData>) => void;
  onPrev: () => void;
}

export default function ReviewSubmit({ data, onUpdate, onPrev }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ ticketNumber: string } | null>(null);
  const [email, setEmail] = useState(data.email || user?.email || '');
  const [name, setName] = useState(data.name || user?.name || '');

  const handleSubmit = async () => {
    if (!user && !email) { setError('Email is required'); return; }
    setError(''); setLoading(true);
    try {
      const formData = new FormData();
      formData.append('productId', String(data.product.id));
      formData.append('categoryId', String(data.category.id));
      formData.append('subject', data.subject);
      formData.append('description', data.description);
      const answersArray = Object.entries(data.answers).filter(([_, v]) => v.trim())
        .map(([qId, answer]) => ({ questionTemplateId: parseInt(qId), answer }));
      formData.append('answers', JSON.stringify(answersArray));
      if (!user) { formData.append('email', email); formData.append('name', name || 'Anonymous'); }
      for (const file of data.files) formData.append('files', file);
      const res = await tickets.create(formData);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to submit ticket');
    } finally { setLoading(false); }
  };

  if (result) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-16 h-16 text-accent-green mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Ticket Submitted!</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">Your ticket number is:</p>
        <p className="text-2xl font-mono font-bold text-accent-blue mb-6">{result.ticketNumber}</p>
        <p className="text-sm text-gray-500 mb-6">Save this number to track your ticket status.</p>
        <div className="flex justify-center gap-4">
          <button onClick={() => navigate('/track')} className="tb-btn-primary px-6">Track Ticket</button>
          <button onClick={() => navigate('/')} className="tb-btn-secondary px-6">Back to Home</button>
        </div>
      </div>
    );
  }

  const visibleQuestions = data.questions.filter(q => {
    if (!q.conditionalOn) return true;
    return data.answers[q.conditionalOn] === q.conditionalValue;
  });

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Review & Submit</h2>
      {error && <div className="mb-4 p-3 bg-status-expired-bg text-status-expired-text rounded-lg text-sm">{error}</div>}

      <div className="space-y-4">
        <div className="bg-[#f2f2f2] dark:bg-tb-bg rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-xs text-gray-500 uppercase font-medium">Product</p><p className="font-medium text-gray-900 dark:text-white">{data.product?.name}</p></div>
            <div><p className="text-xs text-gray-500 uppercase font-medium">Category</p><p className="font-medium text-gray-900 dark:text-white">{data.category?.name}</p></div>
          </div>
        </div>

        <div className="bg-[#f2f2f2] dark:bg-tb-bg rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Subject</p>
          <p className="font-medium text-gray-900 dark:text-white mb-3">{data.subject}</p>
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Description</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">{data.description}</p>
        </div>

        {visibleQuestions.length > 0 && (
          <div className="bg-[#f2f2f2] dark:bg-tb-bg rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 uppercase font-medium mb-2">Questionnaire Answers</p>
            <div className="space-y-2">
              {visibleQuestions.map(q => data.answers[q.id] && (
                <div key={q.id}>
                  <p className="text-xs text-gray-500">{q.questionText}</p>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{data.answers[q.id]}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.files.length > 0 && (
          <div className="bg-[#f2f2f2] dark:bg-tb-bg rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 uppercase font-medium mb-2">Attachments ({data.files.length})</p>
            <div className="space-y-1">
              {data.files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <FileText className="w-4 h-4 text-gray-500" /><span>{f.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!user && (
          <div className="bg-primary-500/10 rounded-lg p-4 border border-primary-500/30">
            <p className="text-sm font-medium text-accent-blue mb-3">Contact Information</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Email *</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="tb-input" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="tb-input" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-6">
        <button onClick={onPrev} className="tb-btn-secondary">Back</button>
        <button onClick={handleSubmit} disabled={loading} className="tb-btn-success px-8">
          {loading ? 'Submitting...' : 'Submit Ticket'}
        </button>
      </div>
    </div>
  );
}
