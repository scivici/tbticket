import React, { useEffect, useState } from 'react';
import { products as productsApi } from '../../api/client';
import { WizardData } from './WizardContainer';
import { Wifi, Mic, Cpu, Link, Download, Activity, Server, Network, Bell, TrendingUp } from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  wifi: <Wifi className="w-5 h-5" />,
  microphone: <Mic className="w-5 h-5" />,
  cpu: <Cpu className="w-5 h-5" />,
  link: <Link className="w-5 h-5" />,
  download: <Download className="w-5 h-5" />,
  activity: <Activity className="w-5 h-5" />,
  server: <Server className="w-5 h-5" />,
  network: <Network className="w-5 h-5" />,
  bell: <Bell className="w-5 h-5" />,
  'trending-up': <TrendingUp className="w-5 h-5" />,
};

interface Props {
  data: WizardData;
  onUpdate: (partial: Partial<WizardData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function CategorySelect({ data, onUpdate, onNext, onPrev }: Props) {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (data.product) {
      productsApi.categories(data.product.id)
        .then(setCategories)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [data.product]);

  const selectCategory = (category: any) => {
    onUpdate({ category, answers: {}, questions: [] });
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading categories...</div>;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">What type of issue are you experiencing?</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => selectCategory(cat)}
            className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md flex items-start gap-3 ${
              data.category?.id === cat.id
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-primary-300'
            }`}
          >
            <div className={`p-2 rounded-lg ${data.category?.id === cat.id ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'}`}>
              {iconMap[cat.icon] || <Cpu className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-medium">{cat.name}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{cat.description}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-between mt-6">
        <button onClick={onPrev} className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
          Back
        </button>
        <button onClick={onNext} disabled={!data.category}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">
          Next
        </button>
      </div>
    </div>
  );
}
