'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAppStore, type CartItemState } from '@/lib/store';
import { formatINR, cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Cart item row
// ---------------------------------------------------------------------------

interface CartItemRowProps {
  item: CartItemState;
}

const CartItemRow: React.FC<CartItemRowProps> = ({ item }) => {
  const updateQuantity = useAppStore((s) => s.updateQuantity);
  const removeFromCart = useAppStore((s) => s.removeFromCart);

  const lineTotal = item.unit_price * item.quantity;

  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
      {/* Product image placeholder */}
      <div className="h-16 w-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
        <span className="text-xs text-gray-400 font-mono">{item.sku_code.slice(0, 3)}</span>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
          {item.product_name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          {item.sku_code} &middot; {formatINR(item.unit_price)} each
        </p>

        {/* Quantity controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (item.quantity <= 1) {
                  removeFromCart(item.product_id);
                } else {
                  updateQuantity(item.product_id, item.quantity - 1);
                }
              }}
              className="h-7 w-7 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              -
            </button>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100 min-w-[1.5rem] text-center">
              {item.quantity}
            </span>
            <button
              onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-primary-600 text-white font-bold hover:bg-primary-700 transition-colors"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {formatINR(lineTotal)}
            </span>
            <button
              onClick={() => removeFromCart(item.product_id)}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main cart page
// ---------------------------------------------------------------------------

export default function CartPage() {
  const cartItems = useAppStore((s) => s.cartItems);
  const clearCart = useAppStore((s) => s.clearCart);
  const getCartTotal = useAppStore((s) => s.getCartTotal);
  const getCartItemCount = useAppStore((s) => s.getCartItemCount);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  const subtotal = getCartTotal();
  const taxRate = 0.18;
  const taxAmount = Math.round(subtotal * taxRate);
  const grandTotal = subtotal + taxAmount;
  const itemCount = getCartItemCount();

  const handlePlaceOrder = () => {
    setIsPlacingOrder(true);
    // Simulate order placement
    setTimeout(() => {
      setIsPlacingOrder(false);
      setOrderPlaced(true);
      clearCart();
    }, 1500);
  };

  // Order success state
  if (orderPlaced) {
    return (
      <div className="px-4 pt-16 pb-6 flex flex-col items-center text-center">
        <div className="h-20 w-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4 animate-bounce-in">
          <svg
            className="h-10 w-10 text-primary-600 dark:text-primary-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Order Placed!
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
          Your order has been placed successfully. You will receive a
          confirmation on WhatsApp shortly.
        </p>
        <div className="space-y-3 w-full max-w-xs">
          <Link href="/orders" className="btn-primary w-full block text-center">
            View Orders
          </Link>
          <button
            onClick={() => setOrderPlaced(false)}
            className="btn-outline w-full"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  // Empty cart
  if (cartItems.length === 0) {
    return (
      <div className="px-4 pt-16 pb-6 flex flex-col items-center text-center">
        <div className="h-20 w-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <svg
            className="h-10 w-10 text-gray-300 dark:text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
          Your cart is empty
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Browse the catalog or check the AI-recommended basket.
        </p>
        <div className="space-y-3 w-full max-w-xs">
          <Link href="/catalog" className="btn-primary w-full block text-center">
            Browse Catalog
          </Link>
          <Link href="/" className="btn-outline w-full block text-center">
            View Perfect Basket
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Shopping Cart
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {cartItems.length} product{cartItems.length !== 1 ? 's' : ''},{' '}
            {itemCount} unit{itemCount !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium"
        >
          Clear All
        </button>
      </div>

      {/* Cart items */}
      <div className="card p-3 mb-4">
        {cartItems.map((item) => (
          <CartItemRow key={item.product_id} item={item} />
        ))}
      </div>

      {/* Order summary */}
      <div className="card p-4 mb-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Order Summary
        </h3>

        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
          <span className="text-gray-900 dark:text-gray-100">
            {formatINR(subtotal)}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">GST (18%)</span>
          <span className="text-gray-900 dark:text-gray-100">
            +{formatINR(taxAmount)}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Delivery</span>
          <span className="text-primary-600 dark:text-primary-400 font-medium">
            Free
          </span>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between">
          <span className="text-base font-bold text-gray-900 dark:text-gray-100">
            Grand Total
          </span>
          <span className="text-base font-bold text-gray-900 dark:text-gray-100">
            {formatINR(grandTotal)}
          </span>
        </div>
      </div>

      {/* Delivery note */}
      <div className="card p-3 mb-4 flex items-start gap-2.5">
        <svg
          className="h-5 w-5 text-primary-600 dark:text-primary-400 mt-0.5 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
            Expected delivery: Within 24-48 hours
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Your assigned rep will confirm delivery time via WhatsApp.
          </p>
        </div>
      </div>

      {/* Place order button */}
      <button
        onClick={handlePlaceOrder}
        disabled={isPlacingOrder}
        className={cn(
          'btn-primary w-full text-base py-3',
          isPlacingOrder && 'animate-pulse'
        )}
      >
        {isPlacingOrder ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Placing Order...
          </span>
        ) : (
          `Place Order - ${formatINR(grandTotal)}`
        )}
      </button>
    </div>
  );
}
