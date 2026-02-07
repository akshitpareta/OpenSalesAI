import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface OrderItemData {
  id: string;
  product_id: string;
  product_name: string;
  sku_code: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  line_total: number;
  unit: string; // e.g., "case", "piece", "pack"
}

interface OrderItemProps {
  item: OrderItemData;
  index: number;
}

/**
 * Format number as INR currency.
 */
const formatINR = (amount: number): string => {
  return '\u20B9' + amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

/**
 * OrderItem — Displays a single line item in an order with product name,
 * SKU, quantity, unit price, discount, and line total in INR.
 */
export const OrderItem: React.FC<OrderItemProps> = ({ item, index }) => {
  const hasDiscount = item.discount_percent > 0;

  return (
    <View style={[styles.container, index > 0 && styles.borderTop]}>
      <View style={styles.leftSection}>
        <View style={styles.indexBadge}>
          <Text style={styles.indexText}>{index + 1}</Text>
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>
            {item.product_name}
          </Text>
          <Text style={styles.skuCode}>SKU: {item.sku_code}</Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        <View style={styles.qtyRow}>
          <Text style={styles.quantity}>
            {item.quantity} {item.unit}
          </Text>
          <Text style={styles.unitPrice}>@ {formatINR(item.unit_price)}</Text>
        </View>
        {hasDiscount && (
          <Text style={styles.discountText}>
            -{item.discount_percent}% discount
          </Text>
        )}
        <Text style={styles.lineTotal}>{formatINR(item.line_total)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 12,
  },
  indexBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  indexText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  skuCode: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quantity: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  unitPrice: {
    fontSize: 11,
    color: '#94A3B8',
  },
  discountText: {
    fontSize: 11,
    color: '#22C55E',
    fontWeight: '500',
    marginTop: 1,
  },
  lineTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E40AF',
    marginTop: 2,
  },
});
