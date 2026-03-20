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
    if (!user && !email) {
      setError('Email is required');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('productId', String(data.product.id));
      formData.append('categoryId', String(data.category.id));
      formData.append('subject', data.subject);
      formData.append('description', data.description);

      // Answers
      const answersArray = Object.entries(data.answers)
        .filter(([_, v]) => v.trim())
        .map(([qId, answer]) => ({ questionTemplateId: parseInt(qId), answer }));
      formData.append('answers', JSON.stringify(answersArray));

      // Anonymous user info
      if (!user) {
        formData.append('email', email);
        formData.append('name', name || 'Anonymous');
      }

      // Files
      for (const file of data.files) {
        formData.append('files', file);
      }

      const res = await tickets.create(formData);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to submit ticket');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Ticket Submitted!</h2>
        <p className="text-gray-600 mb-4">Your ticket number is:</p>
        <p className="text-2xl font-mono font-bold text-primary-600 mb-6">{result.ticketNumber}</p>
        <p className="text-sm text-gray-500 mb-6">Save this number to track your ticket status.</p>
        <div className="flex justify-center gap-4">
          <button onClick={() => navigate('/track')}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700">
            Track Ticket
          </button>
          <button onClick={() => navigate('/')}
            className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            Back to Home
          </button>
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
      <h2 className="text-lg font-semibold mb-4">Review & Submit</h2>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="space-y-4">
        {/* Product & Category */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Product</p>
              <p className="font-medium">{data.product?.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Category</p>
              <p className="font-medium">{data.category?.name}</p>
            </div>
          </div>
        </div>

        {/* Subject & Description */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Subject</p>
          <p className="font-medium mb-3">{data.subject}</p>
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Description</p>
          <p className="text-sm text-gray-700">{data.description}</p>
        </div>

        {/* Answers */}
        {visibleQuestions.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase font-medium mb-2">Questionnaire Answers</p>
            <div className="space-y-2">
              {visibleQuestions.map(q => (
                data.answers[q.id] && (
                  <div key={q.id}>
                    <p className="text-xs text-gray-500">{q.questionText}</p>
                    <p className="text-sm font-medium">{data.answers[q.id]}</p>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        {/* Files */}
        {data.files.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase font-medium mb-2">Attachments ({data.files.length})</p>
            <div className="space-y-1">
              {data.files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span>{f.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact Info for anonymous */}
        {!user && (
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-800 mb-3">Contact Information</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-blue-700 mb-1">Email *</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm text-blue-700 mb-1">Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-6">
        <button onClick={onPrev} className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
          Back
        </button>
        <button onClick={handleSubmit} disabled={loading}
          className="px-8 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
          {loading ? 'Submitting...' : 'Submit Ticket'}
        </button>
      </div>
    </div>
  );
}
