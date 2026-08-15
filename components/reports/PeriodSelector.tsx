import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { format, subDays, addDays, subWeeks, addWeeks, subMonths, addMonths } from 'date-fns';

export type PeriodType = 'daily' | 'weekly' | 'monthly';

interface PeriodSelectorProps {
  periodType: PeriodType;
  currentDate: Date;
  onPeriodTypeChange: (type: PeriodType) => void;
  onDateChange: (date: Date) => void;
}

function getLabel(type: PeriodType, date: Date): string {
  const today = new Date();
  if (type === 'daily') {
    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) return 'Today';
    if (format(date, 'yyyy-MM-dd') === format(subDays(today, 1), 'yyyy-MM-dd')) return 'Yesterday';
    return format(date, 'EEEE, d MMM yyyy');
  }
  if (type === 'weekly') {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekNum = Math.ceil(date.getDate() / 7);
    return `Week ${weekNum} • ${format(monday, 'dd MMM')} – ${format(sunday, 'dd MMM')}`;
  }
  return format(date, 'MMMM yyyy');
}

function isAtCurrentPeriod(type: PeriodType, date: Date): boolean {
  const today = new Date();
  if (type === 'daily') return format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
  if (type === 'weekly') {
    const diff = (d: Date) => {
      const day = d.getDay();
      return d.getDate() - day + (day === 0 ? -6 : 1);
    };
    const curMonday = new Date(today); curMonday.setDate(diff(today));
    const selMonday = new Date(date); selMonday.setDate(diff(date));
    return format(curMonday, 'yyyy-MM-dd') === format(selMonday, 'yyyy-MM-dd');
  }
  return format(date, 'yyyy-MM') === format(today, 'yyyy-MM');
}

function goBack(type: PeriodType, date: Date): Date {
  if (type === 'daily') return subDays(date, 1);
  if (type === 'weekly') return subWeeks(date, 1);
  return subMonths(date, 1);
}

function goForward(type: PeriodType, date: Date): Date {
  if (type === 'daily') return addDays(date, 1);
  if (type === 'weekly') return addWeeks(date, 1);
  return addMonths(date, 1);
}

function getQuickChips(type: PeriodType): { label: string; offset: number }[] {
  if (type === 'daily') return [
    { label: 'Today', offset: 0 }, { label: 'Yesterday', offset: -1 },
    { label: '2 days ago', offset: -2 }, { label: '3 days ago', offset: -3 },
  ];
  if (type === 'weekly') return [
    { label: 'This Week', offset: 0 }, { label: 'Last Week', offset: -1 },
    { label: '2 Weeks Ago', offset: -2 },
  ];
  return [
    { label: 'This Month', offset: 0 }, { label: 'Last Month', offset: -1 },
    { label: '2 Months Ago', offset: -2 }, { label: '3 Months Ago', offset: -3 },
  ];
}

export function PeriodSelector({ periodType, currentDate, onPeriodTypeChange, onDateChange }: PeriodSelectorProps) {
  const isAtCurrent = isAtCurrentPeriod(periodType, currentDate);
  const chips = getQuickChips(periodType);
  const TABS: PeriodType[] = ['daily', 'weekly', 'monthly'];

  return (
    <View style={styles.container}>
      {/* Type Tabs */}
      <View style={styles.typeTabs}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.typeTab, periodType === tab && styles.typeTabActive]}
            onPress={() => onPeriodTypeChange(tab)}
          >
            <Text style={[styles.typeTabText, periodType === tab && styles.typeTabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Navigation Row */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navArrow}
          onPress={() => onDateChange(goBack(periodType, currentDate))}
          activeOpacity={0.7}
        >
          <ChevronLeft size={18} color={Colors.gray[700]} />
        </TouchableOpacity>

        <Text style={styles.periodLabel} numberOfLines={1}>
          {getLabel(periodType, currentDate)}
        </Text>

        <TouchableOpacity
          style={[styles.navArrow, isAtCurrent && styles.navArrowDisabled]}
          onPress={() => !isAtCurrent && onDateChange(goForward(periodType, currentDate))}
          disabled={isAtCurrent}
          activeOpacity={0.7}
        >
          <ChevronRight size={18} color={isAtCurrent ? Colors.gray[300] : Colors.gray[700]} />
        </TouchableOpacity>
      </View>

      {/* Quick Jump Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContainer}
      >
        {chips.map((chip) => {
          const today = new Date();
          let chipDate: Date;
          if (periodType === 'daily') chipDate = subDays(today, Math.abs(chip.offset));
          else if (periodType === 'weekly') chipDate = subWeeks(today, Math.abs(chip.offset));
          else chipDate = subMonths(today, Math.abs(chip.offset));

          const isActive = isAtCurrentPeriod(periodType, currentDate) && chip.offset === 0
            ? true
            : format(chipDate, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd');

          return (
            <TouchableOpacity
              key={chip.label}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => onDateChange(chipDate)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.md,
    marginBottom: Layout.spacing.md,
    ...Layout.shadows.sm,
  },
  typeTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.gray[100],
    borderRadius: Layout.radius.full,
    padding: 4,
    marginBottom: 12,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Layout.radius.full,
  },
  typeTabActive: {
    backgroundColor: Colors.white,
    ...Layout.shadows.sm,
  },
  typeTabText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[500],
  },
  typeTabTextActive: {
    color: Colors.primary[600],
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    ...Layout.shadows.sm,
  },
  navArrowDisabled: {
    opacity: 0.4,
  },
  periodLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginHorizontal: 8,
  },
  chipsScroll: { maxHeight: 36 },
  chipsContainer: { gap: 8 },
  chip: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: Colors.primary[500],
  },
  chipText: {
    fontSize: 11,
    fontFamily: Typography.family.medium,
    color: Colors.gray[600],
  },
  chipTextActive: {
    color: Colors.white,
  },
});
