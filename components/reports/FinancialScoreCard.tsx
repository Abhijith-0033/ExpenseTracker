import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';

interface FinancialScoreCardProps {
  score: number; // 0-100
  label?: string;
}

export function FinancialScoreCard({ score, label = 'Financial Health Score' }: FinancialScoreCardProps) {
  const countAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(countAnim, {
      toValue: score,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const getScoreColor = (s: number) => {
    if (s >= 80) return Colors.success[500];
    if (s >= 60) return Colors.primary[500];
    if (s >= 40) return Colors.warning[500];
    return Colors.danger[500];
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return 'Excellent';
    if (s >= 60) return 'Good';
    if (s >= 40) return 'Fair';
    return 'Needs Work';
  };

  const color = getScoreColor(score);

  return (
    <View style={styles.container}>
      <View style={[styles.circle, { borderColor: color }]}>
        <Text style={[styles.score, { color }]}>
          {Math.round(score)}
        </Text>
        <Text style={[styles.outOf, { color: Colors.gray[500] }]}>/100</Text>
        <Text style={[styles.levelLabel, { color }]}>{getScoreLabel(score)}</Text>
      </View>
      <Text style={styles.mainLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.gray[50],
  },
  score: {
    fontSize: 28,
    fontFamily: Typography.family.bold,
  },
  outOf: {
    fontSize: 10,
    fontFamily: Typography.family.regular,
  },
  levelLabel: {
    fontSize: 10,
    fontFamily: Typography.family.bold,
    marginTop: 2,
  },
  mainLabel: {
    fontSize: 12,
    fontFamily: Typography.family.medium,
    color: Colors.gray[600],
    marginTop: 8,
    textAlign: 'center',
  },
});
