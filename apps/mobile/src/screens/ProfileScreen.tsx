import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Dimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore, User } from '../store/auth-store';
import { authService } from '../services/auth';
import { offlineQueue, SyncStatus } from '../services/offline';
import { apiGet } from '../services/api';

interface LeaderboardEntry {
  rank: number;
  total_reps: number;
  points_this_month: number;
}

interface PerformanceDay {
  date: string;
  tasks_completed: number;
  orders_placed: number;
  revenue: number;
}

interface RedemptionHistory {
  id: string;
  points_spent: number;
  reward_name: string;
  redeemed_at: string;
}

const formatINR = (amount: number): string => {
  return '\u20B9' + amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const tierColors: Record<User['skill_tier'], { bg: string; text: string; label: string }> = {
  bronze: { bg: '#FDE68A', text: '#78350F', label: 'Bronze' },
  silver: { bg: '#E2E8F0', text: '#334155', label: 'Silver' },
  gold: { bg: '#FEF3C7', text: '#92400E', label: 'Gold' },
  platinum: { bg: '#DBEAFE', text: '#1E40AF', label: 'Platinum' },
};

const tierIcons: Record<User['skill_tier'], string> = {
  bronze: '\u{1F949}',
  silver: '\u{1F948}',
  gold: '\u{1F947}',
  platinum: '\u{1F48E}',
};

const CHART_WIDTH = Dimensions.get('window').width - 64;
const CHART_HEIGHT = 120;

export const ProfileScreen: React.FC = () => {
  const { user, logout, setLanguage, updatePoints } = useAuthStore();
  const isHindi = user?.preferred_language === 'hi';
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  // Fetch leaderboard position
  const { data: leaderboard } = useQuery<LeaderboardEntry>({
    queryKey: ['leaderboard', user?.id],
    queryFn: () => apiGet<LeaderboardEntry>(`/reps/${user?.id}/leaderboard`),
    enabled: !!user?.id,
  });

  // Fetch performance data
  const { data: performance } = useQuery<PerformanceDay[]>({
    queryKey: ['performance', user?.id],
    queryFn: () => apiGet<PerformanceDay[]>(`/reps/${user?.id}/performance?days=30`),
    enabled: !!user?.id,
  });

  // Fetch redemption history
  const { data: redemptions } = useQuery<RedemptionHistory[]>({
    queryKey: ['redemptions', user?.id],
    queryFn: () => apiGet<RedemptionHistory[]>(`/reps/${user?.id}/redemptions?limit=5`),
    enabled: !!user?.id,
  });

  // Load sync status
  useEffect(() => {
    const loadSyncStatus = async () => {
      const status = await offlineQueue.getSyncStatus();
      setSyncStatus(status);
    };
    loadSyncStatus();
    const interval = setInterval(loadSyncStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = useCallback(async () => {
    Alert.alert(
      isHindi ? '\u0932\u0949\u0917\u0906\u0909\u091F' : 'Logout',
      isHindi
        ? '\u0915\u094D\u092F\u093E \u0906\u092A \u0932\u0949\u0917\u0906\u0909\u091F \u0915\u0930\u0928\u093E \u091A\u093E\u0939\u0924\u0947 \u0939\u0948\u0902?'
        : 'Are you sure you want to logout?',
      [
        { text: isHindi ? '\u0930\u0926\u094D\u0926' : 'Cancel', style: 'cancel' },
        {
          text: isHindi ? '\u0932\u0949\u0917\u0906\u0909\u091F' : 'Logout',
          style: 'destructive',
          onPress: async () => {
            await authService.logout();
            await offlineQueue.clear();
            logout();
          },
        },
      ]
    );
  }, [logout, isHindi]);

  const handleLanguageChange = useCallback(
    (lang: 'en' | 'hi') => {
      setLanguage(lang);
      if (user) {
        authService.updateStoredUser({ ...user, preferred_language: lang });
      }
    },
    [setLanguage, user]
  );

  const handleForceSync = useCallback(async () => {
    await offlineQueue.flush();
    const status = await offlineQueue.getSyncStatus();
    setSyncStatus(status);
    Alert.alert(
      isHindi ? '\u0938\u093F\u0902\u0915 \u092A\u0942\u0930\u094D\u0923' : 'Sync Complete',
      `${status.pendingCount} ${isHindi ? '\u092C\u093E\u0915\u0940' : 'pending'}`
    );
  }, [isHindi]);

  if (!user) return null;

  const tier = tierColors[user.skill_tier];

  // Simple bar chart rendering for performance
  const maxRevenue = performance
    ? Math.max(...performance.map((d) => d.revenue), 1)
    : 1;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </Text>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userTerritory}>
          {'\u{1F4CD}'} {user.territory_name}
        </Text>
        <View style={[styles.tierBadge, { backgroundColor: tier.bg }]}>
          <Text style={styles.tierIcon}>{tierIcons[user.skill_tier]}</Text>
          <Text style={[styles.tierText, { color: tier.text }]}>
            {tier.label} Tier
          </Text>
        </View>
      </View>

      {/* Points Section */}
      <View style={styles.pointsCard}>
        <View style={styles.pointsLeft}>
          <Text style={styles.pointsLabel}>
            {isHindi ? '\u0915\u0941\u0932 \u0905\u0902\u0915' : 'Points Balance'}
          </Text>
          <Text style={styles.pointsValue}>
            {'\u2B50'} {user.points_balance.toLocaleString('en-IN')}
          </Text>
        </View>
        <TouchableOpacity style={styles.redeemButton}>
          <Text style={styles.redeemButtonText}>
            {isHindi ? '\u0930\u093F\u0921\u0940\u092E \u0915\u0930\u0947\u0902' : 'Redeem'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Leaderboard */}
      {leaderboard && (
        <View style={styles.leaderboardCard}>
          <Text style={styles.leaderboardIcon}>{'\u{1F3C6}'}</Text>
          <View style={styles.leaderboardInfo}>
            <Text style={styles.leaderboardTitle}>
              {isHindi ? '\u0932\u0940\u0921\u0930\u092C\u094B\u0930\u094D\u0921 \u0930\u0948\u0902\u0915' : 'Leaderboard Rank'}
            </Text>
            <Text style={styles.leaderboardRank}>
              #{leaderboard.rank}{' '}
              <Text style={styles.leaderboardTotal}>
                / {leaderboard.total_reps} reps
              </Text>
            </Text>
          </View>
          <View style={styles.leaderboardPoints}>
            <Text style={styles.leaderboardPointsValue}>
              {leaderboard.points_this_month.toLocaleString('en-IN')}
            </Text>
            <Text style={styles.leaderboardPointsLabel}>
              {isHindi ? '\u0907\u0938 \u092E\u0939\u0940\u0928\u0947' : 'This month'}
            </Text>
          </View>
        </View>
      )}

      {/* Performance Chart (Simple Bar Chart) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {isHindi
            ? '\u092A\u093F\u091B\u0932\u0947 30 \u0926\u093F\u0928 \u0915\u093E \u092A\u094D\u0930\u0926\u0930\u094D\u0936\u0928'
            : 'Last 30 Days Performance'}
        </Text>
        <View style={styles.chartContainer}>
          {performance && performance.length > 0 ? (
            <View style={styles.barChart}>
              {performance.slice(-15).map((day, index) => {
                const barHeight = Math.max(
                  4,
                  (day.revenue / maxRevenue) * CHART_HEIGHT
                );
                const date = new Date(day.date);
                return (
                  <View key={day.date} style={styles.barGroup}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: barHeight,
                          backgroundColor:
                            day.tasks_completed > 0 ? '#1E40AF' : '#CBD5E1',
                        },
                      ]}
                    />
                    <Text style={styles.barLabel}>
                      {date.getDate()}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.noDataText}>
              {isHindi
                ? '\u0915\u094B\u0908 \u0921\u0947\u091F\u093E \u0928\u0939\u0940\u0902'
                : 'No performance data yet'}
            </Text>
          )}
        </View>
      </View>

      {/* Redemption History */}
      {redemptions && redemptions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isHindi ? '\u0930\u093F\u0921\u0947\u092E\u094D\u092A\u0936\u0928 \u0907\u0924\u093F\u0939\u093E\u0938' : 'Redemption History'}
          </Text>
          {redemptions.map((r) => (
            <View key={r.id} style={styles.redemptionRow}>
              <View style={styles.redemptionLeft}>
                <Text style={styles.redemptionName}>{r.reward_name}</Text>
                <Text style={styles.redemptionDate}>
                  {new Date(r.redeemed_at).toLocaleDateString('en-IN')}
                </Text>
              </View>
              <Text style={styles.redemptionPoints}>
                -{r.points_spent.toLocaleString('en-IN')} pts
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {isHindi ? '\u0938\u0947\u091F\u093F\u0902\u0917\u094D\u0938' : 'Settings'}
        </Text>

        {/* Language Selector */}
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>
            {isHindi ? '\u092D\u093E\u0937\u093E' : 'Language'}
          </Text>
          <View style={styles.languageButtons}>
            <TouchableOpacity
              style={[
                styles.langButton,
                user.preferred_language === 'en' && styles.langButtonActive,
              ]}
              onPress={() => handleLanguageChange('en')}
            >
              <Text
                style={[
                  styles.langButtonText,
                  user.preferred_language === 'en' && styles.langButtonTextActive,
                ]}
              >
                English
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.langButton,
                user.preferred_language === 'hi' && styles.langButtonActive,
              ]}
              onPress={() => handleLanguageChange('hi')}
            >
              <Text
                style={[
                  styles.langButtonText,
                  user.preferred_language === 'hi' && styles.langButtonTextActive,
                ]}
              >
                {'\u0939\u093F\u0902\u0926\u0940'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications Toggle */}
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>
            {isHindi ? '\u0928\u094B\u091F\u093F\u092B\u093F\u0915\u0947\u0936\u0928' : 'Push Notifications'}
          </Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#E2E8F0', true: '#93C5FD' }}
            thumbColor={notificationsEnabled ? '#1E40AF' : '#CBD5E1'}
          />
        </View>

        {/* Offline Sync Status */}
        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Text style={styles.settingLabel}>
              {isHindi ? '\u0911\u092B\u0932\u093E\u0907\u0928 \u0938\u093F\u0902\u0915' : 'Offline Sync'}
            </Text>
            {syncStatus && (
              <Text style={styles.syncSubtext}>
                {syncStatus.pendingCount > 0
                  ? `${syncStatus.pendingCount} ${isHindi ? '\u092C\u093E\u0915\u0940' : 'pending'}`
                  : isHindi
                    ? '\u0938\u092C \u0905\u092A\u0921\u0947\u091F'
                    : 'All synced'}
                {syncStatus.lastSyncAt &&
                  ` \u2022 ${new Date(syncStatus.lastSyncAt).toLocaleTimeString('en-IN')}`}
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.syncButton} onPress={handleForceSync}>
            <Text style={styles.syncButtonText}>
              {isHindi ? '\u0938\u093F\u0902\u0915' : 'Sync Now'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* App Info */}
      <View style={styles.appInfoSection}>
        <Text style={styles.appInfoText}>OpenSalesAI v0.1.0</Text>
        <Text style={styles.appInfoText}>
          {user.company_name} {'\u2022'} {user.territory_name}
        </Text>
        <Text style={styles.appInfoText}>Rep ID: {user.id.slice(-8)}</Text>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>
          {isHindi ? '\u0932\u0949\u0917\u0906\u0909\u091F' : 'Logout'}
        </Text>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
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
  profileHeader: {
    backgroundColor: '#1E40AF',
    paddingTop: 20,
    paddingBottom: 28,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E40AF',
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userTerritory: {
    fontSize: 13,
    color: '#93C5FD',
    marginTop: 2,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 8,
    gap: 4,
  },
  tierIcon: {
    fontSize: 14,
  },
  tierText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pointsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    marginHorizontal: 16,
    marginTop: -14,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  pointsLeft: {},
  pointsLabel: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
  pointsValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#78350F',
  },
  redeemButton: {
    backgroundColor: '#D97706',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  redeemButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leaderboardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 14,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  leaderboardIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  leaderboardRank: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
  },
  leaderboardTotal: {
    fontSize: 13,
    fontWeight: '400',
    color: '#94A3B8',
  },
  leaderboardPoints: {
    alignItems: 'flex-end',
  },
  leaderboardPointsValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E40AF',
  },
  leaderboardPointsLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 10,
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: CHART_HEIGHT + 20,
  },
  barGroup: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 12,
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 4,
  },
  noDataText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 13,
    paddingVertical: 20,
  },
  redemptionRow: {
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
  redemptionLeft: {},
  redemptionName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  redemptionDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  redemptionPoints: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  settingLabelContainer: {
    flex: 1,
  },
  syncSubtext: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  langButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  langButtonActive: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  langButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  langButtonTextActive: {
    color: '#FFFFFF',
  },
  syncButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  syncButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
  },
  appInfoSection: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 12,
  },
  appInfoText: {
    fontSize: 11,
    color: '#CBD5E1',
    lineHeight: 18,
  },
  logoutButton: {
    backgroundColor: '#FEE2E2',
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
  bottomPadding: {
    height: 20,
  },
});
