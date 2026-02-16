import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ArrowLeft, Plus, X, Search } from 'lucide-react-native';
import { Colors, Layout } from '../../constants/Theme';
import { getDebts, addDebtPerson, deleteDebtPerson, updateDebtAmount, Debt } from '../../services/database';
import { getDebtSummary, getTopDebtors, getDebtTrend } from '../../services/debts';
import { DebtCard } from '../../components/DebtCard';
import { DebtOverviewCharts } from '../../components/DebtCharts';
import { formatCurrency } from '../../utils/currency';

export default function DebtsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const initialType = params.type as 'debt' | 'receivable' || 'debt';

    const [activeTab, setActiveTab] = useState<'debt' | 'receivable'>(initialType);
    const [debts, setDebts] = useState<Debt[]>([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({ totalDebt: 0, totalReceivable: 0, netPosition: 0 });

    // Add Modal State
    const [isModalVisible, setModalVisible] = useState(false);
    const [newName, setNewName] = useState('');
    const [newAmount, setNewAmount] = useState('');
    const [newNotes, setNewNotes] = useState('');

    const fetchData = React.useCallback(async () => {
        try {
            const data = await getDebts(activeTab);
            const sum = await getDebtSummary();
            setDebts(data);
            setSummary(sum);
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
            Alert.alert('Error', 'Name is required');
            return;
        }
        try {
            await addDebtPerson(newName, activeTab, newNotes, parseFloat(newAmount) || 0);
            setModalVisible(false);
            setNewName('');
            setNewAmount('');
            setNewNotes('');
            fetchData();
        } catch (e) {
            Alert.alert('Error', 'Failed to add person');
        }
    };

    const handleDelete = async (id: number) => {
        Alert.alert(
            'Delete',
            'Are you sure you want to remove this person?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        await deleteDebtPerson(id);
                        fetchData();
                    }
                }
            ]
        );
    };

    // Prepare Chart Data
    const pieData = debts.map(d => ({
        value: d.amount,
        color: activeTab === 'debt' ? Colors.danger[500] : Colors.success[500],
        text: d.name
    })).filter(d => d.value > 0);

    const barData = debts.slice(0, 5).map(d => ({
        value: d.amount,
        label: d.name.substring(0, 5),
        frontColor: activeTab === 'debt' ? Colors.danger[500] : Colors.success[500],
    }));

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.gray[50]} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={Colors.gray[900]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Debts & Credits</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'debt' && styles.activeTab]}
                    onPress={() => setActiveTab('debt')}
                >
                    <Text style={[styles.tabText, activeTab === 'debt' && styles.activeTabText]}>I Owe (Debt)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'receivable' && styles.activeTab]}
                    onPress={() => setActiveTab('receivable')}
                >
                    <Text style={[styles.tabText, activeTab === 'receivable' && styles.activeTabText]}>They Owe Me</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Summary Cards */}
                <View style={styles.summaryRow}>
                    <View style={[styles.summaryCard, { backgroundColor: activeTab === 'debt' ? Colors.danger[50] : Colors.success[50] }]}>
                        <Text style={styles.summaryLabel}>Total {activeTab === 'debt' ? 'Pending' : 'Receivable'}</Text>
                        <Text style={[styles.summaryValue, { color: activeTab === 'debt' ? Colors.danger[600] : Colors.success[600] }]}>
                            {formatCurrency(activeTab === 'debt' ? summary.totalDebt : summary.totalReceivable)}
                        </Text>
                    </View>
                </View>

                {/* Charts */}
                <DebtOverviewCharts pieData={pieData} barData={barData} />

                {/* List */}
                <Text style={styles.sectionTitle}>People</Text>
                {loading ? (
                    <ActivityIndicator size="large" color={Colors.primary[500]} />
                ) : (
                    debts.length > 0 ? (
                        debts.map(item => (
                            <DebtCard
                                key={item.id}
                                item={item}
                                onPress={() => router.push(`/debts/${item.id}`)}
                                onIncrease={() => {/* Handled in detail usually, or add quick action modal */ }}
                                onReduce={() => {/* Handled in detail */ }}
                                onDelete={() => handleDelete(item.id)}
                            />
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No records found.</Text>
                        </View>
                    )
                )}

                <View style={{ height: 80 }} />
            </ScrollView>

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
                <Plus size={32} color="white" />
            </TouchableOpacity>

            {/* Add Modal */}
            <Modal visible={isModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Person</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={24} color={Colors.gray[500]} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="John Doe"
                            value={newName}
                            onChangeText={setNewName}
                        />

                        <Text style={styles.label}>Initial Amount (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="0"
                            keyboardType="numeric"
                            value={newAmount}
                            onChangeText={setNewAmount}
                        />

                        <Text style={styles.label}>Notes</Text>
                        <TextInput
                            style={[styles.input, { height: 80 }]}
                            placeholder="Description..."
                            multiline
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
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.gray[50] },
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
    headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.gray[900] },
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
        fontWeight: '600',
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
    summaryLabel: { fontSize: 14, color: Colors.gray[600], marginBottom: 8 },
    summaryValue: { fontSize: 32, fontWeight: '800' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, marginTop: 8 },
    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyText: { color: Colors.gray[500] },
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
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: Colors.gray[700] },
    input: {
        backgroundColor: Colors.gray[100],
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        fontSize: 16,
    },
    saveBtn: {
        backgroundColor: Colors.primary[600],
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 16,
    },
    saveBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
