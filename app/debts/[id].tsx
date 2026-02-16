import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, Alert, TextInput, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, TrendingUp, TrendingDown, Check, Clock, Wallet } from 'lucide-react-native';
import { Colors, Layout } from '../../constants/Theme';
import { getDebtById, getDebtHistory, updateDebtAmount, getAccounts, Debt, DebtHistory, Account } from '../../services/database';
import { formatCurrency } from '../../utils/currency';
import { format } from 'date-fns';

export default function DebtDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [debt, setDebt] = useState<Debt | null>(null);
    const [history, setHistory] = useState<DebtHistory[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);

    // Action Modal
    const [modalVisible, setModalVisible] = useState(false);
    const [actionType, setActionType] = useState<'increase' | 'reduce'>('increase');
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

    const fetchData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const d = await getDebtById(Number(id));
            const h = await getDebtHistory(Number(id));
            const accs = await getAccounts();
            setDebt(d);
            setHistory(h);
            setAccounts(accs);
            if (accs.length > 0) setSelectedAccountId(accs[0].id); // Default to first account
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const handleUpdate = async () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }
        if (!selectedAccountId) {
            Alert.alert('Error', 'Please select an account');
            return;
        }

        try {
            await updateDebtAmount(Number(id), parseFloat(amount), actionType, notes, selectedAccountId);
            setModalVisible(false);
            setAmount('');
            setNotes('');
            fetchData();
        } catch (e) {
            Alert.alert('Error', 'Update failed. Check database logs.');
        }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>;
    if (!debt) return <View style={styles.center}><Text>Not Found</Text></View>;

    const isDebt = debt.type === 'debt';
    const mainColor = isDebt ? Colors.danger[500] : Colors.success[500];
    const bgColor = isDebt ? Colors.danger[50] : Colors.success[50];

    // Derived UI Text
    const actionTitle = actionType === 'increase'
        ? (isDebt ? 'Borrow More' : 'Lend More')
        : (isDebt ? 'Repay Debt' : 'Receive Payment');

    const previewText = actionType === 'increase'
        ? (isDebt
            ? `Balance takes: +${formatCurrency(Number(amount) || 0)}`
            : `Balance takes: -${formatCurrency(Number(amount) || 0)}`)
        : (isDebt
            ? `Balance takes: -${formatCurrency(Number(amount) || 0)}`
            : `Balance takes: +${formatCurrency(Number(amount) || 0)}`);

    return (
        <View style={styles.container}>
            <ScrollView>
                <View style={[styles.header, { backgroundColor: bgColor }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ArrowLeft size={24} color={Colors.gray[900]} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{debt.name}</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Hero Section */}
                <View style={[styles.hero, { backgroundColor: bgColor }]}>
                    <Text style={[styles.heroLabel, { color: mainColor }]}>
                        {isDebt ? 'YOU OWE' : 'OWES YOU'}
                    </Text>
                    <Text style={[styles.heroAmount, { color: mainColor }]}>{formatCurrency(debt.amount)}</Text>
                    {debt.notes ? <Text style={styles.heroNotes}>{debt.notes}</Text> : null}
                    <Text style={styles.lastUpdated}>Updated {format(new Date(debt.last_updated), 'MMM dd, yyyy')}</Text>
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: Colors.white, borderColor: mainColor, borderWidth: 1 }]}
                        onPress={() => { setActionType('reduce'); setModalVisible(true); }}
                    >
                        <TrendingDown size={20} color={mainColor} />
                        <Text style={[styles.actionLabel, { color: mainColor }]}>
                            {isDebt ? 'Paid Back' : 'Received'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: mainColor }]}
                        onPress={() => { setActionType('increase'); setModalVisible(true); }}
                    >
                        <TrendingUp size={20} color="white" />
                        <Text style={[styles.actionLabel, { color: 'white' }]}>
                            {isDebt ? 'Borrow More' : 'Lend More'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* History */}
                <View style={styles.historySection}>
                    <Text style={styles.sectionTitle}>History</Text>
                    {history.map((item, index) => (
                        <View key={item.id} style={styles.historyItem}>
                            <View style={styles.timelineLine} />
                            <View style={[styles.historyIcon, { backgroundColor: item.action === 'increase' ? Colors.gray[200] : Colors.success[100] }]}>
                                {item.action === 'increase' ?
                                    <TrendingUp size={16} color={Colors.gray[600]} /> :
                                    <Check size={16} color={Colors.success[600]} />
                                }
                            </View>
                            <View style={styles.historyContent}>
                                <View style={styles.historyRow}>
                                    <Text style={styles.historyAction}>
                                        {item.action === 'increase' ? (isDebt ? 'Borrowed' : 'Lent') : (isDebt ? 'Repayment' : 'Received')}
                                    </Text>
                                    <Text style={[styles.historyAmount, { color: item.action === 'increase' ? Colors.gray[900] : Colors.success[600] }]}>
                                        {item.action === 'increase' ? '+' : '-'}{formatCurrency(item.change_amount)}
                                    </Text>
                                </View>
                                <Text style={styles.historyDate}>{format(new Date(item.date), 'MMM dd, hh:mm a')} • {item.notes}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* Modal */}
            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>
                            {actionTitle}
                        </Text>

                        {/* Account Selector */}
                        <Text style={styles.label}>Select Account</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountSelector}>
                            {accounts.map(acc => (
                                <TouchableOpacity
                                    key={acc.id}
                                    style={[
                                        styles.accountOption,
                                        selectedAccountId === acc.id && { backgroundColor: mainColor, borderColor: mainColor }
                                    ]}
                                    onPress={() => setSelectedAccountId(acc.id)}
                                >
                                    <Text style={[
                                        styles.accountOptionText,
                                        selectedAccountId === acc.id && { color: 'white' }
                                    ]}>{acc.name} ({formatCurrency(acc.balance)})</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.label}>Amount</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Amount"
                            keyboardType="numeric"
                            value={amount}
                            onChangeText={setAmount}
                            autoFocus
                        />

                        <Text style={styles.label}>Note</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Note (Optional)"
                            value={notes}
                            onChangeText={setNotes}
                        />

                        {amount ? (
                            <Text style={[styles.previewText, { color: Colors.gray[600] }]}>
                                {previewText}
                            </Text>
                        ) : null}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                <Text>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: mainColor }]} onPress={handleUpdate}>
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>Confirm</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.white },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { padding: 20, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    backBtn: { padding: 4 },
    hero: { padding: 30, alignItems: 'center', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    heroLabel: { fontSize: 14, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
    heroAmount: { fontSize: 40, fontWeight: '800', marginBottom: 16 },
    heroNotes: { fontSize: 14, color: Colors.gray[600], marginBottom: 8 },
    lastUpdated: { fontSize: 12, color: Colors.gray[500] },
    actions: { flexDirection: 'row', padding: 20, gap: 16 },
    actionBtn: { flex: 1, padding: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    actionLabel: { fontWeight: '700' },
    historySection: { padding: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20 },
    historyItem: { flexDirection: 'row', marginBottom: 24, position: 'relative' },
    timelineLine: { position: 'absolute', left: 16, top: 0, bottom: -24, width: 2, backgroundColor: Colors.gray[100], zIndex: -1 },
    historyIcon: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginRight: 16, backgroundColor: Colors.gray[100] },
    historyContent: { flex: 1 },
    historyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    historyAction: { fontWeight: '600', color: Colors.gray[800] },
    historyAmount: { fontWeight: '700' },
    historyDate: { fontSize: 12, color: Colors.gray[500] },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
    modalContent: { backgroundColor: 'white', padding: 24, borderRadius: 24 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    input: { backgroundColor: Colors.gray[100], padding: 16, borderRadius: 12, marginBottom: 12, fontSize: 16 },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 },
    cancelBtn: { padding: 12 },
    confirmBtn: { padding: 12, paddingHorizontal: 24, borderRadius: 12 },
    label: { fontSize: 12, fontWeight: '600', color: Colors.gray[500], marginBottom: 8, marginTop: 4 },
    accountSelector: { flexDirection: 'row', marginBottom: 16, maxHeight: 50 },
    accountOption: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.gray[200],
        marginRight: 8,
        backgroundColor: Colors.white,
    },
    accountOptionText: { fontSize: 12, fontWeight: '600', color: Colors.gray[700] },
    previewText: { fontSize: 12, fontStyle: 'italic', marginBottom: 16, textAlign: 'right' },
});
