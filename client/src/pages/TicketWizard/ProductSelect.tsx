import React, { useEffect, useState } from 'react';
import { products as productsApi } from '../../api/client';
import { WizardData } from './WizardContainer';

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
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Which product do you need help with?</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {products.map(product => (
          <button key={product.id} onClick={() => selectProduct(product)}
            className={`p-5 rounded-xl border-2 text-left transition-all hover:shadow-lg ${
              data.product?.id === product.id
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 bg-[#f2f2f2] dark:bg-tb-bg'
            }`}>
            {product.image_url && (
              <div className="h-16 mb-3 flex items-center">
                <img src={product.image_url} alt={product.name} className="max-h-16 max-w-full object-contain" />
              </div>
            )}
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{product.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{product.model}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">{product.description}</p>
          </button>
        ))}
      </div>
      <div className="flex justify-end mt-6">
        <button onClick={onNext} disabled={!data.product} className="tb-btn-primary px-6 disabled:cursor-not-allowed">Next</button>
      </div>
    </div>
  );
}
