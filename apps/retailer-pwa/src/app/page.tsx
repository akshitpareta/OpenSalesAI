'use client';

import React, { useState } from 'react';
import { Badge } from '@opensalesai/ui';
import { ProductCard } from '@/components/ProductCard';
import { useAppStore } from '@/lib/store';
import { formatINR, cn } from '@/lib/utils';
import { mockPerfectBasket } from '@/lib/mock-data';

export default function PerfectBasketPage() {
  const cartItems = useAppStore((s) => s.cartItems);
  const addToCart = useAppStore((s) => s.addToCart);
  const getCartTotal = useAppStore((s) => s.getCartTotal);
  const [addingAll, setAddingAll] = useState(false);

  // Calculate total of the perfect basket recommendation
  const basketTotal = mockPerfectBasket.reduce(
    (sum, item) => sum + item.product.selling_price * item.recommended_qty,
    0
  );
  const estimatedMargin = mockPerfectBasket.reduce(
    (sum, item) => sum + item.estimated_margin,
    0
  );

  // Count how many basket items are already in cart
  const inCartCount = mockPerfectBasket.filter((item) =>
    cartItems.some((ci) => ci.product_id === item.product.id)
  ).length;

  const handleAddAll = () => {
    setAddingAll(true);
    mockPerfectBasket.forEach((item) => {
      const alreadyInCart = cartItems.some(
        (ci) => ci.product_id === item.product.id
      );
      if (!alreadyInCart) {
        addToCart(item.product, item.recommended_qty);
      }
    });
    setTimeout(() => setAddingAll(false), 600);
  };

  return (
    <div className="px-4 pt-4 pb-6 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Perfect Basket
          </h1>
          <Badge variant="purple" size="sm">AI</Badge>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          AI-recommended products based on your sales patterns and local demand
        </p>
      </div>

      {/* Basket summary card */}
      <div className="card p-4 bg-gradient-to-r from-primary-50 to-emerald-50 dark:from-primary-900/20 dark:to-emerald-900/20 border-primary-200 dark:border-primary-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium tracking-wider">
              Recommended Order
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
              {formatINR(basketTotal)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Est. Margin
            </p>
            <p className="text-lg font-bold text-primary-600 dark:text-primary-400">
              {formatINR(estimatedMargin)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4 text-xs text-gray-600 dark:text-gray-400">
          <span>{mockPerfectBasket.length} products</span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span>
            {inCartCount}/{mockPerfectBasket.length} in cart
          </span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span>
            Avg confidence: {Math.round(
              mockPerfectBasket.reduce((s, i) => s + i.confidence * 100, 0) /
                mockPerfectBasket.length
            )}%
          </span>
        </div>

        <button
          onClick={handleAddAll}
          disabled={inCartCount === mockPerfectBasket.length || addingAll}
          className={cn(
            'btn-primary w-full',
            addingAll && 'animate-pulse'
          )}
        >
          {inCartCount === mockPerfectBasket.length
            ? 'All Items in Cart'
            : addingAll
              ? 'Adding...'
              : 'Add All to Cart'}
        </button>
      </div>

      {/* Cart peek (if items in cart) */}
      {cartItems.length > 0 && (
        <div className="card p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <svg
                className="h-4 w-4 text-primary-600 dark:text-primary-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {cartItems.length} items in cart
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatINR(getCartTotal())}
              </p>
            </div>
          </div>
          <a
            href="/cart"
            className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline"
          >
            View Cart
          </a>
        </div>
      )}

      {/* Product recommendations */}
      <div className="grid grid-cols-2 gap-3">
        {mockPerfectBasket.map((item) => (
          <ProductCard
            key={item.product.id}
            product={item.product}
            recommendedQty={item.recommended_qty}
            reason={item.reason}
          />
        ))}
      </div>
    </div>
  );
}
