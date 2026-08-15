import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Polygon, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Colors, Typography } from '../../constants/Theme';

interface RadarDataPoint {
  label: string;
  thisValue: number;  // 0-100 normalized
  lastValue: number;  // 0-100 normalized
}

interface SpendingRadarProps {
  data: RadarDataPoint[];
  size?: number;
}

export function SpendingRadar({ data, size = 220 }: SpendingRadarProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const center = size / 2;
  const radius = size / 2 - 30;
  const n = data.length;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [data]);

  if (n < 3) return null;

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const r = (value / 100) * radius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  const getLabelPoint = (index: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const r = radius + 18;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  // Background grid (3 rings)
  const gridRings = [33, 66, 100].map(pct => {
    const points = data.map((_, i) => {
      const p = getPoint(i, pct);
      return `${p.x},${p.y}`;
    }).join(' ');
    return points;
  });

  // This week polygon
  const thisPoints = data.map((d, i) => {
    const p = getPoint(i, d.thisValue);
    return `${p.x},${p.y}`;
  }).join(' ');

  // Last week polygon
  const lastPoints = data.map((d, i) => {
    const p = getPoint(i, d.lastValue);
    return `${p.x},${p.y}`;
  }).join(' ');

  return (
    <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {/* Grid rings */}
        {gridRings.map((pts, i) => (
          <Polygon key={i} points={pts} fill="none" stroke={Colors.gray[200]} strokeWidth={1} />
        ))}

        {/* Axis lines */}
        {data.map((_, i) => {
          const p = getPoint(i, 100);
          return <Line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke={Colors.gray[200]} strokeWidth={1} />;
        })}

        {/* Last period polygon */}
        <Polygon points={lastPoints} fill={Colors.gray[400] + '33'} stroke={Colors.gray[400]} strokeWidth={1.5} strokeDasharray="4 2" />

        {/* This period polygon */}
        <Polygon points={thisPoints} fill={Colors.primary[500] + '33'} stroke={Colors.primary[500]} strokeWidth={2} />

        {/* Data point dots */}
        {data.map((d, i) => {
          const p = getPoint(i, d.thisValue);
          return <Circle key={i} cx={p.x} cy={p.y} r={3} fill={Colors.primary[500]} />;
        })}

        {/* Labels */}
        {data.map((d, i) => {
          const lp = getLabelPoint(i);
          return (
            <SvgText key={i} x={lp.x} y={lp.y} textAnchor="middle" fontSize={9} fontFamily={Typography.family.bold} fill={Colors.gray[600]}>
              {d.label}
            </SvgText>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.primary[500] }]} />
          <Text style={styles.legendText}>This Period</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.gray[400] }]} />
          <Text style={styles.legendText}>Last Period</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: Typography.family.regular, color: Colors.gray[600] },
});
