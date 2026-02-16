
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, StatusBar, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, Layout } from '../../constants/Theme';
import { Card } from '../../components/ui/Card';
import {
    CategoryTotal,
    SubcategoryTotal,
    DailySpending,
    ExpenseDistribution,
    MonthlyCategoryTotal,
    getCategoryTotals,
    getSubcategoryTotals,
    getDailySpendingTrend,
    getWeeklySpendingTrend,
    getMonthlySpendingTrend,
    getExpenseDistribution,
    getMonthlyCategoryTrend,
    getMonthlyIncomeVsExpense,
    MonthlyComparison
} from '../../services/analysis';
import {
    TrendLineChart,
    ExpenseHistogram,
    CategoryDrillDown,
    MonthlyStackedBarChart,
    WeeklyBarChart,
    IncomeExpenseLineChart
} from '../../components/AnalysisCharts';
import { format, startOfMonth, addMonths, subMonths, isSameMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { formatCurrency } from '../../utils/currency';
import { CategoryBreakdownList } from '../../components/CategoryBreakdownList';
import { MonthlyTrendSection } from '../../components/MonthlyTrendSection';
import { MonthlyExpensePieChart } from '../../components/MonthlyExpensePieChart';

const screenWidth = Dimensions.get('window').width;



export default function AnalyticsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [loadingSubcats, setLoadingSubcats] = useState(false);
    const [viewMode, setViewMode] = useState<'month' | 'all'>('month');
    const [selectedMonth, setSelectedMonth] = useState(new Date());

    // Data States
    const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([]);
    const [subcategoryData, setSubcategoryData] = useState<SubcategoryTotal[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Chart Data States
    const [dailyTrend, setDailyTrend] = useState<DailySpending[]>([]);
    const [weeklyTrend, setWeeklyTrend] = useState<{ week: string, total: number }[]>([]);
    const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
    const [distribution, setDistribution] = useState<ExpenseDistribution[]>([]);
    const [stackedData, setStackedData] = useState<MonthlyCategoryTotal[]>([]);
    const [comparisonData, setComparisonData] = useState<MonthlyComparison[]>([]);

    const [activeChart, setActiveChart] = useState<'trend' | 'distribution' | 'stacked'>('trend');

    const loadData = async () => {
        setLoading(true);
        try {
            const dateFilter = viewMode === 'month' ? selectedMonth : undefined;

            // 1. Fetch Totals
            const cats = await getCategoryTotals(dateFilter);
            setCategoryTotals(cats);

            // 2. Fetch specific chart data
            const daily = await getDailySpendingTrend(selectedMonth);
            setDailyTrend(daily);

            const weekly = await getWeeklySpendingTrend(selectedMonth);
            setWeeklyTrend(weekly);

            if (viewMode === 'all') {
                const monthly = await getMonthlySpendingTrend(selectedMonth.getFullYear());
                setMonthlyTrend(monthly);
            }

            const dist = await getExpenseDistribution(dateFilter);
            setDistribution(dist);

            const stacked = await getMonthlyCategoryTrend(selectedMonth.getFullYear());
            setStackedData(stacked);

            const comparison = await getMonthlyIncomeVsExpense(selectedMonth.getFullYear());
            setComparisonData(comparison);

            // Reset subcategory selection when filter changes
            setSelectedCategory(null);
            setSubcategoryData([]);

        } catch (e) {
            console.error("Error loading analysis", e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [viewMode, selectedMonth])
    );

    const handleCategorySelect = async (category: string) => {
        if (selectedCategory === category) {
            setSelectedCategory(null);
            setSubcategoryData([]);
            return;
        }

        setSelectedCategory(category);
        setLoadingSubcats(true);
        const dateFilter = viewMode === 'month' ? selectedMonth : undefined;
        const subs = await getSubcategoryTotals(category, dateFilter);
        setSubcategoryData(subs);
        setLoadingSubcats(false);
    };

    const navigateMonth = (dir: number) => {
        setSelectedMonth(prev => dir > 0 ? addMonths(prev, 1) : subMonths(prev, 1));
    };

    const totalExpense = categoryTotals.reduce((sum, item) => sum + item.total, 0);

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={styles.headerTitle}>Analytics</Text>
                <TouchableOpacity onPress={() => router.push('/budgets' as any)} style={styles.budgetBtn}>
                    <Text style={styles.budgetBtnText}>Manage Budgets</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.controlsRow}>
                <View style={styles.toggleContainer}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, viewMode === 'month' && styles.toggleBtnActive]}
                        onPress={() => setViewMode('month')}
                    >
                        <Text style={[styles.toggleText, viewMode === 'month' && styles.toggleTextActive]}>Monthly</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, viewMode === 'all' && styles.toggleBtnActive]}
                        onPress={() => setViewMode('all')}
                    >
                        <Text style={[styles.toggleText, viewMode === 'all' && styles.toggleTextActive]}>All Time</Text>
                    </TouchableOpacity>
                </View>

                {viewMode === 'month' && (
                    <View style={styles.monthSelector}>
                        <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.arrowBtn}>
                            <ChevronLeft size={20} color={Colors.gray[700]} />
                        </TouchableOpacity>
                        <Text style={styles.monthTitle}>{format(selectedMonth, 'MMM yyyy')}</Text>
                        <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.arrowBtn}>
                            <ChevronRight size={20} color={Colors.gray[700]} />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );

    const renderChartTabs = () => (
        <View style={styles.chartTabs}>
            <TouchableOpacity
                style={[styles.tab, activeChart === 'trend' && styles.activeTab]}
                onPress={() => setActiveChart('trend')}
            >
                <Text style={[styles.tabText, activeChart === 'trend' && styles.activeTabText]}>Trend</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, activeChart === 'distribution' && styles.activeTab]}
                onPress={() => setActiveChart('distribution')}
            >
                <Text style={[styles.tabText, activeChart === 'distribution' && styles.activeTabText]}>Dist</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, activeChart === 'stacked' && styles.activeTab]}
                onPress={() => setActiveChart('stacked')}
            >
                <Text style={[styles.tabText, activeChart === 'stacked' && styles.activeTabText]}>Compare</Text>
            </TouchableOpacity>
        </View>
    );

    if (loading && categoryTotals.length === 0) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.primary[500]} />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <StatusBar barStyle="dark-content" />

            {renderHeader()}

            <MonthlyTrendSection />

            {/* Total Summary Card */}
            <Card style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>
                    {viewMode === 'month' ? `Total Expense (${format(selectedMonth, 'MMM yyyy')})` : 'All Time Total Expense'}
                </Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalExpense)}</Text>
            </Card>

            {/* Category Breakdown Section */}
            <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Detailed Breakdown</Text>
                {categoryTotals.length > 0 ? (
                    <CategoryBreakdownList
                        categoryData={categoryTotals}
                        selectedCategory={selectedCategory}
                        onSelectCategory={handleCategorySelect}
                        subcategoryData={subcategoryData}
                        loadingSubcategories={loadingSubcats}
                    />
                ) : (
                    <Text style={styles.noData}>No data for this period</Text>
                )}
            </View>

            {/* Advanced Visualizations */}
            <Card style={styles.sectionCard}>
                <View style={styles.chartHeaderRow}>
                    <Text style={styles.sectionTitle}>Visual Insights</Text>
                </View>
                {renderChartTabs()}

                <View style={styles.chartContent}>
                    {activeChart === 'trend' && (
                        <>
                            <Text style={styles.chartSubtitle}>
                                {viewMode === 'month' ? 'Daily Spending Trend' : 'Monthly Spending Trend'}
                            </Text>
                            <TrendLineChart
                                data={viewMode === 'month' ? dailyTrend : monthlyTrend}
                                type={viewMode === 'month' ? 'daily' : 'monthly'}
                            />
                        </>
                    )}

                    {activeChart === 'distribution' && (
                        <>
                            <Text style={styles.chartSubtitle}>Expense Amount Distribution</Text>
                            <ExpenseHistogram data={distribution} />
                        </>
                    )}

                    {activeChart === 'stacked' && (
                        <>
                            <Text style={styles.chartSubtitle}>Category Composition (Yearly)</Text>
                            <MonthlyStackedBarChart data={stackedData} />
                        </>
                    )}
                </View>
            </Card>

            {/* Weekly Expense Trend Section */}
            <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Weekly Expense Trend</Text>
                <Text style={styles.chartSubtitle}>
                    {format(selectedMonth, 'MMMM yyyy')}
                </Text>
                <WeeklyBarChart
                    data={weeklyTrend}
                />
            </Card>

            {/* Monthly Income vs Expense Section */}
            <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Monthly Income vs Expense</Text>
                <Text style={styles.chartSubtitle}>
                    {selectedMonth.getFullYear()}
                </Text>
                <IncomeExpenseLineChart
                    data={comparisonData}
                />
            </Card>

            {/* Monthly Expense Pie Chart (Interactive) */}
            <MonthlyExpensePieChart initialMonth={selectedMonth} />

            <View style={{ height: 80 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.gray[50],
    },
    content: {
        padding: Layout.spacing.md,
        paddingTop: 60,
    },
    header: {
        marginBottom: Layout.spacing.md,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: Colors.gray[900],
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.gray[200],
        borderRadius: Layout.radius.full,
        padding: 4,
    },
    toggleBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: Layout.radius.full,
    },
    toggleBtnActive: {
        backgroundColor: Colors.white,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    toggleText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.gray[500],
    },
    toggleTextActive: {
        color: Colors.gray[900],
    },
    monthSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        padding: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.gray[200],
    },
    arrowBtn: {
        padding: 4,
    },
    monthTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.gray[800],
        marginHorizontal: 8,
        minWidth: 70,
        textAlign: 'center',
    },
    sectionCard: {
        padding: Layout.spacing.lg,
        marginBottom: Layout.spacing.lg,
    },
    summaryCard: {
        padding: Layout.spacing.lg,
        marginBottom: Layout.spacing.lg,
        backgroundColor: Colors.primary[50],
        borderWidth: 1,
        borderColor: Colors.primary[100],
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 14,
        color: Colors.primary[700],
        marginBottom: 4,
        fontWeight: '600',
    },
    summaryValue: {
        fontSize: 32,
        fontWeight: '800',
        color: Colors.primary[900],
    },
    sectionContainer: {
        marginBottom: Layout.spacing.lg,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: Layout.spacing.md,
        color: Colors.gray[900],
    },
    chartHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    chartTabs: {
        flexDirection: 'row',
        marginBottom: 20,
        backgroundColor: Colors.gray[100],
        borderRadius: 8,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    activeTab: {
        backgroundColor: Colors.white,
        ...Layout.shadows.sm,
    },
    tabText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.gray[500],
    },
    activeTabText: {
        color: Colors.primary[600],
    },
    chartContent: {
        alignItems: 'center',
    },
    chartSubtitle: {
        fontSize: 14,
        color: Colors.gray[500],
        marginBottom: 10,
        alignSelf: 'flex-start',
    },
    noData: {
        padding: 20,
        color: Colors.gray[400],
        fontStyle: 'italic',
        textAlign: 'center',
    },
    budgetBtn: {
        backgroundColor: Colors.primary[100],
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    budgetBtnText: {
        color: Colors.primary[700],
        fontWeight: '600',
        fontSize: 14,
    },
});
