import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { OrderItem, OrderItemData } from '../components/OrderItem';
import { useAuthStore } from '../store/auth-store';
import { apiGet, apiPost } from '../services/api';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NewOrderRouteProp = RouteProp<RootStackParamList, 'NewOrder'>;

interface Product {
  id: string;
  name: string;
  sku_code: string;
  category: string;
  mrp: number;
  selling_price: number;
  unit: string;
  in_stock: boolean;
  image_url: string | null;
}

interface SuggestedProduct extends Product {
  suggestion_reason: string;
}

interface LineItem {
  product: Product;
  quantity: number;
  discount_percent: number;
}

const formatINR = (amount: number): string => {
  return '\u20B9' + amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

export const NewOrderScreen: React.FC = () => {
  const route = useRoute<NewOrderRouteProp>();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isHindi = user?.preferred_language === 'hi';

  const { storeId, storeName } = route.params ?? {};

  const [searchQuery, setSearchQuery] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  // Fetch product catalog
  const { data: products } = useQuery<Product[]>({
    queryKey: ['catalog', user?.company_id, searchQuery],
    queryFn: () =>
      apiGet<Product[]>(
        `/catalog?company_id=${user?.company_id}&search=${searchQuery}&limit=20`
      ),
    enabled: !!user?.company_id && searchQuery.length >= 2,
  });

  // Fetch AI suggested products
  const { data: suggestions } = useQuery<SuggestedProduct[]>({
    queryKey: ['suggestions', storeId],
    queryFn: () =>
      apiGet<SuggestedProduct[]>(
        `/orders/${storeId}/perfect-basket`
      ),
    enabled: !!storeId,
  });

  // Submit order mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (lineItems.length === 0) {
        throw new Error('Please add at least one product');
      }
      if (!storeId) {
        throw new Error('Please select a store');
      }

      const items = lineItems.map((li) => ({
        product_id: li.product.id,
        quantity: li.quantity,
        unit_price: li.product.selling_price,
        discount_percent: li.discount_percent,
      }));

      return apiPost('/orders', {
        store_id: storeId,
        rep_id: user?.id,
        source: 'manual',
        items,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      Alert.alert(
        isHindi ? '\u0911\u0930\u094D\u0921\u0930 \u0938\u092B\u0932!' : 'Order Placed!',
        isHindi
          ? '\u0911\u0930\u094D\u0921\u0930 \u0938\u092B\u0932\u0924\u093E\u092A\u0942\u0930\u094D\u0935\u0915 \u0930\u0916\u093E \u0917\u092F\u093E'
          : 'Your order has been placed successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to place order';
      Alert.alert(isHindi ? '\u0924\u094D\u0930\u0941\u091F\u093F' : 'Error', message);
    },
  });

  const addProduct = useCallback((product: Product) => {
    setLineItems((prev) => {
      const existing = prev.find((li) => li.product.id === product.id);
      if (existing) {
        return prev.map((li) =>
          li.product.id === product.id
            ? { ...li, quantity: li.quantity + 1 }
            : li
        );
      }
      return [...prev, { product, quantity: 1, discount_percent: 0 }];
    });
    setSearchQuery('');
    setShowSearch(false);
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setLineItems((prev) =>
      prev
        .map((li) =>
          li.product.id === productId
            ? { ...li, quantity: Math.max(0, li.quantity + delta) }
            : li
        )
        .filter((li) => li.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setLineItems((prev) => prev.filter((li) => li.product.id !== productId));
  }, []);

  // Compute totals
  const { subtotal, totalItems } = useMemo(() => {
    let sub = 0;
    let items = 0;
    for (const li of lineItems) {
      const lineTotal = li.product.selling_price * li.quantity * (1 - li.discount_percent / 100);
      sub += lineTotal;
      items += li.quantity;
    }
    return { subtotal: sub, totalItems: items };
  }, [lineItems]);

  const orderItemsData: OrderItemData[] = useMemo(
    () =>
      lineItems.map((li) => ({
        id: li.product.id,
        product_id: li.product.id,
        product_name: li.product.name,
        sku_code: li.product.sku_code,
        quantity: li.quantity,
        unit_price: li.product.selling_price,
        discount_percent: li.discount_percent,
        line_total:
          li.product.selling_price * li.quantity * (1 - li.discount_percent / 100),
        unit: li.product.unit,
      })),
    [lineItems]
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Store Info */}
        <View style={styles.storeInfoBar}>
          <Text style={styles.storeInfoIcon}>{'\u{1F3EA}'}</Text>
          <View style={styles.storeInfoText}>
            <Text style={styles.storeInfoLabel}>
              {isHindi ? '\u0911\u0930\u094D\u0921\u0930 \u0915\u0947 \u0932\u093F\u090F' : 'Order for'}:
            </Text>
            <Text style={styles.storeInfoName}>{storeName ?? 'Select a store'}</Text>
          </View>
        </View>

        {/* Product Search */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isHindi ? '\u0909\u0924\u094D\u092A\u093E\u0926 \u091C\u094B\u0921\u093C\u0947\u0902' : 'Add Products'}
          </Text>
          <View style={styles.searchRow}>
            <View style={styles.searchInputContainer}>
              <Text style={styles.searchIcon}>{'\u{1F50D}'}</Text>
              <TextInput
                style={styles.searchInput}
                placeholder={
                  isHindi
                    ? '\u0909\u0924\u094D\u092A\u093E\u0926 \u0916\u094B\u091C\u0947\u0902...'
                    : 'Search products...'
                }
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  setShowSearch(text.length >= 2);
                }}
                onFocus={() => searchQuery.length >= 2 && setShowSearch(true)}
              />
            </View>
            <TouchableOpacity style={styles.barcodeButton}>
              <Text style={styles.barcodeIcon}>{'\u{1F4F7}'}</Text>
            </TouchableOpacity>
          </View>

          {/* Search Results Dropdown */}
          {showSearch && products && products.length > 0 && (
            <View style={styles.searchResults}>
              {products.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={styles.searchResultItem}
                  onPress={() => addProduct(product)}
                >
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName} numberOfLines={1}>
                      {product.name}
                    </Text>
                    <Text style={styles.searchResultSku}>
                      {product.sku_code} {'\u2022'} {product.category}
                    </Text>
                  </View>
                  <View style={styles.searchResultRight}>
                    <Text style={styles.searchResultPrice}>
                      {formatINR(product.selling_price)}/{product.unit}
                    </Text>
                    {!product.in_stock && (
                      <Text style={styles.outOfStock}>
                        {isHindi ? '\u0938\u094D\u091F\u0949\u0915 \u0928\u0939\u0940\u0902' : 'Out of stock'}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Line Items */}
        {lineItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {isHindi ? '\u0911\u0930\u094D\u0921\u0930 \u0906\u0907\u091F\u092E' : 'Order Items'} ({totalItems})
            </Text>
            <View style={styles.lineItemsCard}>
              {orderItemsData.map((item, index) => (
                <View key={item.id}>
                  <OrderItem item={item} index={index} />
                  <View style={styles.qtyControls}>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => updateQuantity(item.product_id, -1)}
                    >
                      <Text style={styles.qtyButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>
                      {lineItems.find((li) => li.product.id === item.product_id)?.quantity ?? 0}
                    </Text>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => updateQuantity(item.product_id, 1)}
                    >
                      <Text style={styles.qtyButtonText}>+</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeItem(item.product_id)}
                    >
                      <Text style={styles.removeButtonText}>{'\u2715'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* AI Suggestions */}
        {suggestions && suggestions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.suggestionHeader}>
              <Text style={styles.suggestionIcon}>{'\u{1F916}'}</Text>
              <Text style={styles.sectionTitle}>
                {isHindi
                  ? 'AI \u0938\u0941\u091D\u093E\u0935'
                  : 'AI Suggestions — You might also want to order...'}
              </Text>
            </View>
            {suggestions.slice(0, 5).map((suggestion) => {
              const alreadyAdded = lineItems.some(
                (li) => li.product.id === suggestion.id
              );
              return (
                <TouchableOpacity
                  key={suggestion.id}
                  style={[
                    styles.suggestionItem,
                    alreadyAdded && styles.suggestionItemAdded,
                  ]}
                  onPress={() => !alreadyAdded && addProduct(suggestion)}
                  disabled={alreadyAdded}
                >
                  <View style={styles.suggestionInfo}>
                    <Text style={styles.suggestionName} numberOfLines={1}>
                      {suggestion.name}
                    </Text>
                    <Text style={styles.suggestionReason} numberOfLines={1}>
                      {suggestion.suggestion_reason}
                    </Text>
                  </View>
                  <View style={styles.suggestionRight}>
                    <Text style={styles.suggestionPrice}>
                      {formatINR(suggestion.selling_price)}
                    </Text>
                    {alreadyAdded ? (
                      <Text style={styles.addedText}>{'\u2713'} Added</Text>
                    ) : (
                      <Text style={styles.addText}>+ Add</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Bottom Order Summary + Submit */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomSummary}>
          <Text style={styles.bottomLabel}>
            {totalItems} {isHindi ? '\u0906\u0907\u091F\u092E' : 'items'}
          </Text>
          <Text style={styles.bottomTotal}>{formatINR(subtotal)}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (lineItems.length === 0 || submitMutation.isPending) && styles.buttonDisabled,
          ]}
          onPress={() => submitMutation.mutate()}
          disabled={lineItems.length === 0 || submitMutation.isPending}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>
              {isHindi ? '\u0911\u0930\u094D\u0921\u0930 \u0915\u0930\u0947\u0902' : 'Place Order'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  storeInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  storeInfoIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  storeInfoText: {
    flex: 1,
  },
  storeInfoLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  storeInfoName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
  },
  barcodeButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
  },
  barcodeIcon: {
    fontSize: 18,
  },
  searchResults: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginTop: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchResultInfo: {
    flex: 1,
    marginRight: 8,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  searchResultSku: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  searchResultRight: {
    alignItems: 'flex-end',
  },
  searchResultPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  outOfStock: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '600',
    marginTop: 2,
  },
  lineItemsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
    gap: 8,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  qtyButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E40AF',
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    minWidth: 24,
    textAlign: 'center',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  removeButtonText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '700',
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  suggestionIcon: {
    fontSize: 16,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  suggestionItemAdded: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    opacity: 0.7,
  },
  suggestionInfo: {
    flex: 1,
    marginRight: 8,
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  suggestionReason: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 2,
    fontStyle: 'italic',
  },
  suggestionRight: {
    alignItems: 'flex-end',
  },
  suggestionPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  addText: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '700',
    marginTop: 2,
  },
  addedText: {
    fontSize: 11,
    color: '#22C55E',
    fontWeight: '600',
    marginTop: 2,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bottomSummary: {
    flex: 1,
  },
  bottomLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  bottomTotal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
  },
  submitButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
