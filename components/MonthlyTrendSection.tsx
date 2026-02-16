import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { TrendLineChart } from './AnalysisCharts';
import { getMonthlyTrendInRange } from '../services/analysis';
import { Colors, Layout } from '../constants/Theme';
import { startOfMonth, subMonths, startOfYear, endOfMonth } from 'date-fns';
import { IconSymbol } from './ui/icon-symbol';

export const MonthlyTrendSection: React.FC = () => {
    const [range, setRange] = useState<'6M' | '12M' | 'YTD'>('6M');
    const [data, setData] = useState<{ month: string, total: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [comparison, setComparison] = useState<{ diff: number, percent: number, direction: 'up' | 'down' | 'same' } | null>(null);

    const loadData = async () => {
        setLoading(true);
        const now = new Date();
        let start: Date;

        if (range === '6M') {
            start = startOfMonth(subMonths(now, 5)); // Current + previous 5 = 6 months
        } else if (range === '12M') {
            start = startOfMonth(subMonths(now, 11));
        } else {
            start = startOfYear(now);
        }

        const end = endOfMonth(now);

        try {
            const trend = await getMonthlyTrendInRange(start, end);
            setData(trend);

            // Calculate comparison (Last month vs Previous month)
            if (trend.length >= 2) {
                const last = trend[trend.length - 1].total;
                const prev = trend[trend.length - 2].total;
                const diff = last - prev;
                const percent = prev !== 0 ? (Math.abs(diff) / prev) * 100 : 0;

                setComparison({
                    diff,
                    percent,
                    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same'
                });
            } else {
                setComparison(null);
            }

        } catch (e) {
            console.error("Failed to load monthly trend", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [range]);

    const renderComparison = () => {
        if (!comparison) return null;

        const color = comparison.direction === 'down' ? Colors.success[500] : comparison.direction === 'up' ? Colors.danger[500] : Colors.gray[500];
        const icon = comparison.direction === 'down' ? 'arrow.down' : comparison.direction === 'up' ? 'arrow.up' : 'minus';

        return (
            <View style={styles.comparisonContainer}>
                <IconSymbol name={icon as any} size={16} color={color} />
                <Text style={[styles.comparisonText, { color }]}>
                    {comparison.percent.toFixed(1)}% {comparison.direction === 'down' ? 'saved' : 'more'} vs last month
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Monthly Expense Trends</Text>
                    {renderComparison()}
                </View>
            </View>

            <View style={styles.toggles}>
                {(['6M', '12M', 'YTD'] as const).map(r => (
                    <TouchableOpacity
                        key={r}
                        style={[styles.toggle, range === r && styles.toggleActive]}
                        onPress={() => setRange(r)}
                    >
                        <Text style={[styles.toggleText, range === r && styles.toggleTextActive]}>
                            {r === 'YTD' ? 'This Year' : `Last ${r}`}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={Colors.primary[500]} />
                </View>
            ) : (
                <TrendLineChart data={data} type="monthly" />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.lg,
        padding: Layout.spacing.lg,
        marginBottom: Layout.spacing.lg,
        ...Layout.shadows.sm,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.gray[900],
        marginBottom: 4,
    },
    comparisonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    comparisonText: {
        fontSize: 12,
        fontWeight: '600',
    },
    toggles: {
        flexDirection: 'row',
        backgroundColor: Colors.gray[100],
        borderRadius: 8,
        padding: 4,
        marginBottom: 20,
        alignSelf: 'flex-start',
    },
    toggle: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    toggleActive: {
        backgroundColor: Colors.white,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    toggleText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.gray[500],
    },
    toggleTextActive: {
        color: Colors.gray[900],
    },
    loadingContainer: {
        height: 220,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
