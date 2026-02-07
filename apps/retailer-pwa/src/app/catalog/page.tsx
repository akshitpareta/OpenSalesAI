'use client';

import React, { useMemo, useState } from 'react';
import { ProductCategory } from '@opensalesai/shared';
import { ProductCard } from '@/components/ProductCard';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { mockProducts } from '@/lib/mock-data';

// ---------------------------------------------------------------------------
// Category tab config
// ---------------------------------------------------------------------------

const categoryLabels: Record<string, string> = {
  '': 'All',
  [ProductCategory.BEVERAGES]: 'Beverages',
  [ProductCategory.SNACKS]: 'Snacks',
  [ProductCategory.DAIRY]: 'Dairy',
  [ProductCategory.PERSONAL_CARE]: 'Personal Care',
  [ProductCategory.HOME_CARE]: 'Home Care',
  [ProductCategory.PACKAGED_FOOD]: 'Packed Food',
  [ProductCategory.CONFECTIONERY]: 'Sweets',
};

const categoryKeys = Object.keys(categoryLabels);

// ---------------------------------------------------------------------------
// Sort options
// ---------------------------------------------------------------------------

type SortOption = 'name' | 'price_low' | 'price_high' | 'margin';

const sortLabels: Record<SortOption, string> = {
  name: 'Name A-Z',
  price_low: 'Price: Low-High',
  price_high: 'Price: High-Low',
  margin: 'Highest Margin',
};

export default function CatalogPage() {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const selectedCategory = useAppStore((s) => s.selectedCategory);
  const setSelectedCategory = useAppStore((s) => s.setSelectedCategory);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [showSort, setShowSort] = useState(false);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let products = mockProducts.filter((p) => p.is_active);

    // Category filter
    if (selectedCategory) {
      products = products.filter((p) => p.category === selectedCategory);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.sku_code.toLowerCase().includes(q) ||
          (p.sub_category && p.sub_category.toLowerCase().includes(q))
      );
    }

    // Sort
    const sorted = [...products];
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'price_low':
        sorted.sort((a, b) => a.selling_price - b.selling_price);
        break;
      case 'price_high':
        sorted.sort((a, b) => b.selling_price - a.selling_price);
        break;
      case 'margin':
        sorted.sort((a, b) => b.retailer_margin - a.retailer_margin);
        break;
    }

    return sorted;
  }, [searchQuery, selectedCategory, sortBy]);

  return (
    <div className="pb-6">
      {/* Sticky search bar */}
      <div className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-900 px-4 pt-4 pb-3 space-y-3">
        {/* Search input */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products, brands, SKUs..."
            className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Category tabs (horizontal scroll) */}
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1 -mx-4 px-4">
          {categoryKeys.map((key) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                selectedCategory === key
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              {categoryLabels[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Results header */}
      <div className="px-4 flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {filteredProducts.length} product
          {filteredProducts.length !== 1 ? 's' : ''} found
        </p>
        <div className="relative">
          <button
            onClick={() => setShowSort(!showSort)}
            className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            {sortLabels[sortBy]}
          </button>
          {showSort && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowSort(false)}
              />
              <div className="absolute right-0 top-6 z-50 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1">
                {(Object.keys(sortLabels) as SortOption[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSortBy(key);
                      setShowSort(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                      sortBy === key
                        ? 'text-primary-600 dark:text-primary-400 font-semibold'
                        : 'text-gray-700 dark:text-gray-300'
                    )}
                  >
                    {sortLabels[key]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Product grid */}
      {filteredProducts.length === 0 ? (
        <div className="px-4 text-center py-16">
          <svg
            className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No products match your search
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('');
            }}
            className="mt-2 text-sm text-primary-600 dark:text-primary-400 font-medium hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="px-4 grid grid-cols-2 gap-3">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
