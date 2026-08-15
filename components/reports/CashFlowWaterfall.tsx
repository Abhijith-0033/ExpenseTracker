import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { formatCurrency } from '../../utils/currency';

interface CashFlowWaterfallProps {
  startBalance: number;
  income: number;
  expense: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_WIDTH = 48;
const CHART_HEIGHT = 180;

export function CashFlowWaterfall({ startBalance, income, expense }: CashFlowWaterfallProps) {
  const endBalance = startBalance + income - expense;
  const maxVal = Math.max(startBalance + income, expense, Math.abs(endBalance), 1);

  const bars = [
    { label: 'Start', value: startBalance, color: Colors.primary[500], type: 'base' as const },
    { label: '+Income', value: income, color: Colors.success[500], type: 'add' as const },
    { label: '-Expense', value: expense, color: Colors.danger[500], type: 'sub' as const },
    { label: 'End', value: endBalance, color: endBalance >= 0 ? Colors.success[600] : Colors.danger[600], type: 'result' as const },
  ];

  const anims = useRef(bars.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    bars.forEach((_, i) => {
      Animated.timing(anims[i], {
        toValue: 1,
        duration: 500,
        delay: i * 120,
        useNativeDriver: false,
      }).start();
    });
  }, [startBalance, income, expense]);

  return (
    <View style={styles.container}>
      <View style={[styles.chart, { height: CHART_HEIGHT }]}>
        {bars.map((bar, i) => {
          const barH = anims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [0, (Math.abs(bar.value) / maxVal) * (CHART_HEIGHT - 30)],
          });
          return (
            <View key={bar.label} style={styles.barContainer}>
              <Animated.View
                style={[
                  styles.bar,
                  { backgroundColor: bar.color, height: barH, width: BAR_WIDTH, borderRadius: 6 },
                ]}
              />
              <Text style={styles.barLabel}>{bar.label}</Text>
              <Text style={[styles.barValue, { color: bar.color }]} numberOfLines={1}>
                {formatCurrency(Math.round(Math.abs(bar.value)))}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  barContainer: {
    alignItems: 'center',
    width: BAR_WIDTH + 10,
  },
  bar: {
    borderRadius: 6,
  },
  barLabel: {
    fontSize: 10,
    fontFamily: Typography.family.medium,
    color: Colors.gray[600],
    marginTop: 4,
    textAlign: 'center',
  },
  barValue: {
    fontSize: 9,
    fontFamily: Typography.family.bold,
    textAlign: 'center',
    marginTop: 2,
  },
});
