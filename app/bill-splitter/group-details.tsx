
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, Settings, Plus, Receipt, Share2, HandCoins, X } from 'lucide-react-native';
import { Colors, Layout } from '../../constants/Theme';
import {
    getGroupById, getGroupMembers, getGroupExpenses, calculateBalances, calculateSettlements, addExpense,
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
    const [showMoneyModal, setShowMoneyModal] = useState(false);
    const [moneyFromId, setMoneyFromId] = useState<number | null>(null);
    const [moneyToId, setMoneyToId] = useState<number | null>(null);
    const [moneyAmount, setMoneyAmount] = useState('');
    const [savingMoney, setSavingMoney] = useState(false);

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
    }, [groupId, router]);

    useFocusEffect(
        React.useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    const openMoneyModal = () => {
        setMoneyFromId(members[0]?.id || null);
        setMoneyToId(members[1]?.id || members[0]?.id || null);
        setMoneyAmount('');
        setShowMoneyModal(true);
    };

    const handleSaveMoneyGiven = async () => {
        const amount = parseFloat(moneyAmount);
        if (!moneyFromId || !moneyToId || moneyFromId === moneyToId || !amount || amount <= 0) {
            Alert.alert('Check Details', 'Select two different friends and enter a valid amount.');
            return;
        }

        const fromMember = members.find(m => m.id === moneyFromId);
        const toMember = members.find(m => m.id === moneyToId);
        if (!fromMember || !toMember) return;

        setSavingMoney(true);
        try {
            await addExpense({
                groupId,
                title: `Money given to ${toMember.name}`,
                amount,
                paidByMemberId: fromMember.id,
                date: Date.now(),
                notes: 'Money given directly',
                splits: [{ memberId: toMember.id, amount }]
            });
            setShowMoneyModal(false);
            fetchData();
        } catch (_e) {
            Alert.alert('Error', 'Failed to save money given.');
        } finally {
            setSavingMoney(false);
        }
    };

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
                                expenses.map(expense => {
                                    const isMoneyGiven = expense.title.startsWith('Money given');
                                    return (
                                        <TouchableOpacity
                                            key={expense.id}
                                            style={[styles.expenseItem, isMoneyGiven && styles.moneyGivenItem]}
                                            onPress={() => router.push(`/bill-splitter/add-group-expense?groupId=${groupId}&id=${expense.id}`)}
                                        >
                                            <View style={[styles.expenseDate, isMoneyGiven && { backgroundColor: Colors.primary[50] }]}>
                                                <Text style={styles.dateMonth}>{format(new Date(expense.date), 'MMM')}</Text>
                                                <Text style={styles.dateDay}>{format(new Date(expense.date), 'dd')}</Text>
                                            </View>
                                            <View style={styles.expenseDetails}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    {isMoneyGiven && <HandCoins size={14} color={Colors.primary[600]} style={{ marginRight: 6 }} />}
                                                    <Text style={styles.expenseTitle}>{expense.title}</Text>
                                                </View>
                                                <Text style={styles.expensePaidBy}>
                                                    {expense.paid_by_name} paid ₹{expense.amount.toLocaleString('en-IN')}
                                                </Text>
                                            </View>
                                            <View style={styles.expenseAmount}>
                                                <Text style={[styles.amountText, isMoneyGiven && { color: Colors.primary[600] }]}>₹{expense.amount}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
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
                        <SettlementSummary settlements={settlements} balances={balances} />

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
                <View style={styles.fabStack}>
                    <TouchableOpacity
                        style={[styles.fab, styles.secondaryFab]}
                        onPress={openMoneyModal}
                    >
                        <HandCoins size={26} color={Colors.primary[700]} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.fab}
                        onPress={() => router.push(`/bill-splitter/add-group-expense?groupId=${groupId}`)}
                    >
                        <Plus size={32} color="white" />
                    </TouchableOpacity>
                </View>
            )}

            <Modal visible={showMoneyModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Money Given</Text>
                            <TouchableOpacity onPress={() => setShowMoneyModal(false)} style={styles.modalClose}>
                                <X size={22} color={Colors.gray[600]} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Who gave money?</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                            {members.map(member => (
                                <TouchableOpacity
                                    key={member.id}
                                    style={[styles.memberChip, moneyFromId === member.id && styles.memberChipActive]}
                                    onPress={() => setMoneyFromId(member.id)}
                                >
                                    <Text style={[styles.memberChipText, moneyFromId === member.id && styles.memberChipTextActive]}>{member.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.inputLabel}>Who received it?</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                            {members.map(member => (
                                <TouchableOpacity
                                    key={member.id}
                                    style={[styles.memberChip, moneyToId === member.id && styles.memberChipActive]}
                                    onPress={() => setMoneyToId(member.id)}
                                >
                                    <Text style={[styles.memberChipText, moneyToId === member.id && styles.memberChipTextActive]}>{member.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.inputLabel}>Amount</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={moneyAmount}
                            onChangeText={setMoneyAmount}
                            placeholder="₹0"
                        />

                        <TouchableOpacity
                            style={[styles.saveMoneyBtn, savingMoney && { opacity: 0.7 }]}
                            onPress={handleSaveMoneyGiven}
                            disabled={savingMoney}
                        >
                            {savingMoney ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveMoneyText}>Save Money Given</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
    moneyGivenItem: {
        borderColor: Colors.primary[200],
        borderWidth: 1,
        backgroundColor: Colors.primary[50] + '20', // Very light tint
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
    fabStack: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        gap: 12,
        alignItems: 'center',
    },
    fab: {
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
    secondaryFab: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: Colors.primary[50],
        borderWidth: 1,
        borderColor: Colors.primary[100],
        shadowColor: Colors.gray[400],
        shadowOpacity: 0.2,
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.gray[900] },
    modalClose: { padding: 8 },
    inputLabel: { fontSize: 13, fontWeight: '700', color: Colors.gray[600], marginBottom: 8, textTransform: 'uppercase' },
    chipRow: { gap: 8, paddingBottom: 16 },
    memberChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.gray[100] },
    memberChipActive: { backgroundColor: Colors.primary[600] },
    memberChipText: { color: Colors.gray[700], fontWeight: '600' },
    memberChipTextActive: { color: Colors.white },
    input: { backgroundColor: Colors.gray[100], borderRadius: 12, padding: 16, fontSize: 18, fontWeight: '700', color: Colors.gray[900], marginBottom: 20 },
    saveMoneyBtn: { backgroundColor: Colors.primary[600], borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
    saveMoneyText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
