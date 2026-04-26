import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { Colors, Layout, Typography } from '../constants/Theme';
import { Card } from './ui/Card';
import { CategoryTotal } from '../services/analysis';
import { format, addMonths, subMonths, isSameMonth, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { formatCurrency } from '../utils/currency';
import { getValueColor } from './AnalysisCharts';
import { useApp } from '../context/AppContext';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    FadeIn,
    FadeOut
} from 'react-native-reanimated';

const screenWidth = Dimensions.get('window').width;

interface MonthlyExpensePieChartProps {
    initialMonth: Date;
    isDashboardView?: boolean;
    variant?: 'default' | 'mini';
}

export const MonthlyExpensePieChart: React.FC<MonthlyExpensePieChartProps> = ({ initialMonth, isDashboardView, variant = 'default' }) => {
    const { transactions } = useApp();
    const [currentMonth, setCurrentMonth] = useState(initialMonth);
    const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number | null>(null);

    // Animation values
    const entranceScale = useSharedValue(0.85);
    const entranceOpacity = useSharedValue(0);
    const selectionBounce = useSharedValue(1);

    // Sync and entrance animation
    useEffect(() => {
        setCurrentMonth(initialMonth);
        setSelectedCategoryIndex(null);

        entranceScale.value = 0.85;
        entranceOpacity.value = 0;
        entranceScale.value = withSpring(1, { damping: 12, stiffness: 90 });
        entranceOpacity.value = withTiming(1, { duration: 600 });
    }, [initialMonth]);

    // Derived category totals from transactions in context
    const categoryData = useMemo(() => {
        const totalsMap = new Map<string, number>();

        // Filter expenses for the current month
        const monthExpenses = transactions.filter(t => {
            const isExpense = t.type === 'expense';
            const txDate = typeof t.date === 'string' ? parseISO(t.date) : t.date;
            return isExpense && isSameMonth(txDate, currentMonth);
        });

        monthExpenses.forEach(t => {
            const currentTotal = totalsMap.get(t.category) || 0;
            totalsMap.set(t.category, currentTotal + t.amount);
        });

        const data: CategoryTotal[] = Array.from(totalsMap.entries()).map(([category, total]) => ({
            category,
            total
        }));

        return data.sort((a, b) => a.category.localeCompare(b.category));
    }, [transactions, currentMonth]);

    const navigateMonth = (dir: number) => {
        setCurrentMonth(prev => dir > 0 ? addMonths(prev, 1) : subMonths(prev, 1));
        setSelectedCategoryIndex(null);
    };

    // Chart data prep
    const chartData = useMemo(() => {
        const totalExpense = categoryData.reduce((sum, item) => sum + item.total, 0);

        return categoryData.map((item, index) => {
            const isSelected = selectedCategoryIndex === index;
            const percentage = totalExpense > 0 ? (item.total / totalExpense) * 100 : 0;

            return {
                value: item.total,
                text: `${Math.round(percentage)}%`,
                textColor: Colors.white,
                textSize: variant === 'mini' ? 0 : 10,
                color: getValueColor(index),
                focused: isSelected,
                onPress: () => {
                    if (variant === 'mini') return;
                    if (selectedCategoryIndex !== index) {
                        selectionBounce.value = 0.95;
                        selectionBounce.value = withSpring(1);
                    }
                    setSelectedCategoryIndex(prev => prev === index ? null : index);
                },
                category: item.category,
                percentage: percentage
            };
        });
    }, [categoryData, selectedCategoryIndex, variant]);

    const totalAmount = useMemo(() =>
        categoryData.reduce((sum, item) => sum + item.total, 0),
        [categoryData]);

    const selectedItem = selectedCategoryIndex !== null ? chartData[selectedCategoryIndex] : null;

    // Animated entrance + bounce — no tilt, keeps chart crisp and readable
    const containerStyle = useAnimatedStyle(() => ({
        opacity: entranceOpacity.value,
        transform: [
            { scale: entranceScale.value * selectionBounce.value },
        ],
    }));

    const renderCenterLabel = () => {
        if (variant === 'mini') return null;
        return (
            <View style={styles.centerLabelContainer}>
                <Text style={styles.centerLabelTitle}>{selectedItem ? selectedItem.category : 'Total'}</Text>
                <Text style={styles.centerLabelAmount}>
                    {formatCurrency(Math.round(selectedItem ? selectedItem.value : totalAmount))}
                </Text>
                {selectedItem && (
                    <Text style={styles.centerLabelSub}>{Math.round(selectedItem.percentage)}%</Text>
                )}
            </View>
        );
    };

    const renderLegend = () => {
        if (variant === 'mini') return null;
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
                            <View style={styles.legendTop}>
                                <View style={[styles.dot, { backgroundColor: item.color }]} />
                                <Text style={styles.legendLabel}>{item.category}</Text>
                                <Text style={styles.legendPercentage}>{Math.round(item.percentage)}%</Text>
                            </View>
                            <View style={styles.legendBarBg}>
                                <View style={[styles.legendBarFill, { width: `${item.percentage}%`, backgroundColor: item.color }]} />
                            </View>
                            <Text style={styles.legendValue}>{formatCurrency(Math.round(item.value))}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };

    const pieChartRadius = variant === 'mini' ? 35 : 110;
    const pieChartInnerRadius = variant === 'mini' ? 22 : 70;

    const chartContent = (
        <View style={variant === 'mini' ? styles.miniChartArea : styles.chartArea}>
            {variant !== 'mini' && (
                <>
                    <View style={[styles.shadowRing, { width: 248, height: 248, opacity: 0.06 }]} />
                    <View style={[styles.shadowRing, { width: 234, height: 234, opacity: 0.10 }]} />
                    <View style={[styles.shadowRing, { width: 222, height: 222, opacity: 0.15 }]} />
                </>
            )}

            <Animated.View style={[variant !== 'mini' && styles.chartWrapper, containerStyle]}>
                <PieChart
                    data={chartData}
                    donut
                    showText={variant !== 'mini'}
                    textColor="white"
                    radius={pieChartRadius}
                    innerRadius={pieChartInnerRadius}
                    textSize={10}
                    focusOnPress={variant !== 'mini'}
                    centerLabelComponent={renderCenterLabel}
                    isAnimated
                    animationDuration={800}
                    strokeWidth={variant === 'mini' ? 1 : 2}
                    strokeColor="rgba(255,255,255,0.3)"
                />
            </Animated.View>
        </View>
    );

    if (variant === 'mini') {
        return categoryData.length > 0 ? chartContent : (
            <View style={[styles.miniChartArea, { backgroundColor: Colors.gray[100], borderRadius: 40 }]} />
        );
    }

    return (
        <Card style={[styles.card, isDashboardView && styles.dashboardCard]}>
            {!isDashboardView ? (
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
            ) : (
                <View style={styles.dashboardHeader}>
                    <Text style={styles.dashboardMonthLabel}>{format(currentMonth, 'MMMM yyyy')}</Text>
                </View>
            )}

            {categoryData.length > 0 ? (
                <View style={styles.contentContainer}>
                    {chartContent}
                    {renderLegend()}
                </View>
            ) : (
                <View style={styles.emptyState}>
                    <Animated.Text entering={FadeIn} style={styles.emptyText}>
                        No expenses recorded for {format(currentMonth, 'MMMM yyyy')}
                    </Animated.Text>
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
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
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
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
        color: Colors.gray[800],
        marginHorizontal: 8,
        minWidth: 60,
        textAlign: 'center',
    },
    contentContainer: {
        alignItems: 'center',
    },
    chartArea: {
        width: 270,
        height: 270,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 24,
    },
    chartWrapper: {
        zIndex: 10,
        shadowColor: Colors.primary[600],
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
        shadowRadius: 18,
        elevation: 14,
    },
    shadowRing: {
        position: 'absolute',
        borderRadius: 999,
        backgroundColor: Colors.primary[400],
    },
    centerLabelContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 130,
    },
    centerLabelTitle: {
        fontSize: Typography.size.xs,
        color: Colors.gray[500],
        fontFamily: Typography.family.bold,
        marginBottom: 2,
        textAlign: 'center',
    },
    centerLabelAmount: {
        fontSize: Typography.size.lg,
        color: Colors.gray[900],
        fontFamily: Typography.family.bold,
        textAlign: 'center',
    },
    centerLabelSub: {
        fontSize: Typography.size.xs,
        color: Colors.primary[600],
        fontFamily: Typography.family.bold,
        marginTop: 2,
    },
    legendContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: 20,
        gap: 12,
    },
    legendItem: {
        width: '45%',
        padding: 12,
        backgroundColor: Colors.white,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.gray[100],
        ...Layout.shadows.sm,
    },
    legendItemSelected: {
        borderColor: Colors.primary[300],
        backgroundColor: Colors.primary[50],
    },
    legendTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    legendLabel: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
        color: Colors.gray[800],
        flex: 1,
    },
    legendPercentage: {
        fontSize: 11,
        fontFamily: Typography.family.bold,
        color: Colors.primary[600],
    },
    legendBarBg: {
        height: 4,
        backgroundColor: Colors.gray[100],
        borderRadius: 2,
        marginBottom: 8,
        overflow: 'hidden',
    },
    legendBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    legendValue: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: Colors.gray[400],
        fontFamily: Typography.family.regular,
        fontStyle: 'italic',
        textAlign: 'center',
    },
    dashboardCard: {
        backgroundColor: 'transparent',
        borderWidth: 0,
        shadowColor: 'transparent',
        elevation: 0,
        marginBottom: 0,
        padding: 0,
    },
    dashboardHeader: {
        alignItems: 'center',
        marginBottom: 10,
    },
    dashboardMonthLabel: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.primary[600],
    },
    miniChartArea: {
        width: 80,
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
