import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, TrendingUp, Briefcase, Gift, DollarSign, Home, Globe, User } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../constants/Theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { getIncomeBySource, getIncomeMonthlyTrend, getIncomeTransactions } from '../services/incomeBreakdownQueries';
import { formatCurrency } from '../utils/currency';
import { startOfMonth, subMonths, startOfYear, format, parseISO } from 'date-fns';
import { TransactionList } from '../components/TransactionList';
import { Transaction } from '../services/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Period = 'This Month' | 'Last 6M' | 'This Year' | 'All Time';

const getSourceColor = (source: string, index: number) => {
    const palette = [
        Colors.success[500],
        Colors.primary[500],
        Colors.warning[500],
        '#8B5CF6', // Purple
        Colors.danger[400],
        '#06B6D4', // Cyan
        '#F43F5E'  // Rose
    ];
    return palette[index % palette.length];
};

const getSourceIcon = (source: string) => {
    switch (source) {
        case 'Salary': return <Briefcase size={20} color={Colors.white} />;
        case 'Freelance': return <Globe size={20} color={Colors.white} />;
        case 'Investment': return <TrendingUp size={20} color={Colors.white} />;
        case 'Gift': return <Gift size={20} color={Colors.white} />;
        case 'Business': return <Home size={20} color={Colors.white} />;
        case 'Other': return <User size={20} color={Colors.white} />;
        default: return <DollarSign size={20} color={Colors.white} />;
    }
};

export default function IncomeBreakdownScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [period, setPeriod] = useState<Period>('This Month');
    
    const [sourcesData, setSourcesData] = useState<{source: string, total: number, color: string, percentage: number}[]>([]);
    const [trendData, setTrendData] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [selectedSource, setSelectedSource] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [period, selectedSource]);

    const getDateRange = () => {
        const end = new Date();
        let start = new Date(0); // All time

        if (period === 'This Month') {
            start = startOfMonth(new Date());
        } else if (period === 'Last 6M') {
            start = subMonths(startOfMonth(new Date()), 5); // Current + 5 previous
        } else if (period === 'This Year') {
            start = startOfYear(new Date());
        }
        return { start, end };
    };

    const loadData = async () => {
        const { start, end } = getDateRange();
        
        const [sources, trend, txs] = await Promise.all([
            getIncomeBySource(start, end),
            getIncomeMonthlyTrend(start, end),
            getIncomeTransactions(selectedSource, start, end)
        ]);

        const totalIncome = sources.reduce((sum, s) => sum + s.total, 0);
        
        const mappedSources = sources.map((s, idx) => ({
            ...s,
            color: getSourceColor(s.source, idx),
            percentage: totalIncome > 0 ? (s.total / totalIncome) * 100 : 0
        }));

        setSourcesData(mappedSources);
        
        if (trend.length > 0) {
            const formattedTrend = trend.map(m => {
                const d = parseISO(m.month + '-01');
                return {
                    value: m.total,
                    label: format(d, 'MMM'),
                    frontColor: Colors.success[400],
                    topLabelComponent: () => (
                        <Text style={{color: Colors.gray[500], fontSize: 10, marginBottom: 4}}>
                            {m.total > 1000 ? (m.total/1000).toFixed(1)+'k' : m.total}
                        </Text>
                    )
                };
            });
            setTrendData(formattedTrend);
        } else {
            setTrendData([{ value: 0, label: '' }]);
        }

        setTransactions(txs);
    };

    const totalIncome = sourcesData.reduce((sum, s) => sum + s.total, 0);
    const topSource = sourcesData.length > 0 ? sourcesData[0] : null;

    const periods: Period[] = ['This Month', 'Last 6M', 'This Year', 'All Time'];

    const pieData = sourcesData.map(s => ({
        value: s.total,
        color: s.color,
        text: `${Math.round(s.percentage)}%`,
        textColor: Colors.white,
        fontWeight: 'bold',
    }));

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                    <ArrowLeft size={24} color={Colors.gray[900]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Income Breakdown</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Period Filter */}
            <View style={{ paddingHorizontal: 20 }}>
                <View style={styles.filterContainer}>
                    {periods.map(p => (
                        <TouchableOpacity
                            key={p}
                            style={[styles.filterBtn, period === p && styles.filterBtnActive]}
                            onPress={() => {
                                setPeriod(p);
                                setSelectedSource(null); // Reset filter
                            }}
                        >
                            <Text style={[styles.filterText, period === p && styles.filterTextActive]}>{p}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                
                {/* Hero Card */}
                <View style={[styles.heroCard, { backgroundColor: Colors.success.bg }]}>
                    <View style={styles.heroTop}>
                        <View style={[styles.heroIconBox, { backgroundColor: Colors.success[100] }]}>
                            <TrendingUp size={24} color={Colors.success[600]} />
                        </View>
                        {topSource && (
                            <View style={[styles.badge, { backgroundColor: topSource.color + '20' }]}>
                                <Text style={[styles.badgeText, { color: topSource.color }]}>Top: {topSource.source}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.heroLabel}>Total Income</Text>
                    <Text style={[styles.heroValue, { color: Colors.success[700] }]}>{formatCurrency(totalIncome)}</Text>
                </View>

                {/* Pie Chart Section */}
                <View style={styles.chartCard}>
                    <Text style={styles.sectionTitle}>Income Sources</Text>
                    
                    {totalIncome > 0 ? (
                        <View style={styles.pieContainer}>
                            <PieChart
                                data={pieData}
                                donut
                                radius={80}
                                innerRadius={50}
                                showText
                                textSize={10}
                                showTextBackground
                                textBackgroundColor="rgba(0,0,0,0.4)"
                                textBackgroundRadius={10}
                                innerCircleColor={Colors.white}
                                centerLabelComponent={() => (
                                    <View style={{justifyContent: 'center', alignItems: 'center'}}>
                                        <Text style={{fontSize: 18, color: Colors.gray[900], fontWeight: 'bold'}}>
                                            {sourcesData.length}
                                        </Text>
                                        <Text style={{fontSize: 10, color: Colors.gray[500]}}>Sources</Text>
                                    </View>
                                )}
                            />
                            
                            <View style={styles.legendContainer}>
                                {sourcesData.map((s) => (
                                    <TouchableOpacity 
                                        key={s.source} 
                                        style={[styles.legendItem, selectedSource === s.source && styles.legendItemActive]}
                                        onPress={() => setSelectedSource(selectedSource === s.source ? null : s.source)}
                                    >
                                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                            <View style={[styles.legendIconBox, {backgroundColor: s.color}]}>
                                                {getSourceIcon(s.source)}
                                            </View>
                                            <View>
                                                <Text style={styles.legendLabel}>{s.source}</Text>
                                                <Text style={styles.legendPercent}>{s.percentage.toFixed(1)}%</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.legendValue}>{formatCurrency(s.total)}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <View style={styles.emptyChart}>
                            <Text style={styles.emptyText}>No income recorded in this period.</Text>
                        </View>
                    )}
                </View>

                {/* Trend Chart (only show for ranges > 1 month) */}
                {period !== 'This Month' && (
                    <View style={styles.chartCard}>
                        <Text style={styles.sectionTitle}>Monthly Trend</Text>
                        <View style={{ marginTop: 20, alignItems: 'center' }}>
                            <BarChart
                                data={trendData}
                                width={SCREEN_WIDTH - 100}
                                height={160}
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
                                isAnimated
                            />
                        </View>
                    </View>
                )}

                {/* Transactions List */}
                <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>
                    {selectedSource ? `${selectedSource} Transactions` : 'All Income Transactions'}
                </Text>
                {transactions.length > 0 ? (
                    <TransactionList 
                        transactions={transactions} 
                        scrollEnabled={false} 
                        showTitle={false} 
                        limit={0} 
                    />
                ) : (
                    <View style={styles.emptyState}>
                        <TrendingUp size={48} color={Colors.gray[300]} />
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
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    heroCard: {
        padding: 24,
        borderRadius: 24,
        marginBottom: 24,
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
    heroLabel: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.medium,
        color: Colors.success[700],
        opacity: 0.8,
        marginBottom: 4,
    },
    heroValue: {
        fontSize: Typography.size.xxxl,
        fontFamily: Typography.family.bold,
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
    pieContainer: {
        marginTop: 20,
        alignItems: 'center',
    },
    legendContainer: {
        width: '100%',
        marginTop: 24,
        gap: 12,
    },
    legendItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: Colors.gray[50],
    },
    legendItemActive: {
        backgroundColor: Colors.primary[50],
        borderWidth: 1,
        borderColor: Colors.primary[200],
    },
    legendIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    legendLabel: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    legendPercent: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.medium,
        color: Colors.gray[500],
    },
    legendValue: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    emptyChart: {
        height: 160,
        justifyContent: 'center',
        alignItems: 'center',
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
});
