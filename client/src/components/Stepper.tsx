import React from 'react';
import { Check } from 'lucide-react';

interface Step {
  label: string;
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
                <div className={`w-8 sm:w-16 h-0.5 mx-1 sm:mx-2 ${isCompleted ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              )}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                  ${isCompleted ? 'bg-primary-500 text-white' : isCurrent ? 'bg-primary-500/20 text-accent-blue ring-2 ring-primary-500' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                  {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
                </div>
                <span className={`mt-1 text-xs hidden sm:block ${isCurrent ? 'text-accent-blue font-medium' : 'text-gray-500'}`}>
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
