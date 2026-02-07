import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth-store';
import { apiGet } from '../services/api';

interface Order {
  id: string;
  store_id: string;
  store_name: string;
  total_amount: number;
  items_count: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  source: 'manual' | 'whatsapp' | 'pwa' | 'voice';
  created_at: string;
  payment_status: 'unpaid' | 'partial' | 'paid';
}

const formatINR = (amount: number): string => {
  return '\u20B9' + amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const statusColors: Record<Order['status'], { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E' },
  confirmed: { bg: '#DBEAFE', text: '#1E40AF' },
  processing: { bg: '#EDE9FE', text: '#6D28D9' },
  shipped: { bg: '#E0F2FE', text: '#0369A1' },
  delivered: { bg: '#DCFCE7', text: '#166534' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B' },
};

const sourceIcons: Record<Order['source'], string> = {
  manual: '\u{270D}',
  whatsapp: '\u{1F4AC}',
  pwa: '\u{1F4F1}',
  voice: '\u{1F3A4}',
};

const sourceLabels: Record<Order['source'], string> = {
  manual: 'Manual',
  whatsapp: 'WhatsApp',
  pwa: 'PWA',
  voice: 'Voice',
};

const paymentColors: Record<Order['payment_status'], { bg: string; text: string }> = {
  unpaid: { bg: '#FEE2E2', text: '#991B1B' },
  partial: { bg: '#FEF3C7', text: '#92400E' },
  paid: { bg: '#DCFCE7', text: '#166534' },
};

export const OrdersScreen: React.FC = () => {
  const { user } = useAuthStore();
  const isHindi = user?.preferred_language === 'hi';
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: orders,
    isLoading,
    refetch,
  } = useQuery<Order[]>({
    queryKey: ['orders', user?.id],
    queryFn: () => apiGet<Order[]>(`/orders?rep_id=${user?.id}&limit=50`),
    enabled: !!user?.id,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderOrder = useCallback(
    ({ item }: { item: Order }) => {
      const colors = statusColors[item.status];
      const paymentColor = paymentColors[item.payment_status];
      const dateStr = new Date(item.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const timeStr = new Date(item.created_at).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });

      return (
        <TouchableOpacity style={styles.orderCard} activeOpacity={0.7}>
          {/* Order Header */}
          <View style={styles.orderHeader}>
            <View style={styles.orderHeaderLeft}>
              <Text style={styles.orderStoreName} numberOfLines={1}>
                {item.store_name}
              </Text>
              <Text style={styles.orderDate}>
                {dateStr} {'\u2022'} {timeStr}
              </Text>
            </View>
            <Text style={styles.orderTotal}>{formatINR(item.total_amount)}</Text>
          </View>

          {/* Order Meta */}
          <View style={styles.orderMeta}>
            <View style={styles.orderMetaLeft}>
              <View style={styles.sourceBadge}>
                <Text style={styles.sourceIcon}>{sourceIcons[item.source]}</Text>
                <Text style={styles.sourceText}>{sourceLabels[item.source]}</Text>
              </View>
              <Text style={styles.itemsCount}>
                {item.items_count} {isHindi ? '\u0906\u0907\u091F\u092E' : 'items'}
              </Text>
            </View>
            <View style={styles.orderMetaRight}>
              <View
                style={[styles.paymentBadge, { backgroundColor: paymentColor.bg }]}
              >
                <Text style={[styles.paymentText, { color: paymentColor.text }]}>
                  {item.payment_status}
                </Text>
              </View>
              <View
                style={[styles.statusBadge, { backgroundColor: colors.bg }]}
              >
                <Text style={[styles.statusText, { color: colors.text }]}>
                  {item.status}
                </Text>
              </View>
            </View>
          </View>

          {/* Order ID */}
          <Text style={styles.orderId}>#{item.id.slice(-8).toUpperCase()}</Text>
        </TouchableOpacity>
      );
    },
    [isHindi]
  );

  const keyExtractor = useCallback((item: Order) => item.id, []);

  // Summary
  const todayTotal = React.useMemo(() => {
    if (!orders) return 0;
    const today = new Date().toDateString();
    return orders
      .filter((o) => new Date(o.created_at).toDateString() === today)
      .reduce((sum, o) => sum + o.total_amount, 0);
  }, [orders]);

  const todayCount = React.useMemo(() => {
    if (!orders) return 0;
    const today = new Date().toDateString();
    return orders.filter((o) => new Date(o.created_at).toDateString() === today).length;
  }, [orders]);

  return (
    <View style={styles.container}>
      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{todayCount}</Text>
          <Text style={styles.summaryLabel}>
            {isHindi ? '\u0906\u091C \u0915\u0947 \u0911\u0930\u094D\u0921\u0930' : "Today's Orders"}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{formatINR(todayTotal)}</Text>
          <Text style={styles.summaryLabel}>
            {isHindi ? '\u0906\u091C \u0915\u0940 \u0915\u0941\u0932 \u0930\u093E\u0936\u093F' : "Today's Revenue"}
          </Text>
        </View>
      </View>

      {/* Order List */}
      {isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#1E40AF" />
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1E40AF"
              colors={['#1E40AF']}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerContent}>
              <Text style={styles.emptyIcon}>{'\u{1F4E6}'}</Text>
              <Text style={styles.emptyText}>
                {isHindi
                  ? '\u0905\u092D\u0940 \u0924\u0915 \u0915\u094B\u0908 \u0911\u0930\u094D\u0921\u0930 \u0928\u0939\u0940\u0902'
                  : 'No orders yet'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
  },
  listContent: {
    paddingVertical: 8,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 5,
    borderRadius: 12,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  orderHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  orderStoreName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  orderDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  orderTotal: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E40AF',
  },
  orderMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  sourceIcon: {
    fontSize: 11,
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  itemsCount: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  orderMetaRight: {
    flexDirection: 'row',
    gap: 6,
  },
  paymentBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  paymentText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  orderId: {
    fontSize: 10,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
