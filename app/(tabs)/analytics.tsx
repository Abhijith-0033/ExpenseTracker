
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, StatusBar, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Colors, Layout, Typography } from '../../constants/Theme';
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
import { predictNextMonthExpenses, ForecastResult } from '../../services/ml';
import {
    TrendLineChart,
    ExpenseHistogram,
    CategoryDrillDown,
    MonthlyStackedBarChart,
    WeeklyBarChart,
    IncomeExpenseLineChart,
    getValueColor
} from '../../components/AnalysisCharts';
import { format, startOfMonth, addMonths, subMonths, isSameMonth, startOfDay, endOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Filter, Sparkles, TrendingUp, Info, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatCurrency } from '../../utils/currency';
import { CategoryBreakdownList } from '../../components/CategoryBreakdownList';
import { MonthlyTrendSection } from '../../components/MonthlyTrendSection';

const screenWidth = Dimensions.get('window').width;



export default function AnalyticsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [loadingSubcats, setLoadingSubcats] = useState(false);
    const [viewMode, setViewMode] = useState<'month' | 'all' | 'custom'>('month');
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [customRange, setCustomRange] = useState({
        start: startOfMonth(new Date()),
        end: new Date()
    });
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

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
    const [forecast, setForecast] = useState<ForecastResult | null>(null);

    const [activeChart, setActiveChart] = useState<'trend' | 'distribution' | 'stacked'>('trend');
    const [showForecastModal, setShowForecastModal] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            // v2.0.0: Flexible date filter
            let dateFilter: Date | { start: Date, end: Date } | undefined;
            
            if (viewMode === 'month') {
                dateFilter = selectedMonth;
            } else if (viewMode === 'custom') {
                dateFilter = customRange;
            } else {
                dateFilter = undefined; // All time
            }

            // 1. Fetch Totals
            const cats = await getCategoryTotals(dateFilter);
            setCategoryTotals(cats);

            // 2. Fetch specific chart data
            const dailyAnchor = viewMode === 'custom' ? customRange.start : selectedMonth;
            const daily = await getDailySpendingTrend(dailyAnchor);
            setDailyTrend(daily);

            const weekly = await getWeeklySpendingTrend(dailyAnchor);
            setWeeklyTrend(weekly);

            const monthly = await getMonthlySpendingTrend(dailyAnchor.getFullYear());
            setMonthlyTrend(monthly);

            const dist = await getExpenseDistribution(dateFilter);
            setDistribution(dist);

            const stacked = await getMonthlyCategoryTrend(dailyAnchor.getFullYear());
            setStackedData(stacked);

            const comparison = await getMonthlyIncomeVsExpense(dailyAnchor.getFullYear());
            setComparisonData(comparison);

            // 3. Fetch Forecast
            const fcast = await predictNextMonthExpenses();
            setForecast(fcast);

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
        }, [viewMode, selectedMonth, customRange])
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
                        <Text style={[styles.toggleText, viewMode === 'month' && styles.toggleTextActive]}>Month</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, viewMode === 'custom' && styles.toggleBtnActive]}
                        onPress={() => setViewMode('custom')}
                    >
                        <Text style={[styles.toggleText, viewMode === 'custom' && styles.toggleTextActive]}>Custom</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, viewMode === 'all' && styles.toggleBtnActive]}
                        onPress={() => setViewMode('all')}
                    >
                        <Text style={[styles.toggleText, viewMode === 'all' && styles.toggleTextActive]}>All</Text>
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

                {viewMode === 'custom' && (
                    <View style={styles.customRangeSelector}>
                        <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.rangePart}>
                            <Text style={styles.rangeText}>{format(customRange.start, 'MMM dd')}</Text>
                        </TouchableOpacity>
                        <Text style={styles.rangeDivider}>-</Text>
                        <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.rangePart}>
                            <Text style={styles.rangeText}>{format(customRange.end, 'MMM dd')}</Text>
                        </TouchableOpacity>
                        <Filter size={14} color={Colors.primary[600]} style={{ marginLeft: 6 }} />
                    </View>
                )}
            </View>

            {showStartPicker && (
                <DateTimePicker
                    value={customRange.start}
                    mode="date"
                    onChange={(e, date) => {
                        setShowStartPicker(false);
                        if (date) setCustomRange(prev => ({ ...prev, start: date }));
                    }}
                />
            )}
            {showEndPicker && (
                <DateTimePicker
                    value={customRange.end}
                    mode="date"
                    onChange={(e, date) => {
                        setShowEndPicker(false);
                        if (date) setCustomRange(prev => ({ ...prev, end: date }));
                    }}
                />
            )}
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
                    {viewMode === 'month' ? `Total Expense (${format(selectedMonth, 'MMM yyyy')})` : 
                     viewMode === 'custom' ? `Total (${format(customRange.start, 'MMM dd')} - ${format(customRange.end, 'MMM dd')})` :
                     'All Time Total Expense'}
                </Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalExpense)}</Text>
            </Card>

            {/* Premium Forecast Section */}
            {forecast && viewMode === 'month' && (
                <Animated.View entering={FadeInDown.delay(200).duration(800)}>
                    <TouchableOpacity activeOpacity={0.9} onPress={() => setShowForecastModal(true)}>
                    <LinearGradient
                        colors={[Colors.primary[500], Colors.accent.peach]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.forecastCard}
                    >
                        <View style={styles.forecastHeader}>
                            <View style={styles.sparkleContainer}>
                                <Sparkles size={16} color="white" />
                            </View>
                            <Text style={styles.forecastTitle}>AI Forecast</Text>
                            <View style={styles.confidenceBadge}>
                                <Text style={styles.confidenceText}>{forecast.confidence.toUpperCase()} CONFIDENCE</Text>
                            </View>
                        </View>
                        
                        <View style={styles.forecastMain}>
                            <View>
                                <Text style={styles.forecastLabel}>Predicted for {forecast.nextMonthName}</Text>
                                <Text style={styles.forecastAmount}>{formatCurrency(forecast.predictedTotal)}</Text>
                            </View>
                            <TrendingUp size={32} color="rgba(255,255,255,0.3)" />
                        </View>

                        <View style={styles.forecastDivider} />
                        
                        <Text style={styles.forecastBreakdownTitle}>Top Expected Categories:</Text>
                        <View style={styles.forecastCats}>
                            {forecast.topCategories.map((c: any, i: number) => (
                                <View key={i} style={styles.forecastCatRow}>
                                    <Text style={styles.forecastCatName}>{c.category}</Text>
                                    <Text style={styles.forecastCatAmount}>{formatCurrency(c.predicted)}</Text>
                                </View>
                            ))}
                        </View>
                    </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>
            )}

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

            <View style={{ height: 80 }} />

            {/* Forecast Modal */}
            <Modal visible={showForecastModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>AI Forecast Analysis</Text>
                            <TouchableOpacity onPress={() => setShowForecastModal(false)}>
                                <X size={24} color={Colors.gray[500]} />
                            </TouchableOpacity>
                        </View>
                        
                        {forecast && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.forecastModalTop}>
                                    <Text style={styles.forecastModalLabel}>Predicted for {forecast.nextMonthName}</Text>
                                    <Text style={styles.forecastModalAmount}>{formatCurrency(forecast.predictedTotal)}</Text>
                                    <View style={[styles.confidenceBadge, { alignSelf: 'flex-start', marginTop: 8, backgroundColor: Colors.primary[100] }]}>
                                        <Text style={[styles.confidenceText, { color: Colors.primary[700] }]}>{forecast.confidence.toUpperCase()} CONFIDENCE</Text>
                                    </View>
                                </View>

                                <View style={styles.forecastModalSection}>
                                    <Text style={styles.forecastModalSectionTitle}>Historical Trend</Text>
                                    <Text style={styles.chartSubtitle}>Past months vs prediction</Text>
                                    <View style={{ alignItems: 'center', marginVertical: 10 }}>
                                        <TrendLineChart 
                                            data={monthlyTrend} 
                                            type="monthly" 
                                            width={screenWidth - 100} 
                                            predictedData={{ total: forecast.predictedTotal, label: forecast.nextMonthName.substring(0, 3) }}
                                        />
                                    </View>
                                </View>

                                <View style={styles.forecastModalSection}>
                                    <Text style={styles.forecastModalSectionTitle}>Expected Categories</Text>
                                    {forecast.topCategories.map((c: any, i: number) => (
                                        <View key={i} style={styles.forecastModalCatRow}>
                                            <View style={styles.forecastModalCatLeft}>
                                                <View style={[styles.catColorDot, { backgroundColor: getValueColor(i) }]} />
                                                <Text style={styles.forecastModalCatName}>{c.category}</Text>
                                            </View>
                                            <Text style={styles.forecastModalCatAmount}>{formatCurrency(c.predicted)}</Text>
                                        </View>
                                    ))}
                                </View>
                                
                                <View style={styles.forecastModalInfo}>
                                    <Info size={16} color={Colors.gray[500]} style={{ marginTop: 2 }} />
                                    <Text style={styles.forecastModalInfoText}>
                                        Predictions are based on your past spending habits. The more you use the app, the better the AI gets.
                                    </Text>
                                </View>
                                
                                <View style={{ height: 40 }} />
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
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
        fontSize: Typography.size.xxxl,
        fontFamily: Typography.family.bold,
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
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
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
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        color: Colors.gray[800],
        marginHorizontal: 8,
        minWidth: 70,
        textAlign: 'center',
    },
    customRangeSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.gray[200],
    },
    rangePart: {
        paddingHorizontal: 4,
    },
    rangeText: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.primary[600],
    },
    rangeDivider: {
        fontSize: 13,
        color: Colors.gray[400],
        marginHorizontal: 2,
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
        fontSize: Typography.size.xxxl,
        fontFamily: Typography.family.bold,
        color: Colors.primary[900],
    },
    sectionContainer: {
        marginBottom: Layout.spacing.lg,
    },
    sectionTitle: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
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
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
        color: Colors.gray[500],
    },
    activeTabText: {
        color: Colors.primary[600],
    },
    chartContent: {
        alignItems: 'center',
    },
    chartSubtitle: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.regular,
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
        fontFamily: Typography.family.bold,
        fontSize: Typography.size.sm,
    },
    // Forecast Styles
    forecastCard: {
        padding: 20,
        borderRadius: 24,
        marginBottom: Layout.spacing.lg,
        ...Layout.shadows.md,
    },
    forecastHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    sparkleContainer: {
        padding: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 8,
        marginRight: 10,
    },
    forecastTitle: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: 'white',
        flex: 1,
    },
    confidenceBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    confidenceText: {
        fontSize: 9,
        fontWeight: '900',
        color: 'white',
    },
    forecastMain: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    forecastLabel: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '600',
    },
    forecastAmount: {
        fontSize: Typography.size.xxxl,
        fontFamily: Typography.family.bold,
        color: 'white',
    },
    forecastDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.15)',
        marginBottom: 16,
    },
    forecastBreakdownTitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 10,
        letterSpacing: 0.5,
    },
    forecastCats: {
        gap: 8,
    },
    forecastCatRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    forecastCatName: {
        fontSize: 14,
        color: 'white',
        fontWeight: '600',
    },
    forecastCatAmount: {
        fontSize: 14,
        color: 'white',
        fontWeight: '700',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: Typography.size.xl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    forecastModalTop: {
        backgroundColor: Colors.primary[50],
        padding: 20,
        borderRadius: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: Colors.primary[100],
    },
    forecastModalLabel: {
        fontSize: 14,
        color: Colors.primary[700],
        fontWeight: '600',
        marginBottom: 4,
    },
    forecastModalAmount: {
        fontSize: Typography.size.display,
        fontFamily: Typography.family.bold,
        color: Colors.primary[900],
    },
    forecastModalSection: {
        marginBottom: 24,
    },
    forecastModalSectionTitle: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        marginBottom: 16,
    },
    forecastModalCatRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[100],
    },
    forecastModalCatLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    catColorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    forecastModalCatName: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.gray[800],
    },
    forecastModalCatAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.gray[900],
    },
    forecastModalInfo: {
        flexDirection: 'row',
        backgroundColor: Colors.gray[50],
        padding: 16,
        borderRadius: 16,
        alignItems: 'flex-start',
        gap: 12,
    },
    forecastModalInfoText: {
        flex: 1,
        fontSize: 13,
        color: Colors.gray[600],
        lineHeight: 20,
    },
});
