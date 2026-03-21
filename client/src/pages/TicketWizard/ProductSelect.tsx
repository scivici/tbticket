import React, { useEffect, useState } from 'react';
import { products as productsApi } from '../../api/client';
import { WizardData } from './WizardContainer';

const productEmojis: Record<number, string> = { 1: '📡', 2: '📡', 3: '🔌', 4: '🔌', 5: '🔌', 6: '🔗', 7: '🔗' };

interface Props {
  data: WizardData;
  onUpdate: (partial: Partial<WizardData>) => void;
  onNext: () => void;
}

export default function ProductSelect({ data, onUpdate, onNext }: Props) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productsApi.list().then(setProducts).catch(console.error).finally(() => setLoading(false));
  }, []);

  const selectProduct = (product: any) => {
    onUpdate({ product, category: null, answers: {}, questions: [] });
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading products...</div>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Which product do you need help with?</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {products.map(product => (
          <button key={product.id} onClick={() => selectProduct(product)}
            className={`p-6 rounded-xl border-2 text-left transition-all hover:shadow-lg ${
              data.product?.id === product.id
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-gray-600 hover:border-primary-400 bg-tb-bg'
            }`}>
            <div className="text-3xl mb-3">{productEmojis[product.id] || '📦'}</div>
            <h3 className="font-semibold text-lg text-white">{product.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{product.model}</p>
            <p className="text-sm text-gray-400 mt-2">{product.description}</p>
          </button>
        ))}
      </div>
      <div className="flex justify-end mt-6">
        <button onClick={onNext} disabled={!data.product} className="tb-btn-primary px-6 disabled:cursor-not-allowed">Next</button>
      </div>
    </div>
  );
}
