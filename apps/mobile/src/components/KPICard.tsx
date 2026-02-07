import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface KPICardProps {
  /** Display value (e.g., "12", "87%", "\u20B915,200") */
  value: string;
  /** Label below the value */
  label: string;
  /** Emoji or unicode character used as icon */
  icon: string;
  /** Percentage change from previous period */
  trend?: number;
  /** Background tint color for the icon container */
  iconBgColor?: string;
  /** Color for the main value text */
  valueColor?: string;
}

/**
 * KPICard — Displays a key performance indicator with value, label,
 * icon, and optional trend arrow.
 */
export const KPICard: React.FC<KPICardProps> = ({
  value,
  label,
  icon,
  trend,
  iconBgColor = '#EFF6FF',
  valueColor = '#1E293B',
}) => {
  const trendUp = trend !== undefined && trend > 0;
  const trendDown = trend !== undefined && trend < 0;
  const trendColor = trendUp ? '#22C55E' : trendDown ? '#EF4444' : '#94A3B8';
  const trendArrow = trendUp ? '\u2191' : trendDown ? '\u2193' : '\u2192';

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
        {trend !== undefined && (
          <View style={[styles.trendBadge, { backgroundColor: `${trendColor}15` }]}>
            <Text style={[styles.trendText, { color: trendColor }]}>
              {trendArrow} {Math.abs(trend)}%
            </Text>
          </View>
        )}
      </View>

      <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>

      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    flex: 1,
    minWidth: 140,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 18,
  },
  trendBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  label: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
