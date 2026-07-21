import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { X, Sparkles } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../constants/Theme';
import { useGrowthNudge } from '../hooks/useGrowthNudge';

interface GrowthNudgeProps {
  nudgeKey: string;
  title: string;
  body: string;
  ctaLabel: string;
  onCTA: () => void;
  onDismiss?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function GrowthNudge({
  nudgeKey,
  title,
  body,
  ctaLabel,
  onCTA,
  onDismiss,
}: GrowthNudgeProps) {
  const { shouldShow, dismiss } = useGrowthNudge(nudgeKey);
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (shouldShow) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [shouldShow, translateY, opacity]);

  if (!shouldShow) return null;

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dismiss();
      if (onDismiss) onDismiss();
    });
  };

  const handleCTA = () => {
    handleDismiss();
    onCTA();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Sparkles size={16} color={Colors.warning[500]} style={styles.sparkleIcon} />
          <Text style={styles.title}>{title}</Text>
        </View>
        <Pressable onPress={handleDismiss} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
          <X size={16} color={Colors.gray[400]} />
        </Pressable>
      </View>
      <Text style={styles.body}>{body}</Text>
      <Pressable onPress={handleCTA} style={({ pressed }) => [styles.ctaBtn, pressed && styles.pressed]}>
        <Text style={styles.ctaText}>{ctaLabel}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#1E1E38',
    borderRadius: Layout.radius.lg,
    padding: 16,
    zIndex: 9999,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    ...Layout.shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  sparkleIcon: {
    marginRight: 6,
  },
  title: {
    fontSize: Typography.size.sm + 1,
    fontFamily: Typography.family.bold,
    color: Colors.white,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  body: {
    fontSize: Typography.size.xs + 1,
    fontFamily: Typography.family.regular,
    color: Colors.gray[300],
    lineHeight: 18,
    marginBottom: 12,
  },
  ctaBtn: {
    backgroundColor: Colors.primary[500],
    borderRadius: Layout.radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.white,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
