import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TaskCard } from '../components/TaskCard';
import { useAuthStore } from '../store/auth-store';
import { apiGet, apiPost, apiPatch } from '../services/api';
import { validateProximity, formatDistance } from '../services/location';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { Task } from '../store/task-store';
import type { StackNavigationProp } from '@react-navigation/stack';

type StoreDetailRouteProp = RouteProp<RootStackParamList, 'StoreDetail'>;
type StoreDetailNavProp = StackNavigationProp<RootStackParamList, 'StoreDetail'>;

interface StoreDetail {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  channel: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  msl_compliance: number;
  credit_tier: 'A' | 'B' | 'C' | 'D';
  last_visit_date: string | null;
  total_orders: number;
  avg_order_value: number;
  outstanding_amount: number;
}

interface OrderSummary {
  id: string;
  date: string;
  total: number;
  items_count: number;
  status: string;
  source: string;
}

interface VisitCheckIn {
  visit_id: string;
  checked_in_at: string;
}

const formatINR = (amount: number): string => {
  return '\u20B9' + amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const channelLabels: Record<string, string> = {
  general_trade: 'General Trade',
  modern_trade: 'Modern Trade',
  wholesale: 'Wholesale',
  horeca: 'HoReCa',
  pharmacy: 'Pharmacy',
};

export const StoreDetailScreen: React.FC = () => {
  const route = useRoute<StoreDetailRouteProp>();
  const navigation = useNavigation<StoreDetailNavProp>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isHindi = user?.preferred_language === 'hi';
  const { storeId } = route.params;

  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [currentVisitId, setCurrentVisitId] = useState<string | null>(null);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);

  // Fetch store details
  const { data: store, isLoading: storeLoading } = useQuery<StoreDetail>({
    queryKey: ['store-detail', storeId],
    queryFn: () => apiGet<StoreDetail>(`/stores/${storeId}`),
    enabled: !!storeId,
  });

  // Fetch tasks for this store
  const { data: storeTasks } = useQuery<Task[]>({
    queryKey: ['store-tasks', storeId, user?.id],
    queryFn: () =>
      apiGet<Task[]>(`/tasks?store_id=${storeId}&rep_id=${user?.id}&status=pending`),
    enabled: !!storeId && !!user?.id,
  });

  // Fetch recent orders
  const { data: recentOrders } = useQuery<OrderSummary[]>({
    queryKey: ['store-orders', storeId],
    queryFn: () =>
      apiGet<OrderSummary[]>(`/orders?store_id=${storeId}&limit=5`),
    enabled: !!storeId,
  });

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!store) throw new Error('Store not loaded');

      // Validate GPS proximity
      const proximity = await validateProximity(store.latitude, store.longitude, 100);
      if (!proximity.isWithin) {
        throw new Error(
          `You are ${formatDistance(proximity.distance)} away from ${store.name}. ` +
            `You must be within 100m to check in. Current distance: ${formatDistance(proximity.distance)}.`
        );
      }

      const result = await apiPost<VisitCheckIn>('/visits', {
        store_id: storeId,
        rep_id: user?.id,
        check_in_lat: proximity.currentLocation.latitude,
        check_in_lng: proximity.currentLocation.longitude,
        check_in_accuracy: proximity.currentLocation.accuracy,
      });

      return result;
    },
    onSuccess: (data) => {
      setIsCheckedIn(true);
      setCurrentVisitId(data.visit_id);
      setCheckInTime(new Date());
      Alert.alert(
        isHindi ? '\u091A\u0947\u0915-\u0907\u0928 \u0938\u092B\u0932' : 'Checked In!',
        isHindi
          ? `${store?.name} \u092E\u0947\u0902 \u0938\u092B\u0932\u0924\u093E\u092A\u0942\u0930\u094D\u0935\u0915 \u091A\u0947\u0915-\u0907\u0928`
          : `Successfully checked in at ${store?.name}`
      );
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Check-in failed';
      Alert.alert(isHindi ? '\u0924\u094D\u0930\u0941\u091F\u093F' : 'Error', message);
    },
  });

  // Check-out mutation
  const checkOutMutation = useMutation({
    mutationFn: async () => {
      if (!currentVisitId) throw new Error('No active visit');

      // Enforce minimum 5-minute visit
      if (checkInTime) {
        const elapsed = (Date.now() - checkInTime.getTime()) / 1000 / 60;
        if (elapsed < 5) {
          throw new Error(
            `Minimum visit duration is 5 minutes. ` +
              `You've been here ${Math.floor(elapsed)} minutes. ` +
              `Please wait ${Math.ceil(5 - elapsed)} more minute(s).`
          );
        }
      }

      const proximity = await validateProximity(store!.latitude, store!.longitude, 200);

      return apiPost(`/visits/${currentVisitId}/checkout`, {
        check_out_lat: proximity.currentLocation.latitude,
        check_out_lng: proximity.currentLocation.longitude,
      });
    },
    onSuccess: () => {
      setIsCheckedIn(false);
      setCurrentVisitId(null);
      setCheckInTime(null);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['store-detail', storeId] });
      Alert.alert(
        isHindi ? '\u091A\u0947\u0915-\u0906\u0909\u091F' : 'Checked Out',
        isHindi
          ? '\u0935\u093F\u091C\u093C\u093F\u091F \u0930\u093F\u0915\u0949\u0930\u094D\u0921 \u0938\u0947\u0935 \u0915\u093F\u092F\u093E \u0917\u092F\u093E'
          : 'Visit recorded successfully'
      );
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Check-out failed';
      Alert.alert(isHindi ? '\u0924\u094D\u0930\u0941\u091F\u093F' : 'Error', message);
    },
  });

  const handleCompleteTask = useCallback(
    (taskId: string) => {
      apiPatch(`/tasks/${taskId}`, { status: 'completed' }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['store-tasks'] });
        queryClient.invalidateQueries({ queryKey: ['tasks-today'] });
      });
    },
    [queryClient]
  );

  const handleSkipTask = useCallback(
    (taskId: string) => {
      apiPatch(`/tasks/${taskId}`, { status: 'skipped' }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['store-tasks'] });
      });
    },
    [queryClient]
  );

  if (storeLoading || !store) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Store Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <View style={styles.infoLeft}>
            <Text style={styles.storeName}>{store.name}</Text>
            <Text style={styles.channelText}>
              {channelLabels[store.channel] ?? store.channel}
            </Text>
          </View>
          <View
            style={[
              styles.creditBadge,
              {
                backgroundColor:
                  store.credit_tier === 'A'
                    ? '#DCFCE7'
                    : store.credit_tier === 'B'
                      ? '#DBEAFE'
                      : store.credit_tier === 'C'
                        ? '#FEF3C7'
                        : '#FEE2E2',
              },
            ]}
          >
            <Text
              style={[
                styles.creditText,
                {
                  color:
                    store.credit_tier === 'A'
                      ? '#166534'
                      : store.credit_tier === 'B'
                        ? '#1E40AF'
                        : store.credit_tier === 'C'
                          ? '#92400E'
                          : '#991B1B',
                },
              ]}
            >
              Credit: {store.credit_tier}
            </Text>
          </View>
        </View>

        <View style={styles.ownerRow}>
          <Text style={styles.ownerLabel}>
            {isHindi ? '\u092E\u093E\u0932\u093F\u0915' : 'Owner'}:
          </Text>
          <Text style={styles.ownerName}>{store.owner_name}</Text>
        </View>

        <View style={styles.contactRow}>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => Linking.openURL(`tel:${store.phone}`)}
          >
            <Text style={styles.contactButtonIcon}>{'\u{1F4DE}'}</Text>
            <Text style={styles.contactButtonText}>{store.phone}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.addressText}>{'\u{1F4CD}'} {store.address}, {store.city}</Text>

        {/* Store KPIs */}
        <View style={styles.storeKPIs}>
          <View style={styles.storeKPI}>
            <Text style={styles.storeKPIValue}>
              {formatINR(store.avg_order_value)}
            </Text>
            <Text style={styles.storeKPILabel}>
              {isHindi ? '\u0914\u0938\u0924 \u0911\u0930\u094D\u0921\u0930' : 'Avg Order'}
            </Text>
          </View>
          <View style={styles.storeKPIDivider} />
          <View style={styles.storeKPI}>
            <Text style={styles.storeKPIValue}>{store.total_orders}</Text>
            <Text style={styles.storeKPILabel}>
              {isHindi ? '\u0915\u0941\u0932 \u0911\u0930\u094D\u0921\u0930' : 'Total Orders'}
            </Text>
          </View>
          <View style={styles.storeKPIDivider} />
          <View style={styles.storeKPI}>
            <Text style={styles.storeKPIValue}>{store.msl_compliance}%</Text>
            <Text style={styles.storeKPILabel}>MSL</Text>
          </View>
          <View style={styles.storeKPIDivider} />
          <View style={styles.storeKPI}>
            <Text
              style={[
                styles.storeKPIValue,
                { color: store.outstanding_amount > 0 ? '#EF4444' : '#22C55E' },
              ]}
            >
              {formatINR(store.outstanding_amount)}
            </Text>
            <Text style={styles.storeKPILabel}>
              {isHindi ? '\u092C\u0915\u093E\u092F\u093E' : 'Outstanding'}
            </Text>
          </View>
        </View>
      </View>

      {/* Check-in / Check-out Button */}
      <TouchableOpacity
        style={[
          styles.checkInButton,
          isCheckedIn ? styles.checkOutButton : null,
          (checkInMutation.isPending || checkOutMutation.isPending) && styles.buttonDisabled,
        ]}
        onPress={() => {
          if (isCheckedIn) {
            checkOutMutation.mutate();
          } else {
            checkInMutation.mutate();
          }
        }}
        disabled={checkInMutation.isPending || checkOutMutation.isPending}
      >
        {checkInMutation.isPending || checkOutMutation.isPending ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.checkInButtonText}>
            {isCheckedIn
              ? isHindi
                ? '\u{1F4CD} \u091A\u0947\u0915-\u0906\u0909\u091F'
                : '\u{1F4CD} Check-Out'
              : isHindi
                ? '\u{1F4CD} \u091A\u0947\u0915-\u0907\u0928 (100m \u0915\u0947 \u0905\u0902\u0926\u0930)'
                : '\u{1F4CD} Check-In (within 100m)'}
          </Text>
        )}
      </TouchableOpacity>

      {isCheckedIn && checkInTime && (
        <Text style={styles.visitTimer}>
          {isHindi ? '\u0935\u093F\u091C\u093C\u093F\u091F \u0936\u0941\u0930\u0942' : 'Visit started'}: {checkInTime.toLocaleTimeString('en-IN')}
        </Text>
      )}

      {/* Tasks for this store */}
      {storeTasks && storeTasks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isHindi ? '\u0907\u0938 \u0926\u0941\u0915\u093E\u0928 \u0915\u0947 \u0915\u093E\u0930\u094D\u092F' : 'Tasks for this Store'}{' '}
            ({storeTasks.length})
          </Text>
          {storeTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={handleCompleteTask}
              onSkip={handleSkipTask}
            />
          ))}
        </View>
      )}

      {/* Recent Orders */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {isHindi ? '\u0939\u093E\u0932 \u0915\u0947 \u0911\u0930\u094D\u0921\u0930' : 'Recent Orders'}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('NewOrder', { storeId, storeName: store.name })}
          >
            <Text style={styles.newOrderLink}>
              + {isHindi ? '\u0928\u092F\u093E \u0911\u0930\u094D\u0921\u0930' : 'New Order'}
            </Text>
          </TouchableOpacity>
        </View>

        {recentOrders && recentOrders.length > 0 ? (
          recentOrders.map((order) => (
            <View key={order.id} style={styles.orderRow}>
              <View style={styles.orderLeft}>
                <Text style={styles.orderDate}>
                  {new Date(order.date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
                <Text style={styles.orderItems}>
                  {order.items_count} items
                </Text>
              </View>
              <View style={styles.orderRight}>
                <Text style={styles.orderTotal}>{formatINR(order.total)}</Text>
                <View
                  style={[
                    styles.orderStatusBadge,
                    {
                      backgroundColor:
                        order.status === 'delivered'
                          ? '#DCFCE7'
                          : order.status === 'pending'
                            ? '#FEF3C7'
                            : '#EFF6FF',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.orderStatusText,
                      {
                        color:
                          order.status === 'delivered'
                            ? '#166534'
                            : order.status === 'pending'
                              ? '#92400E'
                              : '#1E40AF',
                      },
                    ]}
                  >
                    {order.status}
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noOrdersText}>
            {isHindi
              ? '\u0915\u094B\u0908 \u0911\u0930\u094D\u0921\u0930 \u0928\u0939\u0940\u0902'
              : 'No recent orders'}
          </Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 14,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  infoLeft: {
    flex: 1,
  },
  storeName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
  },
  channelText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  creditBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  creditText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ownerLabel: {
    fontSize: 13,
    color: '#94A3B8',
    marginRight: 4,
  },
  ownerName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  contactRow: {
    marginBottom: 8,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  contactButtonIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  contactButtonText: {
    fontSize: 13,
    color: '#1E40AF',
    fontWeight: '500',
  },
  addressText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  storeKPIs: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    justifyContent: 'space-between',
  },
  storeKPI: {
    alignItems: 'center',
    flex: 1,
  },
  storeKPIValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  storeKPILabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  storeKPIDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
  },
  checkInButton: {
    backgroundColor: '#1E40AF',
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  checkOutButton: {
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  checkInButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  visitTimer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '500',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 10,
  },
  newOrderLink: {
    fontSize: 13,
    color: '#1E40AF',
    fontWeight: '600',
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  orderLeft: {
    flex: 1,
  },
  orderDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  orderItems: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  orderRight: {
    alignItems: 'flex-end',
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  orderStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 3,
  },
  orderStatusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  noOrdersText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
});
