import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator , Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronLeft, ChevronRight, List, Calendar as CalIcon } from 'lucide-react-native';
import { Colors, Typography, Layout, SemanticColors } from '../../constants/Theme';
import { formatCurrency } from '../../utils/currency';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from 'date-fns';
import { getFutureEvents, groupEventsByDate, groupEventsByWeek, FutureEvent } from '../../services/futurecalendar/FutureCalendarEngine';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const cellSize = (SCREEN_WIDTH - 40) / 7;

// Color map for event types
const TYPE_COLORS: Record<FutureEvent['type'], string> = {
  emi: '#7C3AED', subscription: '#F59E0B', recurring: '#0BA5EC',
  debt: '#EF4444', chit: '#10B981', sinking_fund: '#14B8A6', income: '#12B76A',
};
import { SubscriptionGate } from '../../src/subscription/SubscriptionGate';

export default function FutureCalendarScreen() {
  return (
    <SubscriptionGate
      feature="future_calendar"
      title="Future Calendar is Premium"
      description="Forecast your upcoming 90 days of bills, subscriptions, EMIs, and recurring expenses."
    >
      <FutureCalendarContent />
    </SubscriptionGate>
  );
}

function FutureCalendarContent() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<FutureEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const start = new Date();
    const end = addMonths(start, 3); // 90 days
    const evts = await getFutureEvents(start, end);
    setEvents(evts);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);
  const eventsByWeek = useMemo(() => groupEventsByWeek(events), [events]);

  const navigateMonth = (dir: number) => {
    setCurrentMonth(prev => dir > 0 ? addMonths(prev, 1) : subMonths(prev, 1));
  };

  // Calendar grid data
  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const startDay = getDay(startOfMonth(currentMonth));
  const emptyDays = Array(startDay).fill(null);

  const selectedDayEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  // Month total for current month
  const monthTotal = useMemo(() => {
    const monthStr = format(currentMonth, 'yyyy-MM');
    return events
      .filter(e => e.date.startsWith(monthStr) && !e.isIncome)
      .reduce((s, e) => s + e.amount, 0);
  }, [events, currentMonth]);

  // Category breakdown for the month
  const monthBreakdown = useMemo(() => {
    const monthStr = format(currentMonth, 'yyyy-MM');
    const byType: Record<string, number> = {};
    events
      .filter(e => e.date.startsWith(monthStr) && !e.isIncome)
      .forEach(e => { byType[e.type] = (byType[e.type] || 0) + e.amount; });
    return byType;
  }, [events, currentMonth]);

  const typeLabel: Record<FutureEvent['type'], string> = {
    emi: '🏦 EMIs', subscription: '🔁 Subs', recurring: '📅 Recurring',
    debt: '💳 Debts', chit: '🏛️ Chits', sinking_fund: '🐷 Sinking',
    income: '💰 Income',
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Future Calendar</Text>
          <Text style={styles.headerSubtitle}>Next 90 days of known expenses</Text>
        </View>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'calendar' && styles.toggleBtnActive]}
            onPress={() => setViewMode('calendar')}
          >
            <CalIcon size={16} color={viewMode === 'calendar' ? Colors.primary[600] : Colors.gray[400]} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <List size={16} color={viewMode === 'list' ? Colors.primary[600] : Colors.gray[400]} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {events.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>No upcoming expenses tracked</Text>
            <Text style={styles.emptySubtitle}>Add EMIs, subscriptions, or sinking funds to see them here.</Text>
          </View>
        ) : viewMode === 'calendar' ? (
          <>
            {/* Month navigator */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.navBtn}>
                <ChevronLeft size={22} color={Colors.gray[800]} />
              </TouchableOpacity>
              <Text style={styles.monthText}>{format(currentMonth, 'MMMM yyyy')}</Text>
              <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.navBtn}>
                <ChevronRight size={22} color={Colors.gray[800]} />
              </TouchableOpacity>
            </View>

            {/* Calendar grid */}
            <View style={styles.calendarGrid}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
                <Text key={i} style={styles.dayLabel}>{d}</Text>
              ))}
              {emptyDays.map((_, i) => <View key={`e${i}`} style={styles.dayCell} />)}
              {days.map((day: Date, i: number) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayEvts = eventsByDate[dateStr] || [];
                const isSelected = selectedDate === dateStr;
                const isToday = isSameDay(day, new Date());
                const dots = dayEvts.slice(0, 3).map(e => e.color);

                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dayCell, isToday && styles.dayCellToday, isSelected && styles.dayCellSelected]}
                    onPress={() => setSelectedDate(isSelected ? null : dateStr)}
                  >
                    <Text style={[styles.dayNumber, isToday && styles.dayNumberToday, isSelected && styles.dayNumberSelected]}>
                      {format(day, 'd')}
                    </Text>
                    <View style={styles.dotRow}>
                      {dots.map((color, di) => (
                        <View key={di} style={[styles.dot, { backgroundColor: color }]} />
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Month summary */}
            <View style={styles.monthSummaryCard}>
              <Text style={styles.monthSummaryTitle}>{"This Month's Known Expenses"}</Text>
              <Text style={styles.monthSummaryTotal}>{formatCurrency(monthTotal)}</Text>
              <View style={styles.breakdownChips}>
                {Object.entries(monthBreakdown).map(([type, amt]) => (
                  <View key={type} style={[styles.chip, { backgroundColor: (TYPE_COLORS as any)[type] + '20' }]}>
                    <Text style={[styles.chipText, { color: (TYPE_COLORS as any)[type] }]}>
                      {(typeLabel as any)[type]}: {formatCurrency(amt)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Selected day events */}
            {selectedDate && selectedDayEvents.length > 0 && (
              <View style={styles.selectedDaySection}>
                <Text style={styles.selectedDayTitle}>{format(new Date(selectedDate), 'EEEE, MMMM d')}</Text>
                {selectedDayEvents.map((e, idx) => (
                  <View key={idx} style={styles.eventCard}>
                    <View style={[styles.eventIcon, { backgroundColor: e.color + '20' }]}>
                      <Text style={styles.eventIconText}>{e.icon}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.eventTitle}>{e.title}</Text>
                      <Text style={styles.eventType}>{e.type}</Text>
                    </View>
                    {e.amount > 0 && (
                      <Text style={[styles.eventAmount, { color: e.isIncome ? SemanticColors.income : SemanticColors.expense }]}>
                        {e.isIncome ? '+' : '-'}{formatCurrency(e.amount)}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          // LIST VIEW
          <>
            {eventsByWeek.map((week, wi) => (
              <View key={wi} style={styles.weekSection}>
                <View style={styles.weekHeader}>
                  <Text style={styles.weekLabel}>{week.weekLabel}</Text>
                  <Text style={styles.weekTotal}>{formatCurrency(week.total)}</Text>
                </View>
                {week.events.map((e, ei) => (
                  <View key={ei} style={styles.eventCard}>
                    <View style={[styles.eventIcon, { backgroundColor: e.color + '20' }]}>
                      <Text style={styles.eventIconText}>{e.icon}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.eventTitle}>{e.title}</Text>
                      <Text style={styles.eventType}>{format(new Date(e.date), 'MMM dd')}</Text>
                    </View>
                    {e.amount > 0 && (
                      <Text style={[styles.eventAmount, { color: e.isIncome ? SemanticColors.income : SemanticColors.expense }]}>
                        {e.isIncome ? '+' : ''}{formatCurrency(e.amount)}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: Colors.white },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  headerSubtitle: { fontSize: Typography.size.xs, color: Colors.gray[400] },
  viewToggle: { flexDirection: 'row', backgroundColor: Colors.gray[100], borderRadius: Layout.radius.md, padding: 4 },
  toggleBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: Layout.radius.sm },
  toggleBtnActive: { backgroundColor: Colors.white, ...Layout.shadows.sm },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  navBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center', ...Layout.shadows.sm },
  monthText: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16 },
  dayLabel: { width: cellSize, textAlign: 'center', marginBottom: 8, color: Colors.gray[500], fontSize: 12, fontFamily: Typography.family.medium },
  dayCell: { width: cellSize, height: cellSize * 0.9, justifyContent: 'center', alignItems: 'center', marginBottom: 4, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  dayCellToday: { borderColor: Colors.primary[600] },
  dayCellSelected: { backgroundColor: Colors.primary[100], borderColor: Colors.primary[500] },
  dayNumber: { fontSize: 13, fontFamily: Typography.family.medium, color: Colors.gray[800] },
  dayNumberToday: { color: Colors.primary[600], fontFamily: Typography.family.bold },
  dayNumberSelected: { color: Colors.primary[700], fontFamily: Typography.family.bold },
  dotRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  monthSummaryCard: { margin: 16, backgroundColor: Colors.white, borderRadius: Layout.radius.lg, padding: 20, ...Layout.shadows.sm },
  monthSummaryTitle: { fontSize: Typography.size.sm, color: Colors.gray[500], fontFamily: Typography.family.medium, marginBottom: 8 },
  monthSummaryTotal: { fontSize: Typography.size.xxl, fontFamily: Typography.family.bold, color: Colors.gray[900], marginBottom: 12 },
  breakdownChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Layout.radius.full },
  chipText: { fontSize: Typography.size.xs, fontFamily: Typography.family.medium },
  selectedDaySection: { marginHorizontal: 16, backgroundColor: Colors.white, borderRadius: Layout.radius.lg, padding: 16, ...Layout.shadows.sm, marginTop: 8 },
  selectedDayTitle: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[900], marginBottom: 12 },
  eventCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  eventIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  eventIconText: { fontSize: 18 },
  eventTitle: { fontSize: Typography.size.md, fontFamily: Typography.family.medium, color: Colors.gray[900] },
  eventType: { fontSize: Typography.size.xs, color: Colors.gray[400], textTransform: 'capitalize' },
  eventAmount: { fontSize: Typography.size.md, fontFamily: Typography.family.bold },
  weekSection: { marginHorizontal: 16, marginBottom: 16 },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.gray[200], marginBottom: 8 },
  weekLabel: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[800] },
  weekTotal: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: SemanticColors.expense },
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[600], marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: Typography.size.md, color: Colors.gray[400], textAlign: 'center', lineHeight: 22 },
});
