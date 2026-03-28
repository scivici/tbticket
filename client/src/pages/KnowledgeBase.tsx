import React, { useEffect, useState } from 'react';
import { kb as kbApi } from '../api/client';
import { BookOpen, Search, ChevronDown, ChevronUp, Package } from 'lucide-react';

export default function KnowledgeBase() {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState('');

  const loadArticles = (q?: string) => {
    setLoading(true);
    const promise = q ? kbApi.search(q) : kbApi.list();
    promise
      .then(setArticles)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadArticles();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadArticles(searchQuery.trim() || undefined);
  };

  const productNames = [...new Set(articles.map(a => a.product_name).filter(Boolean))];
  const filtered = selectedProduct
    ? articles.filter(a => a.product_name === selectedProduct)
    : articles;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="w-6 h-6 text-accent-blue" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Knowledge Base</h1>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search knowledge base articles..."
            className="tb-input w-full pl-10 pr-24"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-accent-blue text-white rounded-md text-sm font-medium hover:bg-accent-blue/80 transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Product Filter */}
      {productNames.length > 1 && (
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedProduct('')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !selectedProduct
                  ? 'bg-accent-blue text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              All Products
            </button>
            {productNames.map(name => (
              <button
                key={name}
                onClick={() => setSelectedProduct(name)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedProduct === name
                    ? 'bg-accent-blue text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Articles List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="tb-card p-8 text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            {searchQuery ? 'No articles found matching your search.' : 'No knowledge base articles available yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((article: any) => (
            <div key={article.id} className="tb-card overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === article.id ? null : article.id)}
                className="w-full p-5 text-left flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {article.product_name && (
                      <span className="px-2 py-0.5 bg-accent-blue/10 text-accent-blue rounded text-xs font-medium">
                        {article.product_name}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {new Date(article.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                    {article.title}
                  </h2>
                  {expandedId !== article.id && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {article.content?.substring(0, 200)}...
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 text-gray-400">
                  {expandedId === article.id ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </button>
              {expandedId === article.id && (
                <div className="px-5 pb-5 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                    {article.content}
                  </div>
                  {article.tags && Array.isArray(article.tags) && article.tags.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                      {article.tags.map((tag: string) => (
                        <span key={tag} className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
