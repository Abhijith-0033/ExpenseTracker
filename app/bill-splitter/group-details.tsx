
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Modal, TextInput, Share } from 'react-native';
import { ScrollView, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, Settings, Plus, Receipt, Share2, HandCoins, X, FileText, MessageSquare } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Colors, Layout } from '../../constants/Theme';
import {
    getGroupById, getGroupMembers, getGroupExpenses, calculateBalances, calculateSettlements, addExpense, deleteExpense, generateBillGroupShareSummary, generateBillGroupPdfHtml,
    BillGroup, BillGroupMember, BillExpenseDetails, Balance, SettlementTransaction
} from '../../services/billSplitter';
import { SettlementSummary } from '../../components/SettlementSummary';
import { MemberBalanceCard } from '../../components/MemberBalanceCard';
import { SwipeableRow } from '../../components/SwipeableRow';
import { ConfirmActionSheet } from '../../components/ConfirmActionSheet';
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
    const [showExportOptions, setShowExportOptions] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);

    const [confirmSheet, setConfirmSheet] = useState<{
        title: string;
        description: string;
        onConfirm: () => void;
    } | null>(null);

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
            savingMoney && setSavingMoney(false);
        }
    };

    const handleDeleteExpense = (exp: BillExpenseDetails) => {
        setConfirmSheet({
            title: 'Delete Expense?',
            description: `Are you sure you want to delete "${exp.title}"? Balances will be recalculated.`,
            onConfirm: async () => {
                setConfirmSheet(null);
                try {
                    await deleteExpense(exp.id);
                    fetchData();
                } catch (_e) {
                    Alert.alert('Error', 'Failed to delete expense.');
                }
            }
        });
    };

    const handleMarkSettled = async (settlement: SettlementTransaction) => {
        try {
            await addExpense({
                groupId,
                title: `Settlement: ${settlement.from_name} → ${settlement.to_name}`,
                amount: settlement.amount,
                paidByMemberId: settlement.from_id,
                date: Date.now(),
                notes: 'Marked as settled',
                splits: [{ memberId: settlement.to_id, amount: settlement.amount }]
            });
            fetchData();
        } catch (_e) {
            Alert.alert('Error', 'Failed to record settlement.');
        }
    };

    const handleExportGroupSummary = async () => {
        try {
            const text = await generateBillGroupShareSummary(groupId);
            if (text) {
                await Share.share({
                    title: `${group?.name || 'Group'} Bill Split Summary`,
                    message: text,
                });
            }
        } catch (e) {
            console.error('Failed to share bill split:', e);
        }
    };

    const handleExportPdf = async () => {
        setShowExportOptions(false);
        setExportingPdf(true);
        try {
            const html = await generateBillGroupPdfHtml(groupId);
            if (!html) {
                Alert.alert('Error', 'Failed to generate PDF content.');
                return;
            }
            const { uri } = await Print.printToFileAsync({ html });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `Share ${group?.name || 'Group'} Bill Report`,
                    UTI: 'com.adobe.pdf',
                });
            } else {
                Alert.alert('PDF Exported', `PDF file created successfully.`);
            }
        } catch (e) {
            console.error('PDF Export Error:', e);
            Alert.alert('Export Error', 'Failed to generate or share PDF.');
        } finally {
            setExportingPdf(false);
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
        <GestureHandlerRootView style={{ flex: 1 }}>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={() => setShowExportOptions(true)} hitSlop={10}>
                        <Share2 size={22} color={Colors.primary[600]} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => router.push(`/bill-splitter/manage-group?id=${groupId}`)} hitSlop={10}>
                        <Settings size={22} color={Colors.gray[900]} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Balances Horizontal Scroll */}
            <View style={styles.balancesContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.balancesList}>
                    {balances.map(b => (
                        <MemberBalanceCard key={b.member_id} name={b.member_name} amount={b.amount} totalSpent={b.total_spent} totalShare={b.total_share} />
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
                                        <SwipeableRow
                                            key={expense.id}
                                            onDelete={() => handleDeleteExpense(expense)}
                                            onEdit={() => router.push(`/bill-splitter/add-group-expense?groupId=${groupId}&id=${expense.id}`)}
                                        >
                                            <TouchableOpacity
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
                                        </SwipeableRow>
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
                        <SettlementSummary
                            settlements={settlements}
                            balances={balances}
                            settledExpenses={expenses.filter(e => e.title.startsWith('Settlement:') || e.title.startsWith('Money given'))}
                            onMarkSettled={handleMarkSettled}
                        />

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

            {confirmSheet && (
                <ConfirmActionSheet
                    visible={!!confirmSheet}
                    title={confirmSheet.title}
                    description={confirmSheet.description}
                    confirmLabel="Delete"
                    actionType="delete"
                    onConfirm={confirmSheet.onConfirm}
                    onCancel={() => setConfirmSheet(null)}
                />
            )}

            {/* Share / Export Options Modal */}
            <Modal visible={showExportOptions} transparent animationType="slide">
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowExportOptions(false)}
                >
                    <View style={styles.exportModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Share & Export</Text>
                            <TouchableOpacity onPress={() => setShowExportOptions(false)} style={styles.modalClose}>
                                <X size={22} color={Colors.gray[600]} />
                            </TouchableOpacity>
                        </View>
                        <Text style={{ fontSize: 14, color: Colors.gray[600], marginBottom: 20 }}>
                            Choose how you would like to export "{group?.name}":
                        </Text>

                        <TouchableOpacity
                            style={styles.exportOptionBtn}
                            onPress={handleExportPdf}
                            disabled={exportingPdf}
                        >
                            <View style={[styles.exportIconBox, { backgroundColor: '#EEF2FF' }]}>
                                {exportingPdf ? (
                                    <ActivityIndicator size="small" color={Colors.primary[600]} />
                                ) : (
                                    <FileText size={24} color={Colors.primary[600]} />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.exportOptionTitle}>Export as PDF</Text>
                                <Text style={styles.exportOptionSub}>
                                    {exportingPdf ? 'Generating PDF report...' : 'Includes spending chart, expense list & settlements'}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.exportOptionBtn}
                            onPress={() => {
                                setShowExportOptions(false);
                                handleExportGroupSummary();
                            }}
                        >
                            <View style={[styles.exportIconBox, { backgroundColor: '#ECFDF5' }]}>
                                <MessageSquare size={24} color="#059669" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.exportOptionTitle}>Share as Text</Text>
                                <Text style={styles.exportOptionSub}>Quick summary report for WhatsApp or SMS</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
        </GestureHandlerRootView>
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
    exportModalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
    },
    exportOptionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.gray[50],
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.gray[200],
    },
    exportIconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    exportOptionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.gray[900],
        marginBottom: 2,
    },
    exportOptionSub: {
        fontSize: 13,
        color: Colors.gray[500],
    },
});
