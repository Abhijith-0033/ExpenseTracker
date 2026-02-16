
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Share } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, Settings, Plus, Users, Receipt, Share2 } from 'lucide-react-native';
import { Colors, Layout } from '../../constants/Theme';
import {
    getGroupById, getGroupMembers, getGroupExpenses, calculateBalances, calculateSettlements,
    BillGroup, BillGroupMember, BillExpenseDetails, Balance, SettlementTransaction
} from '../../services/billSplitter';
import { SettlementSummary } from '../../components/SettlementSummary';
import { MemberBalanceCard } from '../../components/MemberBalanceCard';
import { format } from 'date-fns';

export default function GroupDetailsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const groupId = parseInt(params.id as string);

    const [group, setGroup] = useState<BillGroup | null>(null);
    const [members, setMembers] = useState<BillGroupMember[]>([]);
    const [expenses, setExpenses] = useState<BillExpenseDetails[]>([]);
    const [balances, setBalances] = useState<Balance[]>([]);
    const [settlements, setSettlements] = useState<SettlementTransaction[]>([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'expenses' | 'settlement'>('expenses');

    const fetchData = React.useCallback(async () => {
        try {
            const [g, m, e] = await Promise.all([
                getGroupById(groupId),
                getGroupMembers(groupId),
                getGroupExpenses(groupId)
            ]);

            setGroup(g);
            setMembers(m);
            setExpenses(e);

            if (g) {
                const bals = await calculateBalances(groupId);
                setBalances(bals);
                const sets = calculateSettlements(bals);
                setSettlements(sets);
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load group details');
            router.back();
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [groupId]);

    useFocusEffect(
        React.useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    if (loading || !group) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary[600]} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={Colors.gray[900]} />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{group.name}</Text>
                    {group.description ? <Text style={styles.headerSubtitle} numberOfLines={1}>{group.description}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => router.push(`/bill-splitter/manage-group?id=${groupId}`)}>
                    <Settings size={24} color={Colors.gray[900]} />
                </TouchableOpacity>
            </View>

            {/* Balances Horizontal Scroll */}
            <View style={styles.balancesContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.balancesList}>
                    {balances.map(b => (
                        <MemberBalanceCard key={b.member_id} name={b.member_name} amount={b.amount} />
                    ))}
                </ScrollView>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'expenses' && styles.activeTab]}
                    onPress={() => setActiveTab('expenses')}
                >
                    <Receipt size={18} color={activeTab === 'expenses' ? Colors.primary[600] : Colors.gray[500]} />
                    <Text style={[styles.tabText, activeTab === 'expenses' && styles.activeTabText]}>Expenses</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'settlement' && styles.activeTab]}
                    onPress={() => setActiveTab('settlement')}
                >
                    <Share2 size={18} color={activeTab === 'settlement' ? Colors.primary[600] : Colors.gray[500]} />
                    <Text style={[styles.tabText, activeTab === 'settlement' && styles.activeTabText]}>Settlement</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
            >
                {activeTab === 'expenses' ? (
                    <>
                        <View style={styles.expensesList}>
                            {expenses.length > 0 ? (
                                expenses.map(expense => (
                                    <TouchableOpacity
                                        key={expense.id}
                                        style={styles.expenseItem}
                                        onPress={() => router.push(`/bill-splitter/add-group-expense?groupId=${groupId}&id=${expense.id}`)}
                                    >
                                        <View style={styles.expenseDate}>
                                            <Text style={styles.dateMonth}>{format(new Date(expense.date), 'MMM')}</Text>
                                            <Text style={styles.dateDay}>{format(new Date(expense.date), 'dd')}</Text>
                                        </View>
                                        <View style={styles.expenseDetails}>
                                            <Text style={styles.expenseTitle}>{expense.title}</Text>
                                            <Text style={styles.expensePaidBy}>
                                                {expense.paid_by_name} paid ₹{expense.amount.toLocaleString('en-IN')}
                                            </Text>
                                        </View>
                                        <View style={styles.expenseAmount}>
                                            <Text style={styles.amountText}>₹{expense.amount}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyIcon}>🧾</Text>
                                    <Text style={styles.emptyText}>No expenses yet. Add one!</Text>
                                </View>
                            )}
                        </View>
                        <View style={{ height: 80 }} />
                    </>
                ) : (
                    <>
                        <SettlementSummary settlements={settlements} />

                        <View style={styles.settlementNote}>
                            <Text style={styles.noteTitle}>How this works</Text>
                            <Text style={styles.noteText}>
                                This plan minimizes the number of transactions needed to settle all debts.
                                It ensures everyone pays or receives exactly what they should.
                            </Text>
                        </View>
                    </>
                )}
            </ScrollView>

            {/* FAB */}
            {activeTab === 'expenses' && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => router.push(`/bill-splitter/add-group-expense?groupId=${groupId}`)}
                >
                    <Plus size={32} color="white" />
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.gray[50] },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[100],
    },
    backBtn: { marginRight: 16 },
    headerTextContainer: { flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.gray[900] },
    headerSubtitle: { fontSize: 13, color: Colors.gray[500] },
    balancesContainer: {
        backgroundColor: Colors.white,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[100],
    },
    balancesList: {
        paddingHorizontal: 20,
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: Colors.white,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[200],
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        marginRight: 24,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
        gap: 8,
    },
    activeTab: {
        borderBottomColor: Colors.primary[600],
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.gray[500],
    },
    activeTabText: {
        color: Colors.primary[600],
    },
    scrollContent: { padding: 20 },
    expensesList: { gap: 12 },
    expenseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        padding: 16,
        borderRadius: 16,
        ...Layout.shadows.sm,
    },
    expenseDate: {
        alignItems: 'center',
        backgroundColor: Colors.gray[50],
        padding: 8,
        borderRadius: 8,
        marginRight: 16,
        minWidth: 50,
    },
    dateMonth: { fontSize: 12, color: Colors.gray[500], fontWeight: '600', textTransform: 'uppercase' },
    dateDay: { fontSize: 18, fontWeight: '700', color: Colors.gray[900] },
    expenseDetails: { flex: 1 },
    expenseTitle: { fontSize: 16, fontWeight: '600', color: Colors.gray[900], marginBottom: 4 },
    expensePaidBy: { fontSize: 13, color: Colors.gray[500] },
    expenseAmount: { alignItems: 'flex-end' },
    amountText: { fontSize: 16, fontWeight: '700', color: Colors.gray[900] },
    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyText: { color: Colors.gray[500], fontSize: 14 },
    settlementNote: {
        backgroundColor: Colors.primary[50],
        padding: 16,
        borderRadius: 12,
        marginTop: 8,
    },
    noteTitle: { fontSize: 14, fontWeight: '700', color: Colors.primary[700], marginBottom: 4 },
    noteText: { fontSize: 13, color: Colors.primary[700], lineHeight: 18 },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.primary[600],
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: Colors.primary[600],
        shadowOpacity: 0.4,
        shadowRadius: 10,
    },
});
