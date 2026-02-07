import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TaskCard } from '../components/TaskCard';
import { useAuthStore } from '../store/auth-store';
import { useTaskStore, Task } from '../store/task-store';
import { apiGet, apiPatch } from '../services/api';

type FilterTab = 'all' | 'pending' | 'completed' | 'skipped';

const FILTER_TABS: { key: FilterTab; label: string; labelHi: string }[] = [
  { key: 'all', label: 'All', labelHi: '\u0938\u092D\u0940' },
  { key: 'pending', label: 'Pending', labelHi: '\u092C\u093E\u0915\u0940' },
  { key: 'completed', label: 'Completed', labelHi: '\u092A\u0942\u0930\u094D\u0923' },
  { key: 'skipped', label: 'Skipped', labelHi: '\u091B\u094B\u0921\u093C\u0947' },
];

export const TasksScreen: React.FC = () => {
  const { user } = useAuthStore();
  const {
    filterStatus,
    setFilterStatus,
    setTasks,
    completeTask: completeTaskLocal,
    skipTask: skipTaskLocal,
  } = useTaskStore();
  const queryClient = useQueryClient();
  const isHindi = user?.preferred_language === 'hi';

  const {
    data: tasks,
    isLoading,
    refetch,
  } = useQuery<Task[]>({
    queryKey: ['tasks-today', user?.id],
    queryFn: async () => {
      const data = await apiGet<Task[]>(`/ai/tasks/${user?.id}/today`);
      setTasks(data);
      return data;
    },
    enabled: !!user?.id,
  });

  const completeMutation = useMutation({
    mutationFn: (taskId: string) =>
      apiPatch(`/tasks/${taskId}`, { status: 'completed' }),
    onSuccess: (_data, taskId) => {
      completeTaskLocal(taskId);
      queryClient.invalidateQueries({ queryKey: ['tasks-today'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to complete task. It has been queued for sync.');
    },
  });

  const skipMutation = useMutation({
    mutationFn: (taskId: string) =>
      apiPatch(`/tasks/${taskId}`, { status: 'skipped' }),
    onSuccess: (_data, taskId) => {
      skipTaskLocal(taskId);
      queryClient.invalidateQueries({ queryKey: ['tasks-today'] });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to skip task. It has been queued for sync.');
    },
  });

  const handleComplete = useCallback(
    (taskId: string) => {
      Alert.alert(
        isHindi ? '\u0915\u093E\u0930\u094D\u092F \u092A\u0942\u0930\u094D\u0923?' : 'Complete Task?',
        isHindi
          ? '\u0915\u094D\u092F\u093E \u0906\u092A\u0928\u0947 \u092F\u0939 \u0915\u093E\u0930\u094D\u092F \u092A\u0942\u0930\u093E \u0915\u0930 \u0932\u093F\u092F\u093E?'
          : 'Mark this task as completed?',
        [
          { text: isHindi ? '\u0930\u0926\u094D\u0926' : 'Cancel', style: 'cancel' },
          {
            text: isHindi ? '\u0939\u093E\u0901, \u092A\u0942\u0930\u094D\u0923' : 'Yes, Complete',
            onPress: () => completeMutation.mutate(taskId),
          },
        ]
      );
    },
    [completeMutation, isHindi]
  );

  const handleSkip = useCallback(
    (taskId: string) => {
      Alert.alert(
        isHindi ? '\u0915\u093E\u0930\u094D\u092F \u091B\u094B\u0921\u093C\u0947\u0902?' : 'Skip Task?',
        isHindi
          ? '\u0915\u094D\u092F\u093E \u0906\u092A \u0907\u0938 \u0915\u093E\u0930\u094D\u092F \u0915\u094B \u091B\u094B\u0921\u093C\u0928\u093E \u091A\u093E\u0939\u0924\u0947 \u0939\u0948\u0902?'
          : 'Are you sure you want to skip this task? No points will be awarded.',
        [
          { text: isHindi ? '\u0930\u0926\u094D\u0926' : 'Cancel', style: 'cancel' },
          {
            text: isHindi ? '\u091B\u094B\u0921\u093C\u0947\u0902' : 'Skip',
            style: 'destructive',
            onPress: () => skipMutation.mutate(taskId),
          },
        ]
      );
    },
    [skipMutation, isHindi]
  );

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Filter tasks
  const filteredTasks = React.useMemo(() => {
    if (!tasks) return [];
    if (filterStatus === 'all') return tasks;
    return tasks.filter((t) => t.status === filterStatus);
  }, [tasks, filterStatus]);

  // Summary counts
  const summary = React.useMemo(() => {
    if (!tasks) return { all: 0, pending: 0, completed: 0, skipped: 0 };
    return {
      all: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      skipped: tasks.filter((t) => t.status === 'skipped').length,
    };
  }, [tasks]);

  const renderTask = useCallback(
    ({ item }: { item: Task }) => (
      <TaskCard
        task={item}
        onComplete={handleComplete}
        onSkip={handleSkip}
      />
    ),
    [handleComplete, handleSkip]
  );

  const keyExtractor = useCallback((item: Task) => item.id, []);

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {FILTER_TABS.map((tab) => {
          const isActive = filterStatus === tab.key;
          const count = summary[tab.key];
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
              onPress={() => setFilterStatus(tab.key)}
            >
              <Text
                style={[styles.filterTabText, isActive && styles.filterTabTextActive]}
              >
                {isHindi ? tab.labelHi : tab.label}
              </Text>
              <View style={[styles.countBadge, isActive && styles.countBadgeActive]}>
                <Text
                  style={[
                    styles.countBadgeText,
                    isActive && styles.countBadgeTextActive,
                  ]}
                >
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Task List */}
      {isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#1E40AF" />
          <Text style={styles.loadingText}>
            {isHindi
              ? 'AI \u0915\u093E\u0930\u094D\u092F \u0932\u094B\u0921 \u0939\u094B \u0930\u0939\u0947 \u0939\u0948\u0902...'
              : 'Loading AI tasks...'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          renderItem={renderTask}
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
              <Text style={styles.emptyIcon}>
                {filterStatus === 'completed' ? '\u{1F389}' : '\u{1F4CB}'}
              </Text>
              <Text style={styles.emptyText}>
                {filterStatus === 'completed'
                  ? isHindi
                    ? '\u0905\u092D\u0940 \u0924\u0915 \u0915\u094B\u0908 \u0915\u093E\u0930\u094D\u092F \u092A\u0942\u0930\u094D\u0923 \u0928\u0939\u0940\u0902'
                    : 'No completed tasks yet'
                  : isHindi
                    ? '\u0915\u094B\u0908 \u0915\u093E\u0930\u094D\u092F \u0928\u0939\u0940\u0902 \u092E\u093F\u0932\u093E'
                    : 'No tasks found'}
              </Text>
            </View>
          }
        />
      )}

      {/* Bottom Stats Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{summary.completed}</Text>
          <Text style={styles.statLabel}>
            {isHindi ? '\u092A\u0942\u0930\u094D\u0923' : 'Done'}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{summary.pending}</Text>
          <Text style={styles.statLabel}>
            {isHindi ? '\u092C\u093E\u0915\u0940' : 'Pending'}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#D97706' }]}>
            {'\u2B50'}{' '}
            {tasks
              ?.filter((t) => t.status === 'completed')
              .reduce((sum, t) => sum + t.reward_points, 0) ?? 0}
          </Text>
          <Text style={styles.statLabel}>
            {isHindi ? '\u0905\u0902\u0915' : 'Points'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    gap: 4,
  },
  filterTabActive: {
    backgroundColor: '#EFF6FF',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  filterTabTextActive: {
    color: '#1E40AF',
  },
  countBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  countBadgeActive: {
    backgroundColor: '#1E40AF',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  countBadgeTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingVertical: 8,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  loadingText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 12,
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
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E2E8F0',
  },
});
