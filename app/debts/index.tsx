import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Modal, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, X } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../../constants/Theme';
import { useTheme } from '../../context/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getDebts, addDebtPerson, deleteDebtPerson, Debt, getAccounts, Account } from '../../services/database';
import { getDebtSummary } from '../../services/debts';
import { DebtCard } from '../../components/DebtCard';
import { formatCurrency } from '../../utils/currency';
import { AccountSelector } from '../../components/AccountSelector';

export default function DebtsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { colors } = useTheme();
    const initialType = (params.type as 'debt' | 'receivable') || 'debt';

    const [activeTab, setActiveTab] = useState<'debt' | 'receivable'>(initialType);
    const [debts, setDebts] = useState<Debt[]>([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({ totalDebt: 0, totalReceivable: 0, netPosition: 0 });

    // Add Modal State
    const [isModalVisible, setModalVisible] = useState(false);
    const [newName, setNewName] = useState('');
    const [newAmount, setNewAmount] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const fetchData = React.useCallback(async () => {
        try {
            const [data, sum, accs] = await Promise.all([
                getDebts(activeTab),
                getDebtSummary(),
                getAccounts()
            ]);
            setDebts(data);
            setSummary(sum);
            setAccounts(accs.filter(a => a.type !== 'meta_categories'));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useFocusEffect(
        React.useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    const handleAdd = async () => {
        if (!newName.trim()) {
            setErrors({ name: 'Name is required' });
            return;
        }
        setErrors({});
        try {
            await addDebtPerson(newName, activeTab, newNotes, parseFloat(newAmount) || 0, selectedAccountId ?? undefined);
            setModalVisible(false);
            setNewName('');
            setNewAmount('');
            setNewNotes('');
            setSelectedAccountId(null);
            await fetchData();
        } catch (e) {
            Alert.alert("Error", "Failed to add debt entry");
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteDebtPerson(id);
            await fetchData();
        } catch (e) {
            Alert.alert("Error", "Failed to delete entry");
        }
    };

    const currentTotal = activeTab === 'debt' ? summary.totalDebt : summary.totalReceivable;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={[styles.container, { backgroundColor: colors.gray[50] }]}>
                <StatusBar barStyle="dark-content" />
                
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ArrowLeft size={24} color={Colors.gray[900]} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Debt Tracker</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Tabs */}
                <View style={styles.tabs}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'debt' && styles.activeTab]}
                        onPress={() => setActiveTab('debt')}
                    >
                        <Text style={[styles.tabText, activeTab === 'debt' && styles.activeTabText]}>
                            You Owe (Debts)
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'receivable' && styles.activeTab]}
                        onPress={() => setActiveTab('receivable')}
                    >
                        <Text style={[styles.tabText, activeTab === 'receivable' && styles.activeTabText]}>
                            Owed To You
                        </Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={Colors.primary[600]} />
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {/* Summary Card */}
                        <View style={styles.summaryRow}>
                            <View style={[styles.summaryCard, { backgroundColor: activeTab === 'debt' ? Colors.danger[50] : Colors.success[50] }]}>
                                <Text style={styles.summaryLabel}>
                                    {activeTab === 'debt' ? 'TOTAL YOU OWE' : 'TOTAL OWED TO YOU'}
                                </Text>
                                <Text style={[styles.summaryValue, { color: activeTab === 'debt' ? Colors.danger[600] : Colors.success[600] }]}>
                                    {formatCurrency(currentTotal)}
                                </Text>
                            </View>
                        </View>

                        {/* List Title */}
                        <Text style={styles.sectionTitle}>
                            {activeTab === 'debt' ? 'People You Owe' : 'People Who Owe You'}
                        </Text>

                        {/* Debt List */}
                        {debts.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>
                                    No {activeTab === 'debt' ? 'debts' : 'receivables'} recorded yet.
                                </Text>
                            </View>
                        ) : (
                            debts.map((item) => (
                                <DebtCard
                                    key={item.id}
                                    item={item}
                                    onPress={() => router.push(`/debt-tracker/${item.id}` as any)}
                                    onIncrease={() => router.push(`/debt-tracker/${item.id}` as any)}
                                    onReduce={() => router.push(`/debt-tracker/${item.id}` as any)}
                                    onDelete={() => handleDelete(item.id)}
                                />
                            ))
                        )}
                    </ScrollView>
                )}

                {/* FAB */}
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => setModalVisible(true)}
                    activeOpacity={0.8}
                >
                    <Plus size={28} color="#fff" />
                </TouchableOpacity>

                {/* Add Modal */}
                <Modal visible={isModalVisible} animationType="slide" transparent>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>
                                    {activeTab === 'debt' ? 'Add Person You Owe' : 'Add Person Who Owes You'}
                                </Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)}>
                                    <X size={24} color={Colors.gray[600]} />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.label}>Person Name *</Text>
                            <TextInput
                                style={[styles.input, errors.name && { borderColor: Colors.danger[500] }]}
                                placeholder="Enter name"
                                placeholderTextColor={Colors.gray[400]}
                                value={newName}
                                onChangeText={setNewName}
                            />

                            <Text style={styles.label}>Initial Amount (Optional)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="0.00"
                                placeholderTextColor={Colors.gray[400]}
                                keyboardType="numeric"
                                value={newAmount}
                                onChangeText={setNewAmount}
                            />

                            <Text style={styles.label}>Link Account (Optional)</Text>
                            <AccountSelector
                                accounts={accounts}
                                selectedAccountId={selectedAccountId}
                                onSelectAccount={(acc) => setSelectedAccountId(acc ? acc.id : null)}
                            />

                            <Text style={[styles.label, { marginTop: 16 }]}>Notes (Optional)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Add optional details..."
                                placeholderTextColor={Colors.gray[400]}
                                value={newNotes}
                                onChangeText={setNewNotes}
                            />

                            <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
                                <Text style={styles.saveBtnText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </View>
        </GestureHandlerRootView>
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
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: Colors.white,
    },
    backBtn: { padding: 8, marginLeft: -8 },
    headerTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    tabs: {
        flexDirection: 'row',
        padding: 4,
        margin: 16,
        backgroundColor: Colors.gray[200],
        borderRadius: 12,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    activeTab: {
        backgroundColor: Colors.white,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    tabText: {
        fontFamily: Typography.family.bold,
        fontSize: Typography.size.sm,
        color: Colors.gray[500],
    },
    activeTabText: {
        color: Colors.gray[900],
    },
    scrollContent: { padding: 16 },
    summaryRow: { marginBottom: 20 },
    summaryCard: {
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
    },
    summaryLabel: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.gray[600], marginBottom: 8 },
    summaryValue: { fontSize: Typography.size.xxxl, fontFamily: Typography.family.bold },
    sectionTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, marginBottom: 12, marginTop: 8, color: Colors.gray[900] },
    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyText: { color: Colors.gray[500], fontFamily: Typography.family.medium },
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        minHeight: 400,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    label: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, marginBottom: 8, color: Colors.gray[700] },
    input: {
        backgroundColor: Colors.gray[50],
        padding: 16,
        borderRadius: Layout.radius.lg,
        marginBottom: 16,
        fontSize: Typography.size.md,
        fontFamily: Typography.family.medium,
        borderWidth: 1,
        borderColor: Colors.gray[100],
    },
    saveBtn: {
        backgroundColor: Colors.primary[600],
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 16,
    },
    saveBtnText: { color: 'white', fontSize: Typography.size.md, fontFamily: Typography.family.bold },
});
