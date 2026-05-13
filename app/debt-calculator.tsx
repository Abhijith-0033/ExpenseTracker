import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, TextInput, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calculator, CalendarCheck, AlertTriangle } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../constants/Theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { formatCurrency } from '../utils/currency';
import { addMonths, format } from 'date-fns';
import { getDebtSummary } from '../services/debts';
import { LineChart } from 'react-native-gifted-charts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DebtCalculatorScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [debtAmount, setDebtAmount] = useState('');
    const [interestRate, setInterestRate] = useState('5.0');
    const [monthlyPayment, setMonthlyPayment] = useState('');

    useEffect(() => {
        loadInitialDebt();
    }, []);

    const loadInitialDebt = async () => {
        const summary = await getDebtSummary();
        if (summary.totalDebt > 0) {
            setDebtAmount(summary.totalDebt.toString());
        }
    };

    const calcResult = useMemo(() => {
        const p = parseFloat(debtAmount) || 0;
        const rateYearly = parseFloat(interestRate) || 0;
        const a = parseFloat(monthlyPayment) || 0;

        if (p <= 0 || a <= 0) return null;

        const r = rateYearly / 12 / 100;
        
        // Check if payment covers interest
        if (r > 0 && a <= r * p) {
            return { error: "Monthly payment must be greater than monthly interest." };
        }

        let months = 0;
        let totalInterest = 0;

        if (r === 0) {
            months = Math.ceil(p / a);
        } else {
            months = Math.ceil(-Math.log(1 - (r * p) / a) / Math.log(1 + r));
            // Actual total paid = months * a (roughly)
            // Precise total interest:
            let balance = p;
            for (let i = 0; i < months; i++) {
                const interest = balance * r;
                totalInterest += interest;
                balance = balance + interest - a;
            }
        }

        const payoffDate = addMonths(new Date(), months);

        // Generate chart data (simulate balance over time, max 60 data points to prevent lag)
        const chartData = [];
        let simBalance = p;
        const step = Math.max(1, Math.floor(months / 20));
        
        for (let i = 0; i <= months; i += step) {
            chartData.push({
                value: simBalance,
                label: i === 0 ? 'Now' : `+${i}m`
            });
            // Advance by step months
            for (let j = 0; j < step; j++) {
                simBalance = simBalance + (simBalance * r) - a;
                if (simBalance < 0) simBalance = 0;
            }
        }

        // Ensure last point is 0
        if (chartData[chartData.length - 1].value > 0) {
            chartData.push({ value: 0, label: `+${months}m` });
        }

        return {
            months,
            payoffDate,
            totalInterest,
            totalPaid: p + totalInterest,
            chartData
        };
    }, [debtAmount, interestRate, monthlyPayment]);

    return (
        <KeyboardAvoidingView 
            style={[styles.container, { paddingTop: insets.top }]} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                    <ArrowLeft size={24} color={Colors.gray[900]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Debt Calculator</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                
                {/* Result Card */}
                {calcResult && !calcResult.error ? (
                    <LinearGradient
                        colors={['#8B5CF6', '#6D28D9']} // Purple gradient
                        style={styles.resultCard}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <View style={styles.resultTop}>
                            <View style={styles.resultIconBox}>
                                <CalendarCheck size={24} color={Colors.white} />
                            </View>
                            <Text style={styles.resultBadge}>DEBT FREE BY</Text>
                        </View>
                        <Text style={styles.resultDate}>{format(calcResult.payoffDate, 'MMMM yyyy')}</Text>
                        
                        <View style={styles.resultStats}>
                            <View style={styles.resultStat}>
                                <Text style={styles.resultStatLabel}>Time Remaining</Text>
                                <Text style={styles.resultStatValue}>{calcResult.months} months</Text>
                            </View>
                            <View style={styles.resultStatDivider} />
                            <View style={styles.resultStat}>
                                <Text style={styles.resultStatLabel}>Total Interest</Text>
                                <Text style={styles.resultStatValue}>{formatCurrency(calcResult.totalInterest ?? 0)}</Text>
                            </View>
                        </View>

                        {/* Mini Chart */}
                        <View style={{ marginTop: 24, alignItems: 'center' }}>
                            <LineChart
                                data={calcResult.chartData}
                                width={SCREEN_WIDTH - 80}
                                height={100}
                                thickness={3}
                                color="rgba(255,255,255,0.8)"
                                hideDataPoints
                                hideRules
                                hideYAxisText
                                xAxisColor="rgba(255,255,255,0.2)"
                                yAxisColor="transparent"
                                xAxisLabelTextStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}
                                curved
                            />
                        </View>
                    </LinearGradient>
                ) : (
                    <View style={styles.emptyCard}>
                        <Calculator size={48} color={Colors.primary[200]} />
                        <Text style={styles.emptyTitle}>Calculate Payoff Date</Text>
                        <Text style={styles.emptySub}>Enter your debt details below to see when you will be completely debt free.</Text>
                    </View>
                )}

                {calcResult?.error && (
                    <View style={styles.errorBox}>
                        <AlertTriangle size={20} color={Colors.danger[600]} />
                        <Text style={styles.errorText}>{calcResult.error}</Text>
                    </View>
                )}

                {/* Input Section */}
                <View style={styles.inputSection}>
                    <Text style={styles.sectionTitle}>Debt Details</Text>
                    
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Total Debt Amount</Text>
                        <View style={styles.inputWrapper}>
                            <Text style={styles.currencyPrefix}>₹</Text>
                            <TextInput
                                style={styles.input}
                                value={debtAmount}
                                onChangeText={setDebtAmount}
                                keyboardType="numeric"
                                placeholder="0.00"
                                placeholderTextColor={Colors.gray[400]}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Annual Interest Rate (%)</Text>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.input}
                                value={interestRate}
                                onChangeText={setInterestRate}
                                keyboardType="numeric"
                                placeholder="5.0"
                                placeholderTextColor={Colors.gray[400]}
                            />
                            <Text style={styles.percentSuffix}>%</Text>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Monthly Payment</Text>
                        <View style={styles.inputWrapper}>
                            <Text style={styles.currencyPrefix}>₹</Text>
                            <TextInput
                                style={styles.input}
                                value={monthlyPayment}
                                onChangeText={setMonthlyPayment}
                                keyboardType="numeric"
                                placeholder="0.00"
                                placeholderTextColor={Colors.gray[400]}
                            />
                        </View>
                        <Text style={styles.inputHint}>How much can you afford to pay each month?</Text>
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </KeyboardAvoidingView>
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
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    resultCard: {
        padding: 24,
        borderRadius: 24,
        marginBottom: 32,
        ...Layout.shadows.md,
    },
    resultTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    resultIconBox: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    resultBadge: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
        color: 'rgba(255,255,255,0.8)',
        letterSpacing: 1,
    },
    resultDate: {
        fontSize: Typography.size.xxxl,
        fontFamily: Typography.family.bold,
        color: Colors.white,
        marginBottom: 24,
    },
    resultStats: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 16,
    },
    resultStat: {
        flex: 1,
    },
    resultStatLabel: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.medium,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 4,
    },
    resultStatValue: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.white,
    },
    resultStatDivider: {
        width: 1,
        height: '100%',
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginHorizontal: 16,
    },
    emptyCard: {
        backgroundColor: Colors.primary[50],
        padding: 32,
        borderRadius: 24,
        alignItems: 'center',
        marginBottom: 32,
        borderWidth: 1,
        borderColor: Colors.primary[100],
    },
    emptyTitle: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        color: Colors.primary[800],
        marginTop: 16,
        marginBottom: 8,
    },
    emptySub: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.medium,
        color: Colors.primary[600],
        textAlign: 'center',
        lineHeight: 20,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.danger[50],
        padding: 16,
        borderRadius: 16,
        marginBottom: 24,
        gap: 12,
    },
    errorText: {
        flex: 1,
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.medium,
        color: Colors.danger[700],
    },
    inputSection: {
        backgroundColor: Colors.white,
        padding: 20,
        borderRadius: 24,
        ...Layout.shadows.sm,
    },
    sectionTitle: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        marginBottom: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        color: Colors.gray[700],
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.gray[50],
        borderWidth: 1,
        borderColor: Colors.gray[200],
        borderRadius: 16,
        paddingHorizontal: 16,
    },
    currencyPrefix: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        color: Colors.gray[400],
        marginRight: 8,
    },
    percentSuffix: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        color: Colors.gray[400],
        marginLeft: 8,
    },
    input: {
        flex: 1,
        height: 56,
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    inputHint: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.medium,
        color: Colors.gray[400],
        marginTop: 6,
    },
});
