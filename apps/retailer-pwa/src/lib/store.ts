import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product, OrderStatus } from '@opensalesai/shared';

// ---------------------------------------------------------------------------
// Cart item type
// ---------------------------------------------------------------------------

export interface CartItemState {
  product_id: string;
  product_name: string;
  sku_code: string;
  unit_price: number;
  quantity: number;
  image_url: string | null;
}

// ---------------------------------------------------------------------------
// Order history item (simplified for display)
// ---------------------------------------------------------------------------

export interface OrderHistoryItem {
  id: string;
  order_number: string;
  status: OrderStatus;
  item_count: number;
  grand_total: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface AppState {
  // Auth
  storeId: string | null;
  storeName: string | null;
  phone: string | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (storeId: string, storeName: string, phone: string, token: string) => void;
  logout: () => void;

  // Cart
  cartItems: CartItemState[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartItemCount: () => number;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Category filter
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ----- Auth -----
      storeId: null,
      storeName: null,
      phone: null,
      token: null,
      isAuthenticated: false,
      setAuth: (storeId, storeName, phone, token) =>
        set({
          storeId,
          storeName,
          phone,
          token,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          storeId: null,
          storeName: null,
          phone: null,
          token: null,
          isAuthenticated: false,
          cartItems: [],
        }),

      // ----- Cart -----
      cartItems: [],

      addToCart: (product, quantity = 1) => {
        const items = get().cartItems;
        const existing = items.find((i) => i.product_id === product.id);

        if (existing) {
          set({
            cartItems: items.map((i) =>
              i.product_id === product.id
                ? {
                    ...i,
                    quantity: Math.min(
                      i.quantity + quantity,
                      product.max_order_qty
                    ),
                  }
                : i
            ),
          });
        } else {
          set({
            cartItems: [
              ...items,
              {
                product_id: product.id,
                product_name: product.name,
                sku_code: product.sku_code,
                unit_price: product.selling_price,
                quantity: Math.max(product.min_order_qty, quantity),
                image_url: product.image_url,
              },
            ],
          });
        }
      },

      removeFromCart: (productId) =>
        set({
          cartItems: get().cartItems.filter(
            (i) => i.product_id !== productId
          ),
        }),

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(productId);
          return;
        }
        set({
          cartItems: get().cartItems.map((i) =>
            i.product_id === productId ? { ...i, quantity } : i
          ),
        });
      },

      clearCart: () => set({ cartItems: [] }),

      getCartTotal: () =>
        get().cartItems.reduce(
          (sum, item) => sum + item.unit_price * item.quantity,
          0
        ),

      getCartItemCount: () =>
        get().cartItems.reduce((sum, item) => sum + item.quantity, 0),

      // ----- Search -----
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),

      // ----- Category -----
      selectedCategory: '',
      setSelectedCategory: (category) =>
        set({ selectedCategory: category }),
    }),
    {
      name: 'opensales-retailer-store',
      partialize: (state) => ({
        storeId: state.storeId,
        storeName: state.storeName,
        phone: state.phone,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        cartItems: state.cartItems,
      }),
    }
  )
);
