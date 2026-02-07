import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export interface StoreCardData {
  id: string;
  name: string;
  owner_name: string;
  channel: 'general_trade' | 'modern_trade' | 'wholesale' | 'horeca' | 'pharmacy';
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  last_visit_date: string | null;
  distance_meters: number | null;
  msl_compliance: number; // 0-100
  credit_tier: 'A' | 'B' | 'C' | 'D';
  pending_tasks: number;
}

interface StoreCardProps {
  store: StoreCardData;
  onPress: (store: StoreCardData) => void;
}

const channelLabels: Record<StoreCardData['channel'], string> = {
  general_trade: 'GT',
  modern_trade: 'MT',
  wholesale: 'WS',
  horeca: 'HoReCa',
  pharmacy: 'Pharma',
};

const channelColors: Record<StoreCardData['channel'], string> = {
  general_trade: '#3B82F6',
  modern_trade: '#8B5CF6',
  wholesale: '#F59E0B',
  horeca: '#EC4899',
  pharmacy: '#10B981',
};

const creditTierColors: Record<StoreCardData['credit_tier'], string> = {
  A: '#22C55E',
  B: '#3B82F6',
  C: '#F59E0B',
  D: '#EF4444',
};

const formatDistance = (meters: number | null): string => {
  if (meters === null) return '--';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
};

const formatLastVisit = (dateStr: string | null): string => {
  if (!dateStr) return 'Never visited';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
};

export const StoreCard: React.FC<StoreCardProps> = ({ store, onPress }) => {
  const channelColor = channelColors[store.channel];
  const lastVisitText = formatLastVisit(store.last_visit_date);
  const isOverdue = store.last_visit_date
    ? new Date().getTime() - new Date(store.last_visit_date).getTime() > 7 * 24 * 60 * 60 * 1000
    : true;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(store)}
      activeOpacity={0.7}
    >
      <View style={styles.topRow}>
        <View style={styles.nameSection}>
          <Text style={styles.storeName} numberOfLines={1}>
            {store.name}
          </Text>
          <Text style={styles.ownerName} numberOfLines={1}>
            {store.owner_name}
          </Text>
        </View>
        <View style={styles.badges}>
          <View style={[styles.channelBadge, { backgroundColor: channelColor }]}>
            <Text style={styles.channelText}>{channelLabels[store.channel]}</Text>
          </View>
          <View style={[styles.creditBadge, { borderColor: creditTierColors[store.credit_tier] }]}>
            <Text style={[styles.creditText, { color: creditTierColors[store.credit_tier] }]}>
              {store.credit_tier}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.address} numberOfLines={1}>
        {store.address}
      </Text>

      <View style={styles.bottomRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaIcon}>{'\u{1F4CD}'}</Text>
          <Text style={styles.metaText}>{formatDistance(store.distance_meters)}</Text>
        </View>

        <View style={styles.metaItem}>
          <Text style={styles.metaIcon}>{'\u{1F4C5}'}</Text>
          <Text style={[styles.metaText, isOverdue && styles.overdueText]}>
            {lastVisitText}
          </Text>
        </View>

        {store.pending_tasks > 0 && (
          <View style={styles.taskCountBadge}>
            <Text style={styles.taskCountText}>
              {store.pending_tasks} task{store.pending_tasks > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        <View style={styles.mslContainer}>
          <Text style={styles.metaLabel}>MSL</Text>
          <Text
            style={[
              styles.mslValue,
              { color: store.msl_compliance >= 80 ? '#22C55E' : store.msl_compliance >= 50 ? '#F59E0B' : '#EF4444' },
            ]}
          >
            {store.msl_compliance}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 5,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  nameSection: {
    flex: 1,
    marginRight: 8,
  },
  storeName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  ownerName: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  channelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  channelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  creditBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  creditText: {
    fontSize: 10,
    fontWeight: '800',
  },
  address: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    fontSize: 12,
    marginRight: 3,
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  metaLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginRight: 3,
  },
  overdueText: {
    color: '#EF4444',
  },
  taskCountBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  taskCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1E40AF',
  },
  mslContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  mslValue: {
    fontSize: 12,
    fontWeight: '700',
  },
});
