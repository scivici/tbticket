import React from 'react';
import { Check } from 'lucide-react';

interface Step {
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
}

export default function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <nav className="flex items-center justify-center mb-8">
      <ol className="flex items-center space-x-2 sm:space-x-4">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <div className={`w-8 sm:w-16 h-0.5 mx-1 sm:mx-2 ${isCompleted ? 'bg-primary-600' : 'bg-gray-200'}`} />
              )}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${isCompleted ? 'bg-primary-600 text-white' : isCurrent ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-600' : 'bg-gray-100 text-gray-400'}`}>
                  {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
                </div>
                <span className={`mt-1 text-xs hidden sm:block ${isCurrent ? 'text-primary-700 font-medium' : 'text-gray-400'}`}>
                  {step.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
