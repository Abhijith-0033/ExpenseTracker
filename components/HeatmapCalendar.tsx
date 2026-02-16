import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from 'date-fns';
import { Colors, Layout } from '../constants/Theme';
import { Transaction } from '../services/database';

interface HeatmapCalendarProps {
    month: Date;
    transactions: Transaction[];
    onDayPress: (date: Date) => void;
    selectedDate: Date;
}

const screenWidth = Dimensions.get('window').width;
const cellSize = (screenWidth - 40) / 7; // 40 = padding

export const HeatmapCalendar: React.FC<HeatmapCalendarProps> = ({ month, transactions, onDayPress, selectedDate }) => {

    // 1. Calculate Daily Totals & Max Spend
    const { dailyMap, maxSpend } = useMemo(() => {
        const map = new Map<string, number>();
        let max = 0;

        transactions.forEach(t => {
            if (t.category === 'Income') return;
            const key = format(new Date(t.date), 'yyyy-MM-dd');
            const newTotal = (map.get(key) || 0) + t.amount;
            map.set(key, newTotal);
            if (newTotal > max) max = newTotal;
        });

        return { dailyMap: map, maxSpend: max };
    }, [transactions]);

    // 2. Generate Days
    const days = useMemo(() => {
        const start = startOfMonth(month);
        const end = endOfMonth(month);
        return eachDayOfInterval({ start, end });
    }, [month]);

    // 3. Get Color Intensity
    const getIntensityColor = (date: Date) => {
        const key = format(date, 'yyyy-MM-dd');
        const amount = dailyMap.get(key) || 0;

        if (amount === 0) return Colors.gray[100]; // No spend

        const intensity = maxSpend > 0 ? amount / maxSpend : 0;

        // Interpolate between light and dark brand color
        // Simple distinct levels for better readability on small screens
        if (intensity > 0.8) return Colors.primary[900];
        if (intensity > 0.6) return Colors.primary[700];
        if (intensity > 0.4) return Colors.primary[500];
        if (intensity > 0.2) return Colors.primary[300];
        return Colors.primary[100];
    };

    const isSelected = (date: Date) => isSameDay(date, selectedDate);

    // Padding for start of month
    const startDay = getDay(startOfMonth(month)); // 0 = Sunday
    const emptyDays = Array(startDay).fill(null);

    return (
        <View style={styles.container}>
            <View style={styles.grid}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                    <Text key={i} style={styles.dayLabel}>{d}</Text>
                ))}

                {emptyDays.map((_, i) => (
                    <View key={`empty-${i}`} style={styles.cell} />
                ))}

                {days.map((day, i) => (
                    <TouchableOpacity
                        key={i}
                        style={[
                            styles.cell,
                            { backgroundColor: getIntensityColor(day) },
                            isSelected(day) && styles.selectedCell
                        ]}
                        onPress={() => onDayPress(day)}
                    >
                        <Text style={[
                            styles.dayText,
                            isSelected(day) && styles.selectedDayText,
                            dailyMap.get(format(day, 'yyyy-MM-dd')) ? { color: Colors.gray[900] } : { color: Colors.gray[400] },
                            // White text for dark backgrounds
                            ((dailyMap.get(format(day, 'yyyy-MM-dd')) || 0) / (maxSpend || 1)) > 0.4 && { color: 'white' }
                        ]}>
                            {format(day, 'd')}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.legend}>
                <Text style={styles.legendLabel}>Less</Text>
                <View style={[styles.legendDot, { backgroundColor: Colors.primary[100] }]} />
                <View style={[styles.legendDot, { backgroundColor: Colors.primary[300] }]} />
                <View style={[styles.legendDot, { backgroundColor: Colors.primary[500] }]} />
                <View style={[styles.legendDot, { backgroundColor: Colors.primary[700] }]} />
                <View style={[styles.legendDot, { backgroundColor: Colors.primary[900] }]} />
                <Text style={styles.legendLabel}>More</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayLabel: {
        width: cellSize,
        textAlign: 'center',
        marginBottom: 8,
        color: Colors.gray[500],
        fontSize: 12,
        fontWeight: '600',
    },
    cell: {
        width: cellSize,
        height: cellSize * 0.8, // Slightly shorter for density
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedCell: {
        borderColor: Colors.warning[500], // Highlight border for selection
        transform: [{ scale: 1.1 }],
        zIndex: 1,
    },
    dayText: {
        fontSize: 12,
        fontWeight: '600',
    },
    selectedDayText: {
        fontWeight: '800',
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 10,
        paddingRight: 10,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 4,
        marginHorizontal: 2,
    },
    legendLabel: {
        fontSize: 10,
        color: Colors.gray[500],
        marginHorizontal: 4,
    },
});
