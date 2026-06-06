import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, PieChart, ArrowUpRight, ShoppingBag, Coffee, Car, Home, Film, CalendarRange, TrendingUp, Hash, Zap } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../constants/Theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-gifted-charts';
import { getCategories, CategoryNode, Transaction } from '../services/database';
import { getCategoryTransactions, getCategoryMonthlyTotals, getCategoryStats, getSubcategoryBreakdown } from '../services/categoryDetailQueries';
import { getMergedClassifications } from '../satisfaction/categoryClassification';
import { formatCurrency } from '../utils/currency';
import { startOfMonth, subMonths, startOfYear, format, parseISO } from 'date-fns';
import { TransactionList } from '../components/TransactionList';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Period = 'Last 6M' | 'This Year' | 'All Time';

export default function CategoryDetailScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const initialCategoryName = params.category_name as string || null;

    const [categories, setCategories] = useState<CategoryNode[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategoryName);
    const [period, setPeriod] = useState<Period>('Last 6M');

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [subcategoryBreakdown, setSubcategoryBreakdown] = useState<any[]>([]);
    const [classifications, setClassifications] = useState<Record<string, string>>({});

    useEffect(() => {
        loadBaseData();
    }, []);

    useEffect(() => {
        if (categories.length > 0 && selectedCategory === null && !initialCategoryName) {
            // Default to first expense category
            const first = categories.find(c => c.name !== 'Income' && c.name !== 'Transfer');
            if (first) setSelectedCategory(first.name);
        }
    }, [categories]);

    useEffect(() => {
        if (selectedCategory !== null) {
            loadCategoryData();
        }
    }, [selectedCategory, period]);

    const loadBaseData = async () => {
        const [cats, classMap] = await Promise.all([
            getCategories(),
            getMergedClassifications()
        ]);
        setCategories(cats.filter(c => c.name !== 'Income' && c.name !== 'Transfer'));
        setClassifications(classMap);
    };

    const getDateRange = () => {
        const end = new Date();
        let start = new Date(0); // All time

        if (period === 'Last 6M') {
            start = subMonths(startOfMonth(new Date()), 5); // Current + 5 previous
        } else if (period === 'This Year') {
            start = startOfYear(new Date());
        }
        return { start, end };
    };

    const loadCategoryData = async () => {
        if (!selectedCategory) return;
        
        const { start, end } = getDateRange();
        const [txs, monthly, st, subBreakdown] = await Promise.all([
            getCategoryTransactions(selectedCategory, start, end),
            getCategoryMonthlyTotals(selectedCategory, start, end),
            getCategoryStats(selectedCategory),
            getSubcategoryBreakdown(selectedCategory)
        ]);

        setTransactions(txs);
        setStats(st);
        setSubcategoryBreakdown(subBreakdown);
        
        // Format chart data for BarChart
        if (monthly.length > 0) {
            const formatted = monthly.map(m => {
                const d = parseISO(m.month + '-01');
                return {
                    value: m.total,
                    label: format(d, 'MMM'),
                    frontColor: Colors.primary[500],
                    topLabelComponent: () => (
                        <Text style={{color: Colors.gray[500], fontSize: 10, marginBottom: 4}}>
                            {m.total > 1000 ? (m.total/1000).toFixed(1)+'k' : m.total}
                        </Text>
                    )
                };
            });
            setChartData(formatted);
        } else {
            setChartData([{ value: 0, label: '' }]);
        }
    };

    const getIcon = (catName: string) => {
        switch (catName) {
            case 'Food': return <Coffee size={24} color={Colors.warning[600]} />;
            case 'Transport': return <Car size={24} color={Colors.primary[600]} />;
            case 'Housing': return <Home size={24} color={Colors.success[600]} />;
            case 'Entertainment': return <Film size={24} color={Colors.danger[600]} />;
            case 'Shopping': return <ShoppingBag size={24} color={Colors.primary[800]} />;
            default: return <PieChart size={24} color={Colors.primary[600]} />;
        }
    };

    const getIconBg = (catName: string) => {
        switch (catName) {
            case 'Food': return Colors.warning[100];
            case 'Transport': return Colors.primary[100];
            case 'Housing': return Colors.success[100];
            case 'Entertainment': return Colors.danger[100];
            case 'Shopping': return Colors.primary[200];
            default: return Colors.primary[50];
        }
    };

    const periods: Period[] = ['Last 6M', 'This Year', 'All Time'];
    const classification = selectedCategory ? classifications[selectedCategory] : 'unknown';
    const isEssential = classification === 'essential';

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                    <ArrowLeft size={24} color={Colors.gray[900]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Category Insights</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Category Picker (if no initial param) */}
            {!initialCategoryName && categories.length > 0 && (
                <View style={styles.pickerContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerScroll}>
                        {categories.map(cat => (
                            <TouchableOpacity
                                key={cat.id}
                                style={[styles.pickerItem, selectedCategory === cat.name && styles.pickerItemActive]}
                                onPress={() => setSelectedCategory(cat.name)}
                            >
                                <Text style={[styles.pickerItemText, selectedCategory === cat.name && styles.pickerItemTextActive]}>
                                    {cat.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                
                {/* Hero Card */}
                {selectedCategory && stats && (
                    <View style={[styles.heroCard, { backgroundColor: getIconBg(selectedCategory) }]}>
                        <View style={styles.heroTop}>
                            <View style={[styles.heroIconBox, { backgroundColor: Colors.white }]}>
                                {getIcon(selectedCategory)}
                            </View>
                            <View style={[styles.badge, { backgroundColor: isEssential ? Colors.success[100] : Colors.gray[200] }]}>
                                <Text style={[styles.badgeText, { color: isEssential ? Colors.success[700] : Colors.gray[600] }]}>
                                    {isEssential ? 'ESSENTIAL' : 'NON-ESSENTIAL'}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.heroCategoryName}>{selectedCategory}</Text>
                        
                        <View style={styles.heroStatsRow}>
                            <View style={styles.heroStat}>
                                <Text style={styles.heroStatLabel}>This Month</Text>
                                <Text style={styles.heroStatValue}>{formatCurrency(stats.totalThisMonth)}</Text>
                            </View>
                            <View style={styles.heroStatDivider} />
                            <View style={styles.heroStat}>
                                <Text style={styles.heroStatLabel}>Monthly Avg</Text>
                                <Text style={styles.heroStatValue}>{formatCurrency(stats.monthlyAvg)}</Text>
                            </View>
                            <View style={styles.heroStatDivider} />
                            <View style={styles.heroStat}>
                                <Text style={styles.heroStatLabel}>Grand Total</Text>
                                <Text style={styles.heroStatValue}>{formatCurrency(stats.totalAllTime)}</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Period Filter */}
                <View style={styles.filterContainer}>
                    {periods.map(p => (
                        <TouchableOpacity
                            key={p}
                            style={[styles.filterBtn, period === p && styles.filterBtnActive]}
                            onPress={() => setPeriod(p)}
                        >
                            <Text style={[styles.filterText, period === p && styles.filterTextActive]}>{p}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Chart Section */}
                <View style={styles.chartCard}>
                    <Text style={styles.sectionTitle}>Spending Trend</Text>
                    <View style={{ marginTop: 20, alignItems: 'center' }}>
                        <BarChart
                            data={chartData}
                            width={SCREEN_WIDTH - 100}
                            height={180}
                            barWidth={28}
                            spacing={24}
                            initialSpacing={10}
                            roundedTop
                            hideRules
                            xAxisThickness={1}
                            yAxisThickness={0}
                            yAxisTextStyle={{ color: Colors.gray[400], fontSize: 10 }}
                            xAxisLabelTextStyle={{ color: Colors.gray[500], fontSize: 12, fontFamily: Typography.family.medium }}
                            xAxisColor={Colors.gray[200]}
                            noOfSections={4}
                            isAnimated
                        />
                    </View>
                </View>

                {/* Insights Row */}
                {stats && (
                    <View style={styles.insightsGrid}>
                        <View style={styles.insightCard}>
                            <View style={[styles.insightIcon, { backgroundColor: Colors.warning[50] }]}>
                                <Zap size={18} color={Colors.warning[600]} />
                            </View>
                            <Text style={styles.insightLabel}>Highest Month</Text>
                            <Text style={styles.insightValue} numberOfLines={1}>
                                {stats.highestMonth.month ? format(parseISO(stats.highestMonth.month + '-01'), 'MMM yyyy') : 'N/A'}
                            </Text>
                            <Text style={styles.insightSub}>{formatCurrency(stats.highestMonth.total)}</Text>
                        </View>
                        <View style={styles.insightCard}>
                            <View style={[styles.insightIcon, { backgroundColor: Colors.primary[50] }]}>
                                <TrendingUp size={18} color={Colors.primary[600]} />
                            </View>
                            <Text style={styles.insightLabel}>Avg per Tx</Text>
                            <Text style={styles.insightValue}>{formatCurrency(stats.avgPerTx)}</Text>
                            <Text style={styles.insightSub}>all time</Text>
                        </View>
                        <View style={styles.insightCard}>
                            <View style={[styles.insightIcon, { backgroundColor: Colors.success[50] }]}>
                                <Hash size={18} color={Colors.success[600]} />
                            </View>
                            <Text style={styles.insightLabel}>Frequency</Text>
                            <Text style={styles.insightValue}>{stats.freqThisMonth}</Text>
                            <Text style={styles.insightSub}>this month</Text>
                        </View>
                    </View>
                )}

                {/* Subcategory Breakdown */}
                {subcategoryBreakdown.length > 0 && (
                    <View style={styles.chartCard}>
                        <Text style={styles.sectionTitle}>Subcategory Breakdown</Text>
                        <View style={{ marginTop: 16 }}>
                            {subcategoryBreakdown.map((sub, index) => (
                                <View key={sub.name} style={[
                                    styles.subRow, 
                                    index !== subcategoryBreakdown.length - 1 && styles.subRowBorder
                                ]}>
                                    <View style={styles.subLeft}>
                                        <Text style={styles.subName}>{sub.name || 'Uncategorized'}</Text>
                                        <Text style={styles.subMonthlyLabel}>This Month</Text>
                                    </View>
                                    <View style={styles.subRight}>
                                        <Text style={styles.subGrandTotal}>{formatCurrency(sub.grandTotal)}</Text>
                                        <Text style={styles.subMonthlyTotal}>{formatCurrency(sub.monthlyTotal)}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Transactions List */}
                <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>Category Transactions</Text>
                {transactions.length > 0 ? (
                    <TransactionList 
                        transactions={transactions} 
                        scrollEnabled={false} 
                        showTitle={false} 
                        limit={0} // show all in period
                    />
                ) : (
                    <View style={styles.emptyState}>
                        <CalendarRange size={48} color={Colors.gray[300]} />
                        <Text style={styles.emptyText}>No transactions found.</Text>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.gray[50],
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    iconBtn: {
        padding: 8,
        backgroundColor: Colors.white,
        borderRadius: 12,
        ...Layout.shadows.sm,
    },
    headerTitle: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    pickerContainer: {
        marginBottom: 16,
    },
    pickerScroll: {
        paddingHorizontal: 20,
        gap: 12,
    },
    pickerItem: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.gray[200],
    },
    pickerItemActive: {
        backgroundColor: Colors.gray[900],
        borderColor: Colors.gray[900],
    },
    pickerItemText: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        color: Colors.gray[600],
    },
    pickerItemTextActive: {
        color: Colors.white,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    heroCard: {
        padding: 24,
        borderRadius: 24,
        marginBottom: 24,
        ...Layout.shadows.sm,
    },
    heroTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    heroIconBox: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        ...Layout.shadows.sm,
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
    },
    heroCategoryName: {
        fontSize: Typography.size.xxl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        marginBottom: 24,
    },
    heroStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.6)',
        borderRadius: 16,
        padding: 16,
    },
    heroStat: {
        flex: 1,
    },
    heroStatLabel: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.medium,
        color: Colors.gray[600],
        marginBottom: 4,
    },
    heroStatValue: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    heroStatDivider: {
        width: 1,
        height: '100%',
        backgroundColor: Colors.gray[300],
        marginHorizontal: 16,
    },
    filterContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.gray[200],
        borderRadius: 12,
        padding: 4,
        marginBottom: 24,
    },
    filterBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    filterBtnActive: {
        backgroundColor: Colors.white,
        ...Layout.shadows.sm,
    },
    filterText: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
        color: Colors.gray[500],
    },
    filterTextActive: {
        color: Colors.gray[900],
    },
    chartCard: {
        backgroundColor: Colors.white,
        borderRadius: 24,
        padding: 20,
        marginBottom: 24,
        ...Layout.shadows.sm,
    },
    sectionTitle: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    insightsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 32,
    },
    insightCard: {
        flex: 1,
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: 12,
        ...Layout.shadows.sm,
    },
    insightIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    insightLabel: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.medium,
        color: Colors.gray[500],
        marginBottom: 4,
    },
    insightValue: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    insightSub: {
        fontSize: 10,
        fontFamily: Typography.family.medium,
        color: Colors.gray[400],
        marginTop: 2,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        backgroundColor: Colors.white,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.gray[100],
        borderStyle: 'dashed',
    },
    emptyText: {
        marginTop: 12,
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.medium,
        color: Colors.gray[500],
    },
    subRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    subRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[100],
    },
    subLeft: {
        flex: 1,
    },
    subName: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        marginBottom: 2,
    },
    subMonthlyLabel: {
        fontSize: 10,
        color: Colors.gray[500],
        fontFamily: Typography.family.medium,
    },
    subRight: {
        alignItems: 'flex-end',
    },
    subGrandTotal: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    subMonthlyTotal: {
        fontSize: 12,
        color: Colors.primary[600],
        fontFamily: Typography.family.bold,
        marginTop: 2,
    },
});
