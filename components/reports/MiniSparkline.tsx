import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

interface MiniSparklineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}

export function MiniSparkline({ data, color, width = 60, height = 20 }: MiniSparklineProps) {
  if (!data || data.length < 2) return <View style={{ width, height }} />;

  const chartData = data.map(v => ({ value: v }));

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <LineChart
        data={chartData}
        width={width}
        height={height}
        color={color}
        thickness={2}
        hideDataPoints
        hideYAxisText
        hideAxesAndRules
        initialSpacing={0}
        endSpacing={0}
        startFillColor={color}
        endFillColor={color + '00'}
        startOpacity={0.3}
        endOpacity={0}
        areaChart
        isAnimated={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({});
