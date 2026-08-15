import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';

interface ReportCardProps {
  title: string;
  subtitle?: string;
  rightLabel?: string;
  onRightPress?: () => void;
  children: React.ReactNode;
  style?: any;
}

export function ReportCard({ title, subtitle, rightLabel, onRightPress, children, style }: ReportCardProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {rightLabel && onRightPress ? (
          <TouchableOpacity onPress={onRightPress}>
            <Text style={styles.rightLabel}>{rightLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.md,
    ...Layout.shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Layout.spacing.md,
  },
  title: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  subtitle: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
    marginTop: 2,
  },
  rightLabel: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.primary[600],
  },
});
