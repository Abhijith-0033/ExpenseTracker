import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { Colors, Layout } from '../constants/Theme';
import { Card } from './ui/Card';
import { getCategoryTotals, CategoryTotal } from '../services/analysis';
import { format, addMonths, subMonths, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { formatCurrency } from '../utils/currency';
import { getValueColor } from './AnalysisCharts';

const screenWidth = Dimensions.get('window').width;

interface MonthlyExpensePieChartProps {
    initialMonth: Date;
}

export const MonthlyExpensePieChart: React.FC<MonthlyExpensePieChartProps> = ({ initialMonth }) => {
    // Local state for isolated month navigation
    const [currentMonth, setCurrentMonth] = useState(initialMonth);
    const [loading, setLoading] = useState(false);
    const [categoryData, setCategoryData] = useState<CategoryTotal[]>([]);

    // Selection state for interactivity
    const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number | null>(null);

    // Sync with global month change only if needed (optional based on UX, plan said: 
    // "User Changes Global Month: Pie chart resets to track global month")
    useEffect(() => {
        setCurrentMonth(initialMonth);
        setSelectedCategoryIndex(null); // Reset selection on month change
    }, [initialMonth]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Using startOfMonth to ensure consistent querying
            const data = await getCategoryTotals(startOfMonth(currentMonth));
            // Sort alphabetically for consistent coloring
            const sortedData = data.sort((a, b) => a.category.localeCompare(b.category));
            setCategoryData(sortedData);
        } catch (e) {
            console.error("Failed to load pie chart data", e);
        } finally {
            setLoading(false);
        }
    }, [currentMonth]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const navigateMonth = (dir: number) => {
        setCurrentMonth(prev => dir > 0 ? addMonths(prev, 1) : subMonths(prev, 1));
        setSelectedCategoryIndex(null);
    };

    // Memoized data preparation for the chart
    const chartData = useMemo(() => {
        const totalExpense = categoryData.reduce((sum, item) => sum + item.total, 0);

        return categoryData.map((item, index) => {
            const isSelected = selectedCategoryIndex === index;
            const percentage = totalExpense > 0 ? (item.total / totalExpense) * 100 : 0;

            return {
                value: item.total,
                text: `${Math.round(percentage)}%`, // On-slice label
                textBackgroundColor: 'transparent',
                textColor: Colors.white,
                textSize: 10,
                color: getValueColor(index),
                focused: isSelected, // Scales the slice
                onPress: () => {
                    // Toggle selection
                    setSelectedCategoryIndex(prev => prev === index ? null : index);
                },
                // Metadata for our own use
                category: item.category,
                percentage: percentage
            };
        });
    }, [categoryData, selectedCategoryIndex]);

    const totalAmount = useMemo(() =>
        categoryData.reduce((sum, item) => sum + item.total, 0),
        [categoryData]);

    const selectedItem = selectedCategoryIndex !== null ? chartData[selectedCategoryIndex] : null;

    const renderCenterLabel = () => {
        if (selectedItem) {
            return (
                <View style={styles.centerLabelContainer}>
                    <Text style={styles.centerLabelTitle} numberOfLines={1}>{selectedItem.category}</Text>
                    <Text style={styles.centerLabelAmount}>{formatCurrency(Math.round(selectedItem.value))}</Text>
                    <Text style={styles.centerLabelSub}>{Math.round(selectedItem.percentage)}%</Text>
                </View>
            );
        }
        return (
            <View style={styles.centerLabelContainer}>
                <Text style={styles.centerLabelTitle}>Total</Text>
                <Text style={styles.centerLabelAmount}>{formatCurrency(Math.round(totalAmount))}</Text>
            </View>
        );
    };

    const renderLegend = () => {
        return (
            <View style={styles.legendContainer}>
                {chartData.map((item, index) => {
                    const isSelected = selectedCategoryIndex === index;
                    return (
                        <TouchableOpacity
                            key={index}
                            style={[styles.legendItem, isSelected && styles.legendItemSelected]}
                            onPress={() => setSelectedCategoryIndex(prev => prev === index ? null : index)}
                        >
                            <View style={[styles.dot, { backgroundColor: item.color }]} />
                            <Text style={styles.legendText}>
                                <Text style={{ fontWeight: '600' }}>{item.category}</Text>
                                <Text style={{ color: Colors.gray[500] }}> • {formatCurrency(Math.round(item.value))} ({Math.round(item.percentage)}%)</Text>
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };

    if (loading && categoryData.length === 0) {
        return (
            <Card style={styles.card}>
                <View style={[styles.header, { justifyContent: 'center' }]}>
                    <ActivityIndicator color={Colors.primary[500]} />
                </View>
            </Card>
        );
    }

    return (
        <Card style={styles.card}>
            {/* Header with Month Selector */}
            <View style={styles.header}>
                <Text style={styles.title}>Monthly Expense Breakdown</Text>
                <View style={styles.monthSelector}>
                    <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.arrowBtn}>
                        <ChevronLeft size={20} color={Colors.gray[600]} />
                    </TouchableOpacity>
                    <Text style={styles.monthTitle}>{format(currentMonth, 'MMM yyyy')}</Text>
                    <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.arrowBtn}>
                        <ChevronRight size={20} color={Colors.gray[600]} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content */}
            {categoryData.length > 0 ? (
                <View style={styles.contentContainer}>
                    {/* Chart */}
                    <View style={styles.chartWrapper}>
                        <PieChart
                            data={chartData}
                            donut
                            showText
                            textColor="white"
                            radius={120}
                            innerRadius={75}
                            textSize={10}
                            focusOnPress
                            centerLabelComponent={renderCenterLabel}
                            isAnimated
                            animationDuration={600}
                        />
                    </View>

                    {/* Legend */}
                    {renderLegend()}
                </View>
            ) : (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No expenses recorded for {format(currentMonth, 'MMMM yyyy')}</Text>
                </View>
            )}
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        padding: Layout.spacing.lg,
        marginBottom: Layout.spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.gray[900],
        flex: 1,
    },
    monthSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.gray[100],
        padding: 4,
        borderRadius: 16,
    },
    arrowBtn: {
        padding: 4,
    },
    monthTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.gray[800],
        marginHorizontal: 8,
        minWidth: 60,
        textAlign: 'center',
    },
    contentContainer: {
        alignItems: 'center',
    },
    chartWrapper: {
        marginVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerLabelContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 140, // Should be less than 2 * innerRadius
    },
    centerLabelTitle: {
        fontSize: 12,
        color: Colors.gray[500],
        fontWeight: '600',
        marginBottom: 2,
        textAlign: 'center',
    },
    centerLabelAmount: {
        fontSize: 18,
        color: Colors.gray[900],
        fontWeight: '800',
        textAlign: 'center',
    },
    centerLabelSub: {
        fontSize: 12,
        color: Colors.primary[600],
        fontWeight: '700',
        marginTop: 2,
    },
    legendContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: 20,
        gap: 8,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 20,
        backgroundColor: Colors.gray[50],
        borderWidth: 1,
        borderColor: Colors.gray[100],
    },
    legendItemSelected: {
        backgroundColor: Colors.primary[50],
        borderColor: Colors.primary[200],
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    legendText: {
        fontSize: 12,
        color: Colors.gray[700],
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: Colors.gray[400],
        fontStyle: 'italic',
        textAlign: 'center',
    }
});
