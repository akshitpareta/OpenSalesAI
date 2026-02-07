import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import type { Task } from '../store/task-store';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface TaskCardProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onSkip: (taskId: string) => void;
  onPress?: (task: Task) => void;
}

/**
 * Priority-to-color mapping:
 * 0-25  = low (green)
 * 26-50 = medium (amber)
 * 51-75 = high (orange)
 * 76-100 = critical (red)
 */
const getPriorityColor = (priority: number): string => {
  if (priority <= 25) return '#22C55E';
  if (priority <= 50) return '#F59E0B';
  if (priority <= 75) return '#F97316';
  return '#EF4444';
};

const getPriorityLabel = (priority: number): string => {
  if (priority <= 25) return 'Low';
  if (priority <= 50) return 'Medium';
  if (priority <= 75) return 'High';
  return 'Critical';
};

const getCategoryIcon = (category: Task['category']): string => {
  switch (category) {
    case 'visit': return '\u{1F6B6}';
    case 'order': return '\u{1F4E6}';
    case 'collection': return '\u{1F4B0}';
    case 'merchandising': return '\u{1F3AA}';
    case 'coaching': return '\u{1F393}';
    default: return '\u{1F4CB}';
  }
};

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onComplete,
  onSkip,
  onPress,
}) => {
  const [showReasoning, setShowReasoning] = useState(false);
  const priorityColor = getPriorityColor(task.priority);
  const isActionable = task.status === 'pending' || task.status === 'in_progress';

  const toggleReasoning = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowReasoning(!showReasoning);
  };

  return (
    <TouchableOpacity
      style={[styles.container, { borderLeftColor: priorityColor }]}
      onPress={() => onPress?.(task)}
      activeOpacity={0.8}
    >
      {/* Header Row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.categoryIcon}>{getCategoryIcon(task.category)}</Text>
          <View style={styles.headerText}>
            <Text style={styles.storeName} numberOfLines={1}>
              {task.store_name}
            </Text>
            <Text style={styles.storeAddress} numberOfLines={1}>
              {task.store_address}
            </Text>
          </View>
        </View>
        <View style={[styles.priorityBadge, { backgroundColor: priorityColor }]}>
          <Text style={styles.priorityText}>{getPriorityLabel(task.priority)}</Text>
        </View>
      </View>

      {/* Action */}
      <Text style={styles.action}>{task.action}</Text>
      {task.action_detail ? (
        <Text style={styles.actionDetail}>{task.action_detail}</Text>
      ) : null}

      {/* Points & Impact */}
      <View style={styles.metaRow}>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsIcon}>{'\u2B50'}</Text>
          <Text style={styles.pointsText}>+{task.reward_points} pts</Text>
        </View>
        {task.estimated_impact ? (
          <Text style={styles.impactText}>{task.estimated_impact}</Text>
        ) : null}
      </View>

      {/* AI Reasoning Toggle */}
      <TouchableOpacity style={styles.reasoningToggle} onPress={toggleReasoning}>
        <Text style={styles.reasoningToggleText}>
          {showReasoning ? '\u25B2 Hide AI Reasoning' : '\u25BC Why this task?'}
        </Text>
      </TouchableOpacity>

      {showReasoning && (
        <View style={styles.reasoningContainer}>
          <Text style={styles.reasoningLabel}>AI Reasoning:</Text>
          <Text style={styles.reasoningText}>{task.ai_reasoning}</Text>
        </View>
      )}

      {/* Status / Actions */}
      {task.status === 'completed' ? (
        <View style={styles.statusBar}>
          <Text style={styles.completedText}>{'\u2713'} Completed</Text>
        </View>
      ) : task.status === 'skipped' ? (
        <View style={styles.statusBar}>
          <Text style={styles.skippedText}>{'\u2717'} Skipped</Text>
        </View>
      ) : isActionable ? (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => onComplete(task.id)}
          >
            <Text style={styles.completeButtonText}>{'\u2713'} Complete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => onSkip(task.id)}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderLeftWidth: 4,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  headerText: {
    flex: 1,
  },
  storeName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  storeAddress: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  action: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  actionDetail: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 8,
  },
  pointsIcon: {
    fontSize: 12,
    marginRight: 3,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  impactText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  reasoningToggle: {
    paddingVertical: 4,
  },
  reasoningToggleText: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '500',
  },
  reasoningContainer: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  reasoningLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 3,
  },
  reasoningText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 8,
  },
  completeButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  skipButton: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skipButtonText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 13,
  },
  statusBar: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  completedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22C55E',
  },
  skippedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
