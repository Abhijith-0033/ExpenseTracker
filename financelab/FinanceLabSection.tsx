/**
 * FinanceLabSection.tsx
 * 
 * The Finance Lab analytics section, appended to the bottom of the Analytics screen.
 * 
 * ABSOLUTE RULES:
 * - No modification to any existing analytics section
 * - Pure read-only analytics computed from existing SQLite data
 * - Works fully offline
 */

import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ActivityIndicator,
    TouchableOpacity, Dimensions
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { FlaskConical, RefreshCcw } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../constants/Theme';
import { formatCurrency } from '../utils/currency';
import { MetricCard } from './MetricCard';
import { MetricDetailModal } from './MetricDetailModal';
import { computeAllMetrics } from './FinanceLabEngine';

const screenWidth = Dimensions.get('window').width;

// ─── Metric Config ────────────────────────────────────────────────────────────

interface MetricConfig {
    key: string;
    icon: string;
    title: string;
    accentColor: string;
    getDisplayValue: (data: any) => string;
    getSubtitle: (data: any) => string | undefined;
    getStatus: (data: any) => string | undefined;
    getStatusColor: (data: any) => string | undefined;
    fullWidth?: boolean;
}

const METRIC_CONFIGS: MetricConfig[] = [
    {
        key: 'savingsRate',
        icon: '💰',
        title: 'Savings Rate',
        accentColor: Colors.success[500],
        getDisplayValue: (d) => `${d.rate}%`,
        getSubtitle: (d) => `Saved ${formatCurrency(d.saved)} this month`,
        getStatus: (d) => d.benchmark,
        getStatusColor: (d) => d.benchmarkColor,
    },
    {
        key: 'cashFlow',
        icon: '📊',
        title: 'Cash Flow',
        accentColor: Colors.primary[500],
        getDisplayValue: (d) => formatCurrency(d.currentNet),
        getSubtitle: (d) => `Avg ${formatCurrency(d.avgNet)} / month`,
        getStatus: (d) => d.status,
        getStatusColor: (d) => d.statusColor,
    },
    {
        key: 'burnRate',
        icon: '🔥',
        title: 'Burn Rate & Runway',
        accentColor: Colors.warning[500],
        getDisplayValue: (d) => formatCurrency(d.burnRate),
        getSubtitle: (d) => d.runway !== null ? `${d.runway} months runway` : 'No active burn',
        getStatus: (d) => d.status,
        getStatusColor: (d) => d.statusColor,
    },
    {
        key: 'emergencyFund',
        icon: '🛡️',
        title: 'Emergency Fund',
        accentColor: Colors.primary[600],
        getDisplayValue: (d) => `${d.coverageMonths}mo`,
        getSubtitle: (d) => `${formatCurrency(d.currentFund)} in accounts`,
        getStatus: (d) => d.status,
        getStatusColor: (d) => d.statusColor,
    },
    {
        key: 'dti',
        icon: '⚖️',
        title: 'Debt-to-Income',
        accentColor: Colors.danger[500],
        getDisplayValue: (d) => `${d.dti}%`,
        getSubtitle: (d) => `EMI ${formatCurrency(d.monthlyEMI)} / month`,
        getStatus: (d) => d.status,
        getStatusColor: (d) => d.statusColor,
    },
    {
        key: 'netWorth',
        icon: '🏦',
        title: 'Net Worth',
        accentColor: Colors.gray[800],
        getDisplayValue: (d) => formatCurrency(d.netWorth),
        getSubtitle: (d) => `Assets ${formatCurrency(d.totalAssets)}`,
        getStatus: (d) => d.isPositive ? 'Positive' : 'Negative',
        getStatusColor: (d) => d.isPositive ? '#12B76A' : '#F04438',
    },
    {
        key: 'rule503020',
        icon: '🎯',
        title: '50/30/20 Rule',
        accentColor: Colors.primary[500],
        getDisplayValue: (d) => `${d.adherenceScore}/100`,
        getSubtitle: (d) => `Needs ${d.needsPct}% · Wants ${d.wantsPct}%`,
        getStatus: (d) =>
            d.adherenceScore > 75 ? 'Good' : d.adherenceScore > 50 ? 'Fair' : 'Off-Track',
        getStatusColor: (d) =>
            d.adherenceScore > 75 ? '#12B76A' : d.adherenceScore > 50 ? '#F79009' : '#F04438',
    },
    {
        key: 'lifestyleInflation',
        icon: '📈',
        title: 'Lifestyle Inflation',
        accentColor: Colors.warning[600],
        getDisplayValue: (d) => `${d.drift > 0 ? '+' : ''}${d.drift}%`,
        getSubtitle: (d) => `Recent avg: ${formatCurrency(d.recentAvg)}/mo`,
        getStatus: (d) => d.status,
        getStatusColor: (d) => d.statusColor,
    },
    {
        key: 'freedomNumber',
        icon: '🦅',
        title: 'Freedom Number',
        accentColor: '#6941C6',
        getDisplayValue: (d) => formatCurrency(d.freedomNumber),
        getSubtitle: (d) => `${Math.round(d.progressToFreedom * 100)}% achieved`,
        getStatus: (d) =>
            d.progressToFreedom < 0.1 ? 'Starting' :
            d.progressToFreedom < 0.5 ? 'Building' :
            d.progressToFreedom < 1   ? 'Accelerating' : 'Achieved!',
        getStatusColor: (d) =>
            d.progressToFreedom < 0.1 ? '#F79009' :
            d.progressToFreedom < 0.5 ? '#0BA5EC' :
            d.progressToFreedom < 1   ? '#12B76A' : '#6941C6',
    },
    {
        key: 'subscriptionBurden',
        icon: '📱',
        title: 'Subscription Burden',
        accentColor: Colors.primary[700],
        getDisplayValue: (d) => formatCurrency(d.monthlySubCost),
        getSubtitle: (d) => `${d.burdenPct}% of income`,
        getStatus: (d) => d.status,
        getStatusColor: (d) => d.statusColor,
    },
    {
        key: 'savingsGoals',
        icon: '🎯',
        title: 'Savings Goals',
        accentColor: Colors.success[600],
        getDisplayValue: (d) => `${Math.round(d.overallProgress * 100)}%`,
        getSubtitle: (d) => `${formatCurrency(d.total_saved)} of ${formatCurrency(d.total_target)}`,
        getStatus: (d) =>
            d.goals?.length === 0 ? 'No Goals' :
            d.overallProgress >= 1 ? 'All Done! 🎉' : 'In Progress',
        getStatusColor: (d) =>
            d.goals?.length === 0 ? Colors.gray[400] :
            d.overallProgress >= 1 ? '#12B76A' : Colors.primary[500],
    },
    {
        key: 'incomeStability',
        icon: '📉',
        title: 'Income Stability',
        accentColor: Colors.success[500],
        getDisplayValue: (d) => `${d.stability}/100`,
        getSubtitle: (d) => `CV: ${d.cv}% variation`,
        getStatus: (d) => d.status,
        getStatusColor: (d) => d.statusColor,
    },
];

// ─── FinanceLabSection ────────────────────────────────────────────────────────

export const FinanceLabSection: React.FC = () => {
    const [metrics, setMetrics] = useState<Record<string, any> | null>(null);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [activeMetricKey, setActiveMetricKey] = useState<string | null>(null);
    const [activeMetricConfig, setActiveMetricConfig] = useState<MetricConfig | null>(null);

    const loadMetrics = useCallback(async () => {
        if (loading) return;
        setLoading(true);
        setError(null);
        try {
            const result = await computeAllMetrics();
            setMetrics(result);
            setLoaded(true);
        } catch (e: any) {
            setError(e?.message || 'Failed to compute metrics');
        } finally {
            setLoading(false);
        }
    }, [loading]);

    const handleCardPress = (config: MetricConfig) => {
        setActiveMetricKey(config.key);
        setActiveMetricConfig(config);
        setModalVisible(true);
    };

    // Lazy-load on first expand
    const handleExpand = () => {
        if (!loaded && !loading) {
            loadMetrics();
        }
    };

    const [expanded, setExpanded] = useState(false);

    const toggleExpand = () => {
        const next = !expanded;
        setExpanded(next);
        if (next && !loaded && !loading) {
            loadMetrics();
        }
    };

    return (
        <>
            <Animated.View entering={FadeInDown.delay(400).duration(700)}>
                {/* Section Header */}
                <LinearGradient
                    colors={['#1A1A2E', '#4A1D96']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerGradient}
                >
                    <View style={styles.headerLeft}>
                        <View style={styles.headerIconContainer}>
                            <FlaskConical size={20} color="white" />
                        </View>
                        <View>
                            <Text style={styles.headerTitle}>Finance Lab</Text>
                            <Text style={styles.headerSubtitle}>12 Intelligence Metrics</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.expandBtn}
                        onPress={toggleExpand}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.expandBtnText}>
                            {expanded ? 'Collapse ↑' : 'Explore ↓'}
                        </Text>
                    </TouchableOpacity>
                </LinearGradient>

                {/* Content */}
                {expanded && (
                    <View style={styles.content}>
                        {/* Loading state */}
                        {loading && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={Colors.primary[500]} />
                                <Text style={styles.loadingText}>Computing financial metrics…</Text>
                            </View>
                        )}

                        {/* Error state */}
                        {error && !loading && (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>⚠️ {error}</Text>
                                <TouchableOpacity onPress={loadMetrics} style={styles.retryBtn}>
                                    <RefreshCcw size={14} color={Colors.primary[600]} />
                                    <Text style={styles.retryBtnText}>Retry</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Metrics Grid */}
                        {metrics && !loading && (
                            <>
                                <View style={styles.refreshRow}>
                                    <Text style={styles.lastUpdatedText}>Computed from all your data</Text>
                                    <TouchableOpacity onPress={loadMetrics} style={styles.refreshBtn}>
                                        <RefreshCcw size={12} color={Colors.gray[500]} />
                                        <Text style={styles.refreshBtnText}>Refresh</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.grid}>
                                    {METRIC_CONFIGS.map((config, index) => {
                                        const data = metrics[config.key];
                                        if (!data || data.error) {
                                            return (
                                                <View
                                                    key={config.key}
                                                    style={[styles.errorCard, config.fullWidth && styles.fullWidthErrorCard]}
                                                >
                                                    <Text style={styles.errorCardIcon}>{config.icon}</Text>
                                                    <Text style={styles.errorCardTitle}>{config.title}</Text>
                                                    <Text style={styles.errorCardMsg}>
                                                        {data?.error ? 'Insufficient data' : 'Not computed'}
                                                    </Text>
                                                </View>
                                            );
                                        }

                                        return (
                                            <MetricCard
                                                key={config.key}
                                                icon={config.icon}
                                                title={config.title}
                                                value={config.getDisplayValue(data)}
                                                subtitle={config.getSubtitle(data)}
                                                status={config.getStatus(data)}
                                                statusColor={config.getStatusColor(data)}
                                                accentColor={config.accentColor}
                                                onPress={() => handleCardPress(config)}
                                                index={index}
                                                fullWidth={config.fullWidth}
                                            />
                                        );
                                    })}
                                </View>

                                {/* Disclaimer */}
                                <View style={styles.disclaimer}>
                                    <Text style={styles.disclaimerText}>
                                        🔒 All calculations are performed locally on-device using your own data. Nothing is sent to any server.
                                    </Text>
                                </View>
                            </>
                        )}
                    </View>
                )}
            </Animated.View>

            {/* Detail Modal */}
            <MetricDetailModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                metricKey={activeMetricKey}
                data={activeMetricKey && metrics ? metrics[activeMetricKey] : null}
                title={activeMetricConfig?.title || ''}
                icon={activeMetricConfig?.icon || ''}
                statusColor={
                    activeMetricConfig && metrics && metrics[activeMetricConfig.key] && !metrics[activeMetricConfig.key].error
                        ? activeMetricConfig.getStatusColor(metrics[activeMetricConfig.key]) || Colors.primary[500]
                        : Colors.primary[500]
                }
            />
        </>
    );
};

const styles = StyleSheet.create({
    headerGradient: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderRadius: Layout.radius.xl,
        marginBottom: 2,
        ...Layout.shadows.lg,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        color: 'white',
    },
    headerSubtitle: {
        fontSize: Typography.size.xs,
        color: 'rgba(255,255,255,0.65)',
        fontFamily: Typography.family.medium,
    },
    expandBtn: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    expandBtnText: {
        color: 'white',
        fontFamily: Typography.family.bold,
        fontSize: Typography.size.sm,
    },
    content: {
        backgroundColor: Colors.gray[50],
        borderRadius: Layout.radius.lg,
        borderWidth: 1,
        borderColor: Colors.gray[200],
        marginBottom: Layout.spacing.md,
        overflow: 'hidden',
    },
    // Loading
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: Colors.gray[500],
        fontFamily: Typography.family.medium,
        fontSize: Typography.size.sm,
    },
    // Error
    errorContainer: {
        padding: 24,
        alignItems: 'center',
    },
    errorText: {
        color: Colors.danger.text,
        fontFamily: Typography.family.medium,
        fontSize: Typography.size.sm,
        textAlign: 'center',
        marginBottom: 12,
    },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: Colors.primary[50],
        borderWidth: 1,
        borderColor: Colors.primary[200],
    },
    retryBtnText: {
        color: Colors.primary[600],
        fontFamily: Typography.family.bold,
        fontSize: Typography.size.sm,
    },
    // Refresh row
    refreshRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    lastUpdatedText: {
        fontSize: Typography.size.xs,
        color: Colors.gray[400],
        fontFamily: Typography.family.regular,
    },
    refreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    refreshBtnText: {
        fontSize: Typography.size.xs,
        color: Colors.gray[500],
        fontFamily: Typography.family.medium,
    },
    // Grid
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingTop: 8,
        gap: 0,
    },
    // Error card (metric failed)
    errorCard: {
        width: (screenWidth - 48 - 12) / 2,
        backgroundColor: Colors.gray[100],
        borderRadius: Layout.radius.md,
        padding: 16,
        marginBottom: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 120,
        borderWidth: 1,
        borderColor: Colors.gray[200],
        borderStyle: 'dashed',
    },
    fullWidthErrorCard: {
        width: '100%',
    },
    errorCardIcon: {
        fontSize: 24,
        marginBottom: 8,
        opacity: 0.4,
    },
    errorCardTitle: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
        color: Colors.gray[400],
        textAlign: 'center',
        marginBottom: 4,
    },
    errorCardMsg: {
        fontSize: 10,
        color: Colors.gray[300],
        textAlign: 'center',
    },
    // Disclaimer
    disclaimer: {
        margin: 12,
        padding: 12,
        backgroundColor: Colors.gray[100],
        borderRadius: Layout.radius.sm,
    },
    disclaimerText: {
        fontSize: 11,
        color: Colors.gray[500],
        textAlign: 'center',
        lineHeight: 16,
    },
});
