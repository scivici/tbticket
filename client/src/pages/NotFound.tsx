import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="max-w-lg mx-auto text-center py-20">
      <div className="tb-card p-10">
        <AlertCircle className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">404 - Page Not Found</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          The page you're looking for doesn't exist.
        </p>
        <Link to="/" className="tb-btn-primary px-8 py-2.5 inline-block">
          Go Home
        </Link>
      </div>
    </div>
  );
}
