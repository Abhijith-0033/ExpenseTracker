import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Settings2, Wallet, TrendingUp, TrendingDown, CalendarRange } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../constants/Theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart } from 'react-native-gifted-charts';
import { getAccounts, Account, Transaction } from '../services/database';
import { getAccountIncomeExpense, getAccountTransactions, getAccountBalanceHistory } from '../services/accountDetailQueries';
import { formatCurrency } from '../utils/currency';
import { startOfMonth, subMonths, startOfYear, format } from 'date-fns';
import { TransactionList } from '../components/TransactionList';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Period = 'This Month' | 'Last 3M' | 'This Year' | 'All Time';

export default function AccountDetailScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const initialAccountId = params.account_id ? parseInt(params.account_id as string) : null;

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(initialAccountId);
    const [period, setPeriod] = useState<Period>('This Month');

    const [income, setIncome] = useState(0);
    const [expense, setExpense] = useState(0);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);

    useEffect(() => {
        loadAccounts();
    }, []);

    useEffect(() => {
        if (accounts.length > 0 && selectedAccountId === null && !initialAccountId) {
            setSelectedAccountId(accounts[0].id);
        }
    }, [accounts]);

    useEffect(() => {
        if (selectedAccountId !== null) {
            loadAccountData();
        }
    }, [selectedAccountId, period]);

    const loadAccounts = async () => {
        const accs = await getAccounts();
        setAccounts(accs);
    };

    const getDateRange = () => {
        const end = new Date();
        let start = new Date(0); // All time

        if (period === 'This Month') {
            start = startOfMonth(new Date());
        } else if (period === 'Last 3M') {
            start = subMonths(startOfMonth(new Date()), 2); // Current month + 2 previous
        } else if (period === 'This Year') {
            start = startOfYear(new Date());
        }
        return { start, end };
    };

    const loadAccountData = async () => {
        const { start, end } = getDateRange();
        const [incExp, txs, history] = await Promise.all([
            getAccountIncomeExpense(selectedAccountId, start, end),
            getAccountTransactions(selectedAccountId, start, end),
            getAccountBalanceHistory(selectedAccountId, start, end)
        ]);

        setIncome(incExp.income);
        setExpense(incExp.expense);
        setTransactions(txs);
        
        // Format chart data for LineChart
        if (history.length > 0) {
            const formatted = history.map(h => ({
                value: h.value,
                label: h.label.split(' ')[0], // Just the day number for x-axis
                dataPointText: h.value.toString()
            }));
            setChartData(formatted);
        } else {
            setChartData([{ value: 0, label: '' }]);
        }
    };

    const selectedAccount = accounts.find(a => a.id === selectedAccountId);

    const periods: Period[] = ['This Month', 'Last 3M', 'This Year', 'All Time'];

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                    <ArrowLeft size={24} color={Colors.gray[900]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Account Details</Text>
                <TouchableOpacity onPress={() => router.push('/manage-accounts')} style={styles.iconBtn}>
                    <Settings2 size={24} color={Colors.gray[900]} />
                </TouchableOpacity>
            </View>

            {/* Account Picker (if no initial param was passed, allow switching) */}
            {!initialAccountId && accounts.length > 1 && (
                <View style={styles.pickerContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerScroll}>
                        {accounts.map(acc => (
                            <TouchableOpacity
                                key={acc.id}
                                style={[styles.pickerItem, selectedAccountId === acc.id && styles.pickerItemActive]}
                                onPress={() => setSelectedAccountId(acc.id)}
                            >
                                <Text style={[styles.pickerItemText, selectedAccountId === acc.id && styles.pickerItemTextActive]}>
                                    {acc.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                
                {/* Hero Card */}
                {selectedAccount && (
                    <LinearGradient
                        colors={['#1E293B', '#0F172A']} // Slate 800 -> Slate 900
                        style={styles.heroCard}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <View style={styles.heroTop}>
                            <View style={styles.heroIconBox}>
                                <Wallet size={24} color={Colors.white} />
                            </View>
                            <Text style={styles.heroAccountType}>{selectedAccount.type.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.heroAccountName}>{selectedAccount.name}</Text>
                        <Text style={styles.heroBalanceLabel}>Current Balance</Text>
                        <Text style={styles.heroBalance}>{formatCurrency(selectedAccount.balance)}</Text>
                    </LinearGradient>
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
                    <Text style={styles.sectionTitle}>Net Cash Flow</Text>
                    <View style={{ marginTop: 20, alignItems: 'center' }}>
                        <LineChart
                            data={chartData}
                            width={SCREEN_WIDTH - 80}
                            height={160}
                            thickness={3}
                            color={Colors.primary[500]}
                            hideDataPoints={chartData.length > 30}
                            dataPointsColor={Colors.primary[600]}
                            hideRules
                            hideYAxisText
                            xAxisColor={Colors.gray[200]}
                            yAxisColor="transparent"
                            xAxisLabelTextStyle={{ color: Colors.gray[400], fontSize: 10 }}
                            initialSpacing={10}
                            curved
                        />
                    </View>
                </View>

                {/* Summary Cards */}
                <View style={styles.summaryRow}>
                    <View style={[styles.summaryCard, { backgroundColor: Colors.success.bg }]}>
                        <View style={[styles.summaryIcon, { backgroundColor: Colors.success[100] }]}>
                            <TrendingUp size={20} color={Colors.success[600]} />
                        </View>
                        <Text style={styles.summaryLabel}>Money In</Text>
                        <Text style={[styles.summaryValue, { color: Colors.success[700] }]}>{formatCurrency(income)}</Text>
                    </View>
                    
                    <View style={[styles.summaryCard, { backgroundColor: Colors.danger.bg }]}>
                        <View style={[styles.summaryIcon, { backgroundColor: Colors.danger[100] }]}>
                            <TrendingDown size={20} color={Colors.danger[600]} />
                        </View>
                        <Text style={styles.summaryLabel}>Money Out</Text>
                        <Text style={[styles.summaryValue, { color: Colors.danger[700] }]}>{formatCurrency(expense)}</Text>
                    </View>
                </View>

                {/* Transactions List */}
                <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>Transactions</Text>
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
                        <Text style={styles.emptyText}>No activity found in this period.</Text>
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
        ...Layout.shadows.md,
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
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroAccountType: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
        color: 'rgba(255,255,255,0.6)',
        letterSpacing: 1,
    },
    heroAccountName: {
        fontSize: Typography.size.xl,
        fontFamily: Typography.family.bold,
        color: Colors.white,
        marginBottom: 24,
    },
    heroBalanceLabel: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.medium,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 4,
    },
    heroBalance: {
        fontSize: Typography.size.xxxl,
        fontFamily: Typography.family.bold,
        color: Colors.white,
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
    summaryRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 24,
    },
    summaryCard: {
        flex: 1,
        padding: 16,
        borderRadius: 20,
    },
    summaryIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    summaryLabel: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.medium,
        color: Colors.gray[600],
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
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
