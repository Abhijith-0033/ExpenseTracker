
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useApp } from '../../context/AppContext';
import { TransactionList } from '../../components/TransactionList';
import { HeatmapCalendar } from '../../components/HeatmapCalendar';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isSameMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { formatCurrency } from '../../utils/currency';
export default function CalendarScreen() {
    const { transactions } = useApp();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const txsForMonth = useMemo(() => {
        return transactions.filter(t => isSameMonth(new Date(t.date), currentMonth));
    }, [transactions, currentMonth]);

    const txsForSelectedDate = useMemo(() => {
        return transactions.filter(t => isSameDay(new Date(t.date), selectedDate));
    }, [transactions, selectedDate]);

    const dailyTotal = txsForSelectedDate.reduce((sum, t) => sum + t.amount, 0);
    const monthlyTotal = txsForMonth.reduce((sum, t) => sum + t.amount, 0);

    const navigateMonth = (dir: number) => {
        setCurrentMonth(prev => dir > 0 ? addMonths(prev, 1) : subMonths(prev, 1));
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigateMonth(-1)}>
                    <ChevronLeft size={24} color="#1f2937" />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
                <TouchableOpacity onPress={() => navigateMonth(1)}>
                    <ChevronRight size={24} color="#1f2937" />
                </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 10 }}>
                <HeatmapCalendar
                    month={currentMonth}
                    transactions={txsForMonth}
                    onDayPress={setSelectedDate}
                    selectedDate={selectedDate}
                />
            </View>

            <View style={styles.summary}>

                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Daily Total</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(dailyTotal)}</Text>
                </View>
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Monthly Total</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(monthlyTotal)}</Text>
                </View>
            </View>

            <View style={styles.listContainer}>
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>{format(selectedDate, 'MMM dd, yyyy')}</Text>
                    <Text style={styles.listCount}>{txsForSelectedDate.length} Transactions</Text>
                </View>
                <TransactionList
                    transactions={txsForSelectedDate}
                    showTitle={false}
                    limit={0}
                />
            </View>

            <View style={{ height: 80 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: 60,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    monthTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 10,
    },
    dayLabel: {
        width: (Dimensions.get('window').width - 20) / 7,
        textAlign: 'center',
        color: '#9ca3af',
        marginBottom: 8,
        fontWeight: '600',
    },
    dayCell: {
        width: (Dimensions.get('window').width - 20) / 7,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        borderRadius: 20,
    },
    selectedDay: {
        backgroundColor: '#2563eb',
    },
    dayText: {
        fontSize: 16,
        color: '#1f2937',
    },
    selectedDayText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#ef4444',
        position: 'absolute',
        bottom: 4,
    },
    summary: {
        flexDirection: 'row',
        padding: 20,
        backgroundColor: '#f9fafb',
        marginHorizontal: 16,
        borderRadius: 12,
        marginTop: 10,
        justifyContent: 'space-around',
    },
    summaryItem: {
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    listContainer: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingHorizontal: 4,
        marginTop: 24,
        marginBottom: 12,
    },
    listTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    listCount: {
        fontSize: 13,
        color: '#6b7280',
        fontWeight: '500',
    },
});
