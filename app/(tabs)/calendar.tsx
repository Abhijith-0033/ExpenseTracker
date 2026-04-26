
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, StatusBar } from 'react-native';
import { useApp } from '../../context/AppContext';
import { TransactionList } from '../../components/TransactionList';
import { HeatmapCalendar } from '../../components/HeatmapCalendar';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isSameMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, TrendingUp, TrendingDown } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../../constants/Theme';
import { formatCurrency } from '../../utils/currency';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

export default function CalendarScreen() {
    const insets = useSafeAreaInsets();
    const { transactions } = useApp();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const txsForMonth = useMemo(() => {
        return transactions.filter(t => isSameMonth(new Date(t.date), currentMonth));
    }, [transactions, currentMonth]);

    const txsForSelectedDate = useMemo(() => {
        const selected = transactions.filter(t => isSameDay(new Date(t.date), selectedDate));
        // Sort newest first
        return selected.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, selectedDate]);

    const dailyIncome = txsForSelectedDate.filter(t => t.type === 'income' || (t.category === 'Income' && !t.type)).reduce((sum, t) => sum + t.amount, 0);
    const dailyExpense = txsForSelectedDate.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const dailyTotal = dailyExpense - dailyIncome;

    const monthlyTotal = txsForMonth.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    const navigateMonth = (dir: number) => {
        setCurrentMonth(prev => dir > 0 ? addMonths(prev, 1) : subMonths(prev, 1));
    };

    const handleDayPress = (date: Date) => {
        setSelectedDate(date);
    };

    return (
        <SafeAreaView style={styles.mainContainer} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <ScrollView
                style={styles.container}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                <Animated.View entering={FadeInDown.duration(600)} style={styles.headerCard}>
                    <LinearGradient
                        colors={[Colors.white, Colors.gray[50]]}
                        style={styles.headerGradient}
                    >
                        <View style={styles.headerTop}>
                            <View>
                                <Text style={styles.headerSubtitle}>Expense Timeline</Text>
                                <Text style={styles.headerTitle}>Financial Calendar</Text>
                            </View>
                            <View style={styles.calendarCircle}>
                                <CalendarIcon size={22} color={Colors.primary[600]} />
                            </View>
                        </View>

                        <View style={styles.monthSelector}>
                            <TouchableOpacity
                                onPress={() => navigateMonth(-1)}
                                style={styles.selectorBtn}
                                activeOpacity={0.7}
                            >
                                <ChevronLeft size={22} color={Colors.gray[800]} />
                            </TouchableOpacity>
                            <View style={styles.monthDisplay}>
                                <Text style={styles.monthText}>{format(currentMonth, 'MMMM yyyy')}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => navigateMonth(1)}
                                style={styles.selectorBtn}
                                activeOpacity={0.7}
                            >
                                <ChevronRight size={22} color={Colors.gray[800]} />
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.calendarWrapper}>
                    <HeatmapCalendar
                        month={currentMonth}
                        transactions={txsForMonth}
                        onDayPress={handleDayPress}
                        selectedDate={selectedDate}
                    />
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.summaryRow}>
                    <View style={styles.summaryCard}>
                        <View style={[styles.summaryIndicator, { backgroundColor: Colors.danger[400] }]} />
                        <Text style={styles.summaryLabel}>Daily Spent</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(dailyExpense)}</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <View style={[styles.summaryIndicator, { backgroundColor: Colors.primary[400] }]} />
                        <Text style={styles.summaryLabel}>Monthly Total</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(monthlyTotal)}</Text>
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInUp.delay(300).duration(600)} style={styles.listSection}>
                    <View style={styles.listHeader}>
                        <View>
                            <Text style={styles.selectedDateText}>{format(selectedDate, 'EEEE, MMM do')}</Text>
                            <Text style={styles.txCountText}>{txsForSelectedDate.length} {txsForSelectedDate.length === 1 ? 'Transaction' : 'Transactions'}</Text>
                        </View>
                        {dailyIncome > 0 && (
                            <View style={styles.incomePill}>
                                <TrendingUp size={12} color={Colors.success[600]} />
                                <Text style={styles.incomePillText}>+{formatCurrency(dailyIncome)}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.txListWrapper}>
                        {txsForSelectedDate.length > 0 ? (
                            <TransactionList
                                transactions={txsForSelectedDate}
                                showTitle={false}
                                limit={0}
                            />
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>No transactions recorded for this day</Text>
                            </View>
                        )}
                    </View>
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: Colors.gray[50],
    },
    container: {
        flex: 1,
    },
    headerCard: {
        margin: 16,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: Colors.white,
        ...Layout.shadows.md,
    },
    headerGradient: {
        padding: 24,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    headerSubtitle: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
        color: Colors.gray[400],
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 4,
    },
    headerTitle: {
        fontSize: Typography.size.xl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    calendarCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
    },
    monthSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.gray[100],
        padding: 6,
        borderRadius: 16,
    },
    selectorBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: Colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        ...Layout.shadows.sm,
    },
    monthDisplay: {
        flex: 1,
        alignItems: 'center',
    },
    monthText: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    calendarWrapper: {
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    summaryRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 12,
        marginBottom: 24,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: Colors.white,
        borderRadius: 20,
        padding: 16,
        ...Layout.shadows.sm,
        borderWidth: 1,
        borderColor: Colors.gray[50],
    },
    summaryIndicator: {
        width: 24,
        height: 4,
        borderRadius: 2,
        marginBottom: 12,
    },
    summaryLabel: {
        fontSize: Typography.size.xs,
        color: Colors.gray[500],
        fontFamily: Typography.family.medium,
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    listSection: {
        paddingHorizontal: 16,
    },
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    selectedDateText: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    txCountText: {
        fontSize: Typography.size.sm,
        color: Colors.gray[500],
        fontFamily: Typography.family.medium,
        marginTop: 2,
    },
    incomePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.success[50],
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        gap: 6,
    },
    incomePillText: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
        color: Colors.success[600],
    },
    txListWrapper: {
        backgroundColor: Colors.gray[50],
        borderRadius: 24,
        padding: 4,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: Colors.gray[400],
        fontStyle: 'italic',
        fontFamily: Typography.family.regular,
        fontSize: Typography.size.sm,
    }
});

