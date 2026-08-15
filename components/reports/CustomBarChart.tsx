import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Line, Text as SvgText, Path, G } from 'react-native-svg';
import { Colors, Typography } from '../../constants/Theme';

/** Compact label for Y-axis: ₹1.2K, ₹5K, ₹1.2L */
function fmtAxis(val: number): string {
  if (val === 0) return '0';
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
  return `₹${Math.round(val)}`;
}

export interface BarItem {
  value: number;
  label?: string;
  color: string;
  showLabel?: boolean;
}

export interface BarGroup {
  label: string;
  bars: { value: number; color: string }[];
}

export interface CustomBarChartProps {
  groups: BarGroup[];
  height?: number;
  showValues?: boolean;
}

const Y_AXIS_WIDTH = 44;
const X_AXIS_HEIGHT = 20;

/**
 * SVG-based Grouped Bar Chart
 * Completely clips inside the SVG canvas — immune to Android flexbox overflow bugs.
 */
export function CustomBarChart({ groups, height = 150, showValues = false }: CustomBarChartProps) {
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 2) {
      setContainerWidth(w);
    }
  };

  const width = containerWidth || (Dimensions.get('window').width - 80);
  const chartHeight = height;
  const totalSvgHeight = chartHeight + X_AXIS_HEIGHT;
  const plotWidth = Math.max(10, width - Y_AXIS_WIDTH);

  const allValues = groups.flatMap(g => g.bars.map(b => b.value));
  const maxVal = Math.max(...allValues, 1);

  const groupCount = groups.length;
  const groupW = plotWidth / Math.max(1, groupCount);
  const fractions = [1, 0.75, 0.5, 0.25, 0];

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Svg width={width} height={totalSvgHeight}>
        {/* Horizontal Gridlines & Y-Axis Labels */}
        {fractions.map(frac => {
          const gridY = chartHeight * (1 - frac);
          const labelVal = Math.round(maxVal * frac);
          return (
            <G key={frac}>
              <Line
                x1={Y_AXIS_WIDTH}
                y1={gridY}
                x2={width}
                y2={gridY}
                stroke={Colors.gray[200]}
                strokeWidth={1}
              />
              <SvgText
                x={Y_AXIS_WIDTH - 6}
                y={gridY + 3}
                fill={Colors.gray[400]}
                fontSize={9}
                fontFamily={Typography.family.regular}
                textAnchor="end"
              >
                {fmtAxis(labelVal)}
              </SvgText>
            </G>
          );
        })}

        {/* Grouped Bars */}
        {groups.map((group, gi) => {
          const groupX = Y_AXIS_WIDTH + gi * groupW;
          const barsPerGroup = group.bars.length;
          const barGap = 3;
          const groupPadding = 4;
          const availableForBars = groupW - groupPadding * 2 - (barsPerGroup - 1) * barGap;
          const barW = Math.max(4, availableForBars / Math.max(1, barsPerGroup));

          return (
            <G key={gi}>
              {group.bars.map((bar, bi) => {
                const barX = groupX + groupPadding + bi * (barW + barGap);
                const pct = Math.min(1, Math.max(0, bar.value / maxVal));
                const barH = Math.max(pct * chartHeight, bar.value > 0 ? 3 : 0);
                const barY = chartHeight - barH;

                return (
                  <G key={bi}>
                    <Rect
                      x={barX}
                      y={barY}
                      width={barW}
                      height={barH}
                      rx={3}
                      ry={3}
                      fill={bar.color}
                    />
                    {showValues && bar.value > 0 && (
                      <SvgText
                        x={barX + barW / 2}
                        y={Math.max(10, barY - 4)}
                        fill={Colors.gray[600]}
                        fontSize={7}
                        textAnchor="middle"
                      >
                        {fmtAxis(bar.value)}
                      </SvgText>
                    )}
                  </G>
                );
              })}

              {/* X-Axis Label */}
              <SvgText
                x={groupX + groupW / 2}
                y={chartHeight + 14}
                fill={Colors.gray[500]}
                fontSize={9}
                fontFamily={Typography.family.regular}
                textAnchor="middle"
              >
                {group.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

export interface HourBarItem {
  hour: string;
  value: number;
  color: string;
}

export interface HourBarChartProps {
  data: HourBarItem[];
  height?: number;
}

/**
 * SVG-based 24-Hour Distribution Chart
 */
export function HourBarChart({ data, height = 130 }: HourBarChartProps) {
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 2) {
      setContainerWidth(w);
    }
  };

  const width = containerWidth || (Dimensions.get('window').width - 80);
  const chartHeight = height;
  const totalSvgHeight = chartHeight + X_AXIS_HEIGHT;
  const plotWidth = Math.max(10, width - Y_AXIS_WIDTH);

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const slotW = plotWidth / Math.max(1, data.length);
  const barW = Math.max(2, slotW - 2);
  const fractions = [1, 0.5, 0];

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Svg width={width} height={totalSvgHeight}>
        {/* Gridlines */}
        {fractions.map(frac => {
          const gridY = chartHeight * (1 - frac);
          const labelVal = Math.round(maxVal * frac);
          return (
            <G key={frac}>
              <Line
                x1={Y_AXIS_WIDTH}
                y1={gridY}
                x2={width}
                y2={gridY}
                stroke={Colors.gray[200]}
                strokeWidth={1}
              />
              <SvgText
                x={Y_AXIS_WIDTH - 6}
                y={gridY + 3}
                fill={Colors.gray[400]}
                fontSize={9}
                fontFamily={Typography.family.regular}
                textAnchor="end"
              >
                {fmtAxis(labelVal)}
              </SvgText>
            </G>
          );
        })}

        {/* 24 Hour Bars */}
        {data.map((item, i) => {
          const barX = Y_AXIS_WIDTH + i * slotW + (slotW - barW) / 2;
          const pct = Math.min(1, Math.max(0, item.value / maxVal));
          const barH = Math.max(pct * chartHeight, item.value > 0 ? 2 : 0);
          const barY = chartHeight - barH;
          const hourNum = parseInt(item.hour, 10);
          const showLabel = hourNum % 3 === 0;

          return (
            <G key={i}>
              <Rect
                x={barX}
                y={barY}
                width={barW}
                height={barH}
                rx={2}
                ry={2}
                fill={item.color}
              />
              {showLabel && (
                <SvgText
                  x={barX + barW / 2}
                  y={chartHeight + 14}
                  fill={Colors.gray[400]}
                  fontSize={8}
                  fontFamily={Typography.family.regular}
                  textAnchor="middle"
                >
                  {item.hour}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

export interface LinePoint {
  value: number;
  label?: string;
}

export interface CustomLineChartProps {
  data: LinePoint[];
  data2?: LinePoint[];
  color?: string;
  color2?: string;
  height?: number;
}

/**
 * SVG-based Cumulative Area / Line Chart
 */
export function CustomLineChart({
  data,
  data2,
  color = Colors.danger[500],
  color2 = Colors.success[500],
  height = 140,
}: CustomLineChartProps) {
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 2) {
      setContainerWidth(w);
    }
  };

  const width = containerWidth || (Dimensions.get('window').width - 80);
  const chartHeight = height;
  const totalSvgHeight = chartHeight + X_AXIS_HEIGHT;
  const plotWidth = Math.max(10, width - Y_AXIS_WIDTH);

  const allVals = [...data.map(d => d.value), ...(data2 ?? []).map(d => d.value)];
  const maxVal = Math.max(...allVals, 1);
  const fractions = [1, 0.5, 0];

  const n = data.length;
  const stepX = n > 1 ? plotWidth / (n - 1) : plotWidth;

  const buildPath = (points: LinePoint[]) => {
    if (points.length === 0) return { linePath: '', areaPath: '' };

    const pts = points.map((pt, i) => {
      const x = Y_AXIS_WIDTH + i * stepX;
      const pct = Math.min(1, Math.max(0, pt.value / maxVal));
      const y = chartHeight * (1 - pct);
      return { x, y };
    });

    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const firstX = pts[0].x;
    const lastX = pts[pts.length - 1].x;
    const areaPath = `${linePath} L ${lastX} ${chartHeight} L ${firstX} ${chartHeight} Z`;

    return { linePath, areaPath };
  };

  const path1 = buildPath(data);
  const path2 = data2 ? buildPath(data2) : null;

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Svg width={width} height={totalSvgHeight}>
        {/* Gridlines */}
        {fractions.map(frac => {
          const gridY = chartHeight * (1 - frac);
          const labelVal = Math.round(maxVal * frac);
          return (
            <G key={frac}>
              <Line
                x1={Y_AXIS_WIDTH}
                y1={gridY}
                x2={width}
                y2={gridY}
                stroke={Colors.gray[200]}
                strokeWidth={1}
              />
              <SvgText
                x={Y_AXIS_WIDTH - 6}
                y={gridY + 3}
                fill={Colors.gray[400]}
                fontSize={9}
                fontFamily={Typography.family.regular}
                textAnchor="end"
              >
                {fmtAxis(labelVal)}
              </SvgText>
            </G>
          );
        })}

        {/* Series 2 (e.g. Income) Area & Line */}
        {path2 && (
          <G>
            <Path d={path2.areaPath} fill={color2 + '20'} />
            <Path d={path2.linePath} stroke={color2} strokeWidth={2} fill="none" />
          </G>
        )}

        {/* Series 1 (e.g. Expense) Area & Line */}
        {path1 && (
          <G>
            <Path d={path1.areaPath} fill={color + '25'} />
            <Path d={path1.linePath} stroke={color} strokeWidth={2} fill="none" />
          </G>
        )}

        {/* X-Axis Labels */}
        {data.map((item, i) => {
          const isKeyLabel = i === 0 || i === Math.floor(n / 2) || i === n - 1;
          if (!isKeyLabel || !item.label) return null;
          const x = Y_AXIS_WIDTH + i * stepX;

          return (
            <SvgText
              key={i}
              x={x}
              y={chartHeight + 14}
              fill={Colors.gray[500]}
              fontSize={8}
              fontFamily={Typography.family.regular}
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            >
              {item.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
});
