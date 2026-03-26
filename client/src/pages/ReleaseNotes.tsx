import React, { useEffect, useState } from 'react';
import { products as productsApi } from '../api/client';
import { FileText, Package } from 'lucide-react';

export default function ReleaseNotes() {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState('');

  useEffect(() => {
    productsApi.releaseNotes()
      .then(setNotes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const productNames = [...new Set(notes.map(n => n.product_name))];
  const filtered = selectedProduct ? notes.filter(n => n.product_name === selectedProduct) : notes;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-6 h-6 text-accent-blue" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Release Notes</h1>
      </div>

      {productNames.length > 1 && (
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setSelectedProduct('')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!selectedProduct ? 'bg-accent-blue text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
              All Products
            </button>
            {productNames.map(name => (
              <button key={name} onClick={() => setSelectedProduct(name)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedProduct === name ? 'bg-accent-blue text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="tb-card p-8 text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No release notes available yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((note: any) => (
            <div key={note.id} className="tb-card p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-accent-blue/10 text-accent-blue rounded text-xs font-medium">{note.product_name}</span>
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-mono font-medium">v{note.version}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{note.title}</h2>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">{new Date(note.created_at).toLocaleDateString()}</span>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{note.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
