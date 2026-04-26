import React, { useEffect } from 'react';
import { TextStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring
} from 'react-native-reanimated';
import { formatCurrency } from '../utils/currency';

interface AnimatedBalanceProps {
  value: number;
  style?: StyleProp<TextStyle>;
  duration?: number;
}

export function AnimatedBalance({ value, style, duration = 1000 }: AnimatedBalanceProps) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 100 });
    opacity.value = withTiming(1, { duration: duration > 500 ? 500 : duration });
  }, [value]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.Text style={[style, animatedStyle]}>
      {formatCurrency(value)}
    </Animated.Text>
  );
}
