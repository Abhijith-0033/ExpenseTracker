import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';

interface HeatMapCell {
  day: string;       // Mon, Tue, etc.
  period: string;    // Morning, Afternoon, Evening, Night
  amount: number;
  txCount: number;
}

interface HeatMapGridProps {
  data: HeatMapCell[];
  onCellPress?: (cell: HeatMapCell) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PERIODS = ['Morning', 'Afternoon', 'Evening', 'Night'];
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_WIDTH = (SCREEN_WIDTH - 80 - 70) / 7;
const CELL_HEIGHT = 40;

function getCellColor(amount: number, maxAmount: number): string {
  if (amount === 0 || maxAmount === 0) return Colors.gray[100];
  const ratio = amount / maxAmount;
  if (ratio < 0.25) return Colors.primary[500] + '33';
  if (ratio < 0.5) return Colors.primary[500] + '66';
  if (ratio < 0.75) return Colors.primary[500] + '99';
  return Colors.primary[500];
}

export function HeatMapGrid({ data, onCellPress }: HeatMapGridProps) {
  const anims = useRef(data.map(() => new Animated.Value(0))).current;
  const maxAmount = Math.max(...data.map(d => d.amount), 1);

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 200,
        delay: i * 30,
        useNativeDriver: true,
      })
    );
    Animated.stagger(30, animations).start();
  }, [data]);

  return (
    <View style={styles.container}>
      {/* Column Headers */}
      <View style={styles.headerRow}>
        <View style={{ width: 70 }} />
        {DAYS.map(day => (
          <View key={day} style={[styles.headerCell, { width: CELL_WIDTH }]}>
            <Text style={styles.headerText}>{day[0]}</Text>
          </View>
        ))}
      </View>

      {/* Rows */}
      {PERIODS.map((period, pIdx) => (
        <View key={period} style={styles.row}>
          <View style={styles.rowLabel}>
            <Text style={styles.rowLabelText}>{period}</Text>
          </View>
          {DAYS.map((day, dIdx) => {
            const cellIdx = pIdx * 7 + dIdx;
            const cell = data[cellIdx] ?? { day, period, amount: 0, txCount: 0 };
            const cellColor = getCellColor(cell.amount, maxAmount);
            return (
              <Animated.View
                key={day}
                style={[
                  styles.cell,
                  { width: CELL_WIDTH, height: CELL_HEIGHT, backgroundColor: cellColor },
                  { opacity: anims[cellIdx] ?? 1 },
                ]}
              >
                <TouchableOpacity
                  style={styles.cellTouch}
                  onPress={() => onCellPress?.(cell)}
                  activeOpacity={0.7}
                />
              </Animated.View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  headerCell: { alignItems: 'center' },
  headerText: { fontSize: 10, fontFamily: Typography.family.bold, color: Colors.gray[500] },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  rowLabel: { width: 70, justifyContent: 'center' },
  rowLabelText: { fontSize: 10, fontFamily: Typography.family.medium, color: Colors.gray[500] },
  cell: { borderRadius: 6, marginHorizontal: 2 },
  cellTouch: { flex: 1 },
});
