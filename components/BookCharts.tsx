import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { Colors, Layout } from '../constants/Theme';
import { BookItem } from '../services/books';

interface BookChartsProps {
    items: BookItem[];
}

const screenWidth = Dimensions.get('window').width;

export const BookCharts: React.FC<BookChartsProps> = ({ items }) => {
    if (items.length === 0) return null;

    // Process data for "Income vs. Expense"
    const totalIncome = items
        .filter(i => (i as any).type === 'income')
        .reduce((sum, item) => sum + item.amount, 0);

    const totalExpense = items
        .filter(i => !(i as any).type || (i as any).type === 'expense')
        .reduce((sum, item) => sum + item.amount, 0);

    const barDataComparison = [
        { value: totalIncome, label: 'Income', frontColor: Colors.success[500], spacing: 20 },
        { value: totalExpense, label: 'Expense', frontColor: Colors.danger[500] },
    ];

    // Filter for expenses only for the other charts
    const expenseItems = items.filter(i => !(i as any).type || (i as any).type === 'expense');

    // Prepare Pie Data (Top 5 expenses + Others)
    const sortedExpenses = [...expenseItems].sort((a, b) => b.amount - a.amount);
    const topExpenses = sortedExpenses.slice(0, 5);
    const otherExpenses = sortedExpenses.slice(5);
    const otherTotal = otherExpenses.reduce((sum, item) => sum + item.amount, 0);

    const pieData = topExpenses.map((item, index) => ({
        value: item.amount,
        color: getColor(index),
        text: item.name,
    }));

    if (otherTotal > 0) {
        pieData.push({
            value: otherTotal,
            color: Colors.gray[400],
            text: 'Others',
        });
    }

    // Prepare Bar Data (Expenses)
    const barData = sortedExpenses.slice(0, 8).map((item, index) => ({
        value: item.amount,
        label: item.name.length > 8 ? item.name.substring(0, 6) + '..' : item.name,
        frontColor: getColor(index),
        topLabelComponent: () => (
            <Text style={{ color: Colors.gray[600], fontSize: 10, marginBottom: 2 }}>
                {Math.round(item.amount)}
            </Text>
        ),
    }));

    return (
        <View style={styles.container}>
            {/* Income vs Expense Comparison */}
            <View style={styles.chartCard} >
                <Text style={styles.chartTitle}>Income vs. Expense</Text>
                <View style={styles.chartWrapper}>
                    <BarChart
                        data={barDataComparison}
                        barWidth={40}
                        noOfSections={3}
                        barBorderRadius={4}
                        frontColor="lightgray"
                        yAxisThickness={0}
                        xAxisThickness={0}
                        hideRules
                        yAxisTextStyle={{ color: Colors.gray[400], fontSize: 10 }}
                        xAxisLabelTextStyle={{ color: Colors.gray[600], fontSize: 10 }}
                    />
                </View>
            </View>

            {/* Pie Chart (Expenses) */}
            <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Expense Distribution</Text>
                <View style={styles.pieContainer}>
                    <PieChart
                        data={pieData}
                        donut
                        radius={80}
                        innerRadius={50}
                        showText
                        textColor="white"
                        textSize={10}
                    />
                    <View style={styles.legendContainer}>
                        {pieData.map((item, index) => (
                            <View key={index} style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                                <Text style={styles.legendText} numberOfLines={1}>{item.text}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </View>

            {/* Bar Chart (Expenses BreakDown) */}
            <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Top Expense Items</Text>
                <BarChart
                    data={barData}
                    width={screenWidth - 80}
                    height={180}
                    barWidth={24}
                    spacing={20}
                    barBorderRadius={4}
                    noOfSections={4}
                    yAxisThickness={0}
                    xAxisThickness={1}
                    xAxisColor={Colors.gray[300]}
                    yAxisTextStyle={{ color: Colors.gray[500], fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: Colors.gray[500], fontSize: 10 }}
                    isAnimated
                />
            </View>
        </View>
    );
};

const getColor = (index: number) => {
    const palette = [
        Colors.primary[500],
        Colors.success[500],
        Colors.warning[500],
        Colors.danger[500],
        Colors.primary[300],
        Colors.success[300],
        Colors.warning[300],
        Colors.danger[300],
    ];
    return palette[index % palette.length];
};

const styles = StyleSheet.create({
    container: {
        marginBottom: Layout.spacing.xl,
    },
    chartCard: {
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.xl,
        padding: Layout.spacing.lg,
        marginBottom: Layout.spacing.md,
        ...Layout.shadows.sm,
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.gray[900],
        marginBottom: 16,
    },
    chartWrapper: {
        alignItems: 'center',
        paddingRight: 20,
    },
    pieContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    legendContainer: {
        marginLeft: 16,
        flex: 1,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 8,
    },
    legendText: {
        fontSize: 12,
        color: Colors.gray[700],
    },
});
