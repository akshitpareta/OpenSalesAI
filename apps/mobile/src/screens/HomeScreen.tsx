import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { KPICard } from '../components/KPICard';
import { useAuthStore } from '../store/auth-store';
import { apiGet } from '../services/api';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

interface DashboardData {
  tasks_completed: number;
  tasks_total: number;
  stores_visited: number;
  stores_total: number;
  orders_placed: number;
  points_earned: number;
  task_trend: number;
  visit_trend: number;
  order_trend: number;
  points_trend: number;
}

interface BeatStore {
  id: string;
  name: string;
  address: string;
  channel: string;
  visit_order: number;
  has_pending_task: boolean;
  distance_meters: number;
}

type HomeNavProp = StackNavigationProp<RootStackParamList, 'Main'>;

const formatINR = (amount: number): string => {
  return '\u20B9' + amount.toLocaleString('en-IN');
};

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const getGreetingHindi = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return '\u0936\u0941\u092D \u092A\u094D\u0930\u092D\u093E\u0924';
  if (hour < 17) return '\u0936\u0941\u092D \u0926\u094B\u092A\u0939\u0930';
  return '\u0936\u0941\u092D \u0938\u0902\u0927\u094D\u092F\u093E';
};

const formatDate = (): string => {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeNavProp>();
  const { user } = useAuthStore();
  const isHindi = user?.preferred_language === 'hi';

  const {
    data: dashboard,
    isLoading: dashLoading,
    refetch: refetchDash,
  } = useQuery<DashboardData>({
    queryKey: ['dashboard', user?.id],
    queryFn: () => apiGet<DashboardData>(`/reps/${user?.id}/dashboard`),
    enabled: !!user?.id,
  });

  const {
    data: beatStores,
    isLoading: beatLoading,
    refetch: refetchBeat,
  } = useQuery<BeatStore[]>({
    queryKey: ['beat-today', user?.id],
    queryFn: () => apiGet<BeatStore[]>(`/beats/today?rep_id=${user?.id}`),
    enabled: !!user?.id,
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchDash(), refetchBeat()]);
    setRefreshing(false);
  }, [refetchDash, refetchBeat]);

  const greeting = isHindi ? getGreetingHindi() : getGreeting();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#1E40AF"
          colors={['#1E40AF']}
        />
      }
    >
      {/* Greeting */}
      <View style={styles.greetingSection}>
        <Text style={styles.greeting}>
          {greeting}, {user?.name?.split(' ')[0] ?? 'Rep'}! {'\u{1F44B}'}
        </Text>
        <Text style={styles.dateText}>{formatDate()}</Text>
        <View style={styles.territoryBadge}>
          <Text style={styles.territoryText}>
            {'\u{1F4CD}'} {user?.territory_name ?? 'Territory'}
          </Text>
        </View>
      </View>

      {/* KPI Cards — 2x2 Grid */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiRow}>
          <KPICard
            icon={'\u2611'}
            value={`${dashboard?.tasks_completed ?? 0}/${dashboard?.tasks_total ?? 0}`}
            label={isHindi ? '\u0915\u093E\u0930\u094D\u092F \u092A\u0942\u0930\u094D\u0923' : 'Tasks Done'}
            trend={dashboard?.task_trend}
            iconBgColor="#EFF6FF"
          />
          <View style={styles.kpiSpacer} />
          <KPICard
            icon={'\u{1F3EA}'}
            value={`${dashboard?.stores_visited ?? 0}`}
            label={isHindi ? '\u0926\u0941\u0915\u093E\u0928\u0947\u0902 \u0917\u092F\u0947' : 'Stores Visited'}
            trend={dashboard?.visit_trend}
            iconBgColor="#F0FDF4"
          />
        </View>
        <View style={styles.kpiRow}>
          <KPICard
            icon={'\u{1F4E6}'}
            value={`${dashboard?.orders_placed ?? 0}`}
            label={isHindi ? '\u0911\u0930\u094D\u0921\u0930 \u0930\u0916\u0947' : 'Orders Placed'}
            trend={dashboard?.order_trend}
            iconBgColor="#FEF3C7"
          />
          <View style={styles.kpiSpacer} />
          <KPICard
            icon={'\u2B50'}
            value={`${dashboard?.points_earned ?? 0}`}
            label={isHindi ? '\u0905\u0902\u0915 \u0905\u0930\u094D\u091C\u093F\u0924' : 'Points Earned'}
            trend={dashboard?.points_trend}
            iconBgColor="#FDF2F8"
            valueColor="#D97706"
          />
        </View>
      </View>

      {/* Today's Beat Plan */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {isHindi ? '\u0906\u091C \u0915\u093E \u092C\u0940\u091F \u092A\u094D\u0932\u093E\u0928' : "Today's Beat Plan"}
          </Text>
          <Text style={styles.sectionCount}>
            {beatStores?.length ?? 0} {isHindi ? '\u0926\u0941\u0915\u093E\u0928\u0947\u0902' : 'stores'}
          </Text>
        </View>

        {beatLoading ? (
          <View style={styles.loadingPlaceholder}>
            <Text style={styles.loadingText}>Loading beat plan...</Text>
          </View>
        ) : beatStores && beatStores.length > 0 ? (
          beatStores.map((store, index) => (
            <TouchableOpacity
              key={store.id}
              style={styles.beatStoreItem}
              onPress={() => navigation.navigate('StoreDetail', { storeId: store.id })}
            >
              <View style={styles.beatOrderBadge}>
                <Text style={styles.beatOrderText}>{store.visit_order}</Text>
              </View>
              <View style={styles.beatStoreInfo}>
                <Text style={styles.beatStoreName} numberOfLines={1}>
                  {store.name}
                </Text>
                <Text style={styles.beatStoreAddress} numberOfLines={1}>
                  {store.address}
                </Text>
              </View>
              <View style={styles.beatStoreRight}>
                {store.has_pending_task && (
                  <View style={styles.taskDot} />
                )}
                <Text style={styles.beatDistance}>
                  {store.distance_meters < 1000
                    ? `${Math.round(store.distance_meters)}m`
                    : `${(store.distance_meters / 1000).toFixed(1)}km`}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{'\u{1F4CB}'}</Text>
            <Text style={styles.emptyText}>
              {isHindi
                ? '\u0906\u091C \u0915\u0947 \u0932\u093F\u090F \u0915\u094B\u0908 \u092C\u0940\u091F \u092A\u094D\u0932\u093E\u0928 \u0928\u0939\u0940\u0902'
                : 'No beat plan for today'}
            </Text>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {isHindi ? '\u0924\u094D\u0935\u0930\u093F\u0924 \u0915\u093E\u0930\u094D\u0930\u0935\u093E\u0908' : 'Quick Actions'}
        </Text>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('StoreDetail', { storeId: '' })}
          >
            <Text style={styles.quickActionIcon}>{'\u{1F4CD}'}</Text>
            <Text style={styles.quickActionLabel}>
              {isHindi ? '\u091A\u0947\u0915-\u0907\u0928' : 'Check-in'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('NewOrder', {})}
          >
            <Text style={styles.quickActionIcon}>{'\u{1F4E6}'}</Text>
            <Text style={styles.quickActionLabel}>
              {isHindi ? '\u0928\u092F\u093E \u0911\u0930\u094D\u0921\u0930' : 'New Order'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => {
              // Navigate to Tasks tab
            }}
          >
            <Text style={styles.quickActionIcon}>{'\u{1F4CB}'}</Text>
            <Text style={styles.quickActionLabel}>
              {isHindi ? '\u0915\u093E\u0930\u094D\u092F \u0926\u0947\u0916\u0947\u0902' : 'View Tasks'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Points Banner */}
      <View style={styles.pointsBanner}>
        <View style={styles.pointsBannerLeft}>
          <Text style={styles.pointsBannerIcon}>{'\u{1F3C6}'}</Text>
          <View>
            <Text style={styles.pointsBannerTitle}>
              {isHindi ? '\u0915\u0941\u0932 \u0905\u0902\u0915' : 'Total Points'}
            </Text>
            <Text style={styles.pointsBannerValue}>
              {user?.points_balance?.toLocaleString('en-IN') ?? '0'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.redeemButton}>
          <Text style={styles.redeemButtonText}>
            {isHindi ? '\u0930\u093F\u0921\u0940\u092E' : 'Redeem'}
          </Text>
        </TouchableOpacity>
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
    paddingBottom: 24,
  },
  greetingSection: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dateText: {
    fontSize: 13,
    color: '#93C5FD',
    marginTop: 4,
  },
  territoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  territoryText: {
    fontSize: 12,
    color: '#DBEAFE',
    fontWeight: '500',
  },
  kpiGrid: {
    paddingHorizontal: 16,
    marginTop: -8,
  },
  kpiRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  kpiSpacer: {
    width: 10,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 10,
  },
  sectionCount: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  beatStoreItem: {
    flexDirection: 'row',
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
  beatOrderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  beatOrderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  beatStoreInfo: {
    flex: 1,
    marginRight: 8,
  },
  beatStoreName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  beatStoreAddress: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  beatStoreRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  beatDistance: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  loadingPlaceholder: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickActionButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    width: 100,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  quickActionIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  pointsBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pointsBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pointsBannerIcon: {
    fontSize: 28,
  },
  pointsBannerTitle: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
  pointsBannerValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#78350F',
  },
  redeemButton: {
    backgroundColor: '#D97706',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  redeemButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
