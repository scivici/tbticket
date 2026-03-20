import React, { useState } from 'react';
import Stepper from '../../components/Stepper';
import ProductSelect from './ProductSelect';
import CategorySelect from './CategorySelect';
import QuestionnaireForm from './QuestionnaireForm';
import FileUpload from './FileUpload';
import ReviewSubmit from './ReviewSubmit';

const steps = [
  { label: 'Product' },
  { label: 'Category' },
  { label: 'Details' },
  { label: 'Files' },
  { label: 'Review' },
];

export interface WizardData {
  product: any | null;
  category: any | null;
  answers: Record<number, string>;
  questions: any[];
  subject: string;
  description: string;
  files: File[];
  email: string;
  name: string;
}

export default function WizardContainer() {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<WizardData>({
    product: null,
    category: null,
    answers: {},
    questions: [],
    subject: '',
    description: '',
    files: [],
    email: '',
    name: '',
  });

  const next = () => setCurrentStep(s => Math.min(s + 1, steps.length - 1));
  const prev = () => setCurrentStep(s => Math.max(s - 1, 0));
  const update = (partial: Partial<WizardData>) => setData(d => ({ ...d, ...partial }));

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-2">Submit a Support Ticket</h1>
      <p className="text-gray-500 text-center mb-8">We'll guide you through reporting your issue step by step.</p>

      <Stepper steps={steps} currentStep={currentStep} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8">
        {currentStep === 0 && (
          <ProductSelect data={data} onUpdate={update} onNext={next} />
        )}
        {currentStep === 1 && (
          <CategorySelect data={data} onUpdate={update} onNext={next} onPrev={prev} />
        )}
        {currentStep === 2 && (
          <QuestionnaireForm data={data} onUpdate={update} onNext={next} onPrev={prev} />
        )}
        {currentStep === 3 && (
          <FileUpload data={data} onUpdate={update} onNext={next} onPrev={prev} />
        )}
        {currentStep === 4 && (
          <ReviewSubmit data={data} onUpdate={update} onPrev={prev} />
        )}
      </div>
    </div>
  );
}
