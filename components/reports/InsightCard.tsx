import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { Insight } from '../../services/reportsEngine';

interface InsightCardProps {
  insight: Insight;
  index?: number;
}

export function InsightCard({ insight, index = 0 }: InsightCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse for critical insights
    if (insight.type === 'critical') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.02, duration: 500, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
        { iterations: 3 }
      ).start();
    }
  }, []);

  const bgColor = insight.color + '14'; // ~8% opacity

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: bgColor, borderLeftColor: insight.color, transform: [{ scale: scaleAnim }, { translateY: slideAnim }], opacity: fadeAnim },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: insight.color + '26' }]}>
        <Text style={styles.iconEmoji}>{insight.icon}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{insight.title}</Text>
        <Text style={styles.body}>{insight.body}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: Layout.radius.md,
    borderLeftWidth: 3,
    padding: Layout.spacing.md,
    marginBottom: Layout.spacing.sm,
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconEmoji: {
    fontSize: 18,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 4,
  },
  body: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.gray[600],
    lineHeight: 18,
  },
});
