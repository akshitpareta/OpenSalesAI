'use client';

import React from 'react';
import type { Product } from '@opensalesai/shared';
import { Badge } from '@opensalesai/ui';
import { cn, formatINR } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

interface ProductCardProps {
  product: Product;
  className?: string;
  /** When provided, shows a recommended quantity hint */
  recommendedQty?: number;
  /** When provided, shows a reason tooltip/text */
  reason?: string;
}

// Placeholder product image based on category
const categoryColors: Record<string, string> = {
  BEVERAGES: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  SNACKS: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  DAIRY: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
  PERSONAL_CARE: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  HOME_CARE: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  PACKAGED_FOOD: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  CONFECTIONERY: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  FROZEN: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  HEALTH: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  OTHER: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
};

const categoryEmoji: Record<string, string> = {
  BEVERAGES: 'B',
  SNACKS: 'S',
  DAIRY: 'D',
  PERSONAL_CARE: 'P',
  HOME_CARE: 'H',
  PACKAGED_FOOD: 'F',
  CONFECTIONERY: 'C',
  FROZEN: 'FR',
  HEALTH: 'HL',
  OTHER: 'O',
};

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  className,
  recommendedQty,
  reason,
}) => {
  const addToCart = useAppStore((s) => s.addToCart);
  const cartItems = useAppStore((s) => s.cartItems);
  const updateQuantity = useAppStore((s) => s.updateQuantity);
  const removeFromCart = useAppStore((s) => s.removeFromCart);

  const cartItem = cartItems.find((i) => i.product_id === product.id);
  const inCart = !!cartItem;
  const currentQty = cartItem?.quantity ?? 0;

  const colorClass = categoryColors[product.category] || categoryColors.OTHER;
  const letter = categoryEmoji[product.category] || 'O';

  const marginPercent = product.retailer_margin;
  const isLowStock = product.current_stock <= product.reorder_level;

  return (
    <div
      className={cn(
        'card overflow-hidden flex flex-col',
        className
      )}
    >
      {/* Product image placeholder */}
      <div
        className={cn(
          'h-28 flex items-center justify-center relative',
          colorClass
        )}
      >
        <span className="text-3xl font-black opacity-30">{letter}</span>

        {/* Badges overlaid */}
        <div className="absolute top-2 left-2 flex gap-1">
          {product.is_msl && (
            <Badge variant="info" size="sm">MSL</Badge>
          )}
          {isLowStock && (
            <Badge variant="danger" size="sm">Low Stock</Badge>
          )}
        </div>

        {recommendedQty && (
          <div className="absolute top-2 right-2">
            <Badge variant="purple" size="sm">AI Pick</Badge>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mb-0.5">
          {product.sku_code}
        </p>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight mb-1">
          {product.name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {product.brand} &middot; {product.unit.toLowerCase()}
        </p>

        {/* Price row */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-base font-bold text-gray-900 dark:text-gray-100">
            {formatINR(product.selling_price)}
          </span>
          {product.mrp > product.selling_price && (
            <span className="text-xs text-gray-400 line-through">
              {formatINR(product.mrp)}
            </span>
          )}
        </div>

        <p className="text-xs text-primary-600 dark:text-primary-400 font-medium mb-3">
          {marginPercent.toFixed(1)}% margin
        </p>

        {reason && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed italic">
            {reason}
          </p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Add to cart / quantity controls */}
        {!inCart ? (
          <button
            onClick={() => addToCart(product, recommendedQty ?? product.min_order_qty)}
            className="btn-primary w-full text-xs py-2"
          >
            {recommendedQty
              ? `Add ${recommendedQty} to Cart`
              : 'Add to Cart'}
          </button>
        ) : (
          <div className="flex items-center justify-between bg-primary-50 dark:bg-primary-900/20 rounded-xl px-1 py-1">
            <button
              onClick={() => {
                if (currentQty <= product.min_order_qty) {
                  removeFromCart(product.id);
                } else {
                  updateQuantity(product.id, currentQty - 1);
                }
              }}
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 shadow-sm text-gray-700 dark:text-gray-300 font-bold text-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              -
            </button>
            <span className="text-sm font-bold text-primary-700 dark:text-primary-400 min-w-[2rem] text-center">
              {currentQty}
            </span>
            <button
              onClick={() => {
                if (currentQty < product.max_order_qty) {
                  updateQuantity(product.id, currentQty + 1);
                }
              }}
              disabled={currentQty >= product.max_order_qty}
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary-600 text-white font-bold text-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
