import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-gifted-charts';
import { Colors, Layout } from '../constants/Theme';
import { CategoryTotal, SubcategoryTotal, DailySpending, ExpenseDistribution, MonthlyCategoryTotal, MonthlyComparison } from '../services/analysis';
import { format } from 'date-fns';
import { formatCurrency } from '../utils/currency';

const screenWidth = Dimensions.get('window').width;

// --- Income vs Expense Trend Chart ---
export const IncomeExpenseLineChart: React.FC<{ data: MonthlyComparison[], width?: number }> = ({ data, width = screenWidth - 60 }) => {
    if (!data || data.length === 0) return <Text style={styles.noData}>No comparison data available</Text>;

    const incomeData = data.map(item => ({
        value: item.income,
        label: format(new Date(item.month + '-01'), 'MMM'),
        dataPointText: item.income > 0 ? formatCurrency(Math.round(item.income)) : '',
        dataPointColor: Colors.success[500],
        textColor: Colors.success[500],
        textShiftY: -10,
        textFontSize: 10
    }));

    const expenseData = data.map(item => ({
        value: item.expense,
        dataPointText: item.expense > 0 ? formatCurrency(Math.round(item.expense)) : '',
        dataPointColor: Colors.danger[500],
        textColor: Colors.danger[500],
        textShiftY: 5,
        textFontSize: 10
    }));

    return (
        <View style={styles.chartContainer}>
            <View style={styles.legendContainer}>
                <View style={[styles.legendItem, { marginRight: 20 }]}>
                    <View style={[styles.dot, { backgroundColor: Colors.success[500] }]} />
                    <Text style={styles.legendText}>Income</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: Colors.danger[500] }]} />
                    <Text style={styles.legendText}>Expense</Text>
                </View>
            </View>

            <LineChart
                data={incomeData} // First line
                data2={expenseData} // Second line
                width={width}
                height={220}
                color={Colors.success[500]}
                color2={Colors.danger[500]}
                thickness={3}
                thickness2={3}
                dataPointsColor={Colors.success[500]}
                dataPointsColor2={Colors.danger[500]}
                curved
                isAnimated
                initialSpacing={20}
                noOfSections={4}
                yAxisThickness={0}
                rulesType="solid"
                rulesColor={Colors.gray[200]}
                yAxisTextStyle={{ color: Colors.gray[500] }}
                xAxisLabelTextStyle={{ color: Colors.gray[500], fontSize: 10 }}
            />
        </View>
    );
};

// --- Trend Line Chart ---
export const TrendLineChart: React.FC<{ data: any[], type: 'daily' | 'monthly', width?: number, predictedData?: { total: number, label: string } }> = ({ data, type, width = screenWidth - 60, predictedData }) => {
    if (!data || data.length === 0) return <Text style={styles.noData}>No trend data available</Text>;

    const chartData = data.map((item, index) => ({
        value: item.total,
        label: type === 'daily' ? format(new Date(item.date), 'd') : format(new Date(item.month + '-01'), 'MMM'),
        dataPointText: formatCurrency(Math.round(item.total)),
    }));

    if (predictedData) {
        chartData.push({
            value: predictedData.total,
            label: predictedData.label,
            dataPointText: formatCurrency(Math.round(predictedData.total)),
            dataPointColor: Colors.primary[300],
            textColor: Colors.primary[400],
            textShiftY: -10,
        } as any);
    }

    return (
        <View style={styles.chartContainer}>
            <LineChart
                data={chartData}
                width={width}
                height={220}
                color={Colors.primary[500]}
                thickness={3}
                dataPointsColor={Colors.primary[700]}
                startFillColor={Colors.primary[200]}
                endFillColor={Colors.primary[50]}
                startOpacity={0.9}
                endOpacity={0.2}
                initialSpacing={20}
                noOfSections={4}
                yAxisThickness={0}
                rulesType="solid"
                rulesColor={Colors.gray[200]}
                yAxisTextStyle={{ color: Colors.gray[500] }}
                xAxisLabelTextStyle={{ color: Colors.gray[500], fontSize: 10 }}
                isAnimated
                curved
            />
        </View>
    );
};



// --- Weekly Bar Chart ---
export const WeeklyBarChart: React.FC<{ data: { week: string, total: number }[], width?: number }> = ({ data, width = screenWidth - 60 }) => {
    if (!data || data.length === 0) return <Text style={styles.noData}>No weekly data available</Text>;

    const maxVal = Math.max(...data.map(d => d.total));

    // Fix: If all values are 0, showing an empty chart is confusing. Show friendly message instead.
    if (maxVal === 0) {
        return <Text style={styles.noData}>No spending recorded for this week</Text>;
    }

    const chartData = data.map(item => ({
        value: item.total,
        label: item.week,
        frontColor: Colors.primary[600],
        topLabelComponent: () => <Text style={{ color: Colors.gray[500], fontSize: 9, marginBottom: 2 }}>{formatCurrency(Math.round(item.total))}</Text>,
    }));

    return (
        <View style={styles.chartContainer}>
            <BarChart
                key={JSON.stringify(data)} // Force re-render when data changes
                data={chartData}
                width={width}
                height={220}
                barWidth={32}
                spacing={24}
                noOfSections={4}
                maxValue={maxVal * 1.2} // Add buffer
                barBorderRadius={4}
                yAxisThickness={0}
                xAxisThickness={0}
                rulesColor={Colors.gray[200]}
                rulesType="solid"
                yAxisTextStyle={{ color: Colors.gray[500] }}
                xAxisLabelTextStyle={{ color: Colors.gray[500], fontSize: 12 }}
                isAnimated
            />
        </View>
    );
};

// --- Expense Histogram ---
export const ExpenseHistogram: React.FC<{ data: ExpenseDistribution[], width?: number }> = ({ data, width = screenWidth - 60 }) => {
    if (!data || data.length === 0) return <Text style={styles.noData}>No distribution data available</Text>;

    const chartData = data.map(item => ({
        value: item.count,
        label: item.range,
        frontColor: Colors.primary[500],
        topLabelComponent: () => <Text style={styles.topLabel}>{item.count}</Text>,
    }));

    return (
        <View style={styles.chartContainer}>
            <BarChart
                data={chartData}
                width={width}
                height={220}
                barWidth={40}
                noOfSections={3}
                barBorderRadius={4}
                frontColor={Colors.primary[500]}
                yAxisThickness={0}
                xAxisThickness={0}
                isAnimated
                xAxisLabelTextStyle={{ color: Colors.gray[500], fontSize: 10, width: 60, textAlign: 'center' }}
            />
        </View>
    );
};

// --- Category & Subcategory Drill-down ---
interface CategoryDrilldownProps {
    categoryData: CategoryTotal[];
    onSelectCategory: (category: string) => void;
    selectedCategory: string | null;
    subcategoryData: SubcategoryTotal[];
}

export const CategoryDrillDown: React.FC<CategoryDrilldownProps> = ({ categoryData, onSelectCategory, selectedCategory, subcategoryData }) => {
    const pieData = categoryData.map((item, index) => ({
        value: item.total,
        text: Math.round(item.total).toString(),
        color: getValueColor(index),
        legend: item.category,
        onPress: () => onSelectCategory(item.category)
    }));

    return (
        <View style={styles.columnContainer}>
            <View style={styles.pieContainer}>
                <PieChart
                    data={pieData}
                    donut
                    showText
                    textColor="white"
                    radius={100}
                    innerRadius={60}
                    textSize={10}
                    focusOnPress
                    showValuesAsLabels
                    showTextBackground
                    textBackgroundRadius={16}
                />
            </View>

            <View style={styles.legendContainer}>
                {pieData.map((item, index) => (
                    <TouchableOpacity key={index} style={[styles.legendItem, selectedCategory === item.legend && styles.selectedLegend]} onPress={() => item.onPress()}>
                        <View style={[styles.dot, { backgroundColor: item.color }]} />
                        <Text style={styles.legendText}>{item.legend}</Text>
                        <Text style={styles.legendValue}>{formatCurrency(Math.round(item.value))}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {selectedCategory && (
                <View style={styles.subCatContainer}>
                    <Text style={styles.subCatTitle}>Breakdown: {selectedCategory}</Text>
                    {subcategoryData.length > 0 ? (
                        <BarChart
                            data={subcategoryData.map(s => ({
                                value: s.total,
                                label: s.subcategory,
                                frontColor: Colors.success[500],
                                topLabelComponent: () => <Text style={styles.topLabel}>{formatCurrency(Math.round(s.total))}</Text>
                            }))}
                            width={screenWidth - 80}
                            height={180}
                            barWidth={30}
                            noOfSections={3}
                            isAnimated
                            yAxisThickness={0}
                            xAxisLabelTextStyle={{ fontSize: 10, color: Colors.gray[500] }}
                        />
                    ) : (
                        <Text style={styles.noData}>No subcategory data</Text>
                    )}
                </View>
            )}
        </View>
    );
};

// --- Monthly Stacked Bar Chart ---
export const MonthlyStackedBarChart: React.FC<{ data: MonthlyCategoryTotal[], width?: number }> = ({ data, width = screenWidth - 60 }) => {
    if (!data || data.length === 0) return <Text style={styles.noData}>No history available</Text>;

    // Group by month
    const months = [...new Set(data.map(d => d.month))];
    const categories = [...new Set(data.map(d => d.category))];

    // Prepare stacked data
    const stackedData = months.map(month => {
        const monthData = data.filter(d => d.month === month);
        const stacks = monthData.map((d, index) => ({
            value: d.total,
            color: getValueColor(categories.indexOf(d.category)),
            marginBottom: 2,
        }));

        return {
            stacks: stacks,
            label: format(new Date(month + '-01'), 'MMM'),
        };
    });

    return (
        <View style={styles.chartContainer}>
            <BarChart
                stackData={stackedData}
                width={width}
                height={220}
                barWidth={30}
                spacing={20}
                noOfSections={4}
                isAnimated
                yAxisThickness={0}
                xAxisThickness={0}
                xAxisLabelTextStyle={{ color: Colors.gray[500], fontSize: 10 }}
            />
            <View style={styles.legendContainer}>
                {categories.map((cat, index) => (
                    <View key={index} style={styles.legendItem}>
                        <View style={[styles.dot, { backgroundColor: getValueColor(index) }]} />
                        <Text style={styles.legendText}>{cat}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
};


// Utils
export const getValueColor = (index: number) => {
    const colors = [
        Colors.primary[500], Colors.success[500], Colors.warning[500],
        Colors.danger[500], Colors.primary[800], Colors.gray[600],
        Colors.primary[300], Colors.success.bg
    ];
    return colors[index % colors.length];
};

const styles = StyleSheet.create({
    chartContainer: {
        marginVertical: 10,
        alignItems: 'center',
        width: '100%',
    },
    columnContainer: {
        flexDirection: 'column',
        width: '100%',
    },
    pieContainer: {
        alignItems: 'center',
        marginVertical: 10,
    },
    noData: {
        textAlign: 'center',
        color: Colors.gray[500],
        marginVertical: 20,
        fontStyle: 'italic',
    },
    topLabel: {
        color: Colors.gray[600],
        fontSize: 9,
        marginBottom: 4,
    },
    legendContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: 10,
        marginBottom: 10,
        paddingHorizontal: 10,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
        marginBottom: 8,
        padding: 4,
        borderRadius: 4,
    },
    selectedLegend: {
        backgroundColor: Colors.gray[100],
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    legendText: {
        color: Colors.gray[700],
        fontSize: 12,
    },
    legendValue: {
        color: Colors.gray[900],
        fontSize: 12,
        fontWeight: '700',
        marginLeft: 4,
    },
    subCatContainer: {
        marginTop: 20,
        padding: 10,
        backgroundColor: Colors.gray[50],
        borderRadius: Layout.radius.md,
        alignItems: 'center',
    },
    subCatTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.gray[800],
        marginBottom: 10,
        alignSelf: 'flex-start',
    },
});
