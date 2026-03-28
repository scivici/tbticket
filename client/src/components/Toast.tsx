import React from 'react';
import { useToast } from '../context/ToastContext';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const config = {
  success: { icon: CheckCircle, bg: 'bg-green-600', border: 'border-green-500' },
  error:   { icon: XCircle,     bg: 'bg-red-600',   border: 'border-red-500' },
  info:    { icon: Info,         bg: 'bg-blue-600',  border: 'border-blue-500' },
  warning: { icon: AlertTriangle, bg: 'bg-yellow-600', border: 'border-yellow-500' },
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => {
        const { icon: Icon, bg, border } = config[toast.type];
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${border} ${bg} text-white text-sm min-w-[280px] max-w-[420px] animate-slide-in-right`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-0.5 hover:bg-white/20 rounded transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
