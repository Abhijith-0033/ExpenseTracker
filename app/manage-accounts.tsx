
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { useApp } from '../context/AppContext';
import { addAccount, updateAccount, Account, checkTransactionsExistForAccount, deleteAccount } from '../services/database';
import { ConfirmActionSheet, ConfirmActionType } from '../components/ConfirmActionSheet';
import { Plus, X, Pencil, Lock, Trash2 } from 'lucide-react-native';
import { formatCurrency } from '../utils/currency';
import { Colors, Layout, Typography } from '../constants/Theme';
import { useRouter } from 'expo-router';
import { useSubscription } from '../src/subscription/useSubscription';

export default function ManageAccountsScreen() {
    const router = useRouter();
    const { accounts, refreshData } = useApp();
    const { isPremium, isTrialActive } = useSubscription();
    const isFreeUser = !isPremium && !isTrialActive;

    const [modalVisible, setModalVisible] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [confirmSheet, setConfirmSheet] = useState<{
        title: string;
        description: string;
        confirmLabel: string;
        actionType: ConfirmActionType;
        onConfirm: () => void;
    } | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [balance, setBalance] = useState('');
    const [type, setType] = useState('General');

    const openAdd = () => {
        if (isFreeUser && accounts.length >= 1) {
            router.push('/paywall');
            return;
        }
        setEditingAccount(null);
        setName('');
        setBalance('');
        setType('General');
        setErrors({});
        setModalVisible(true);
    };

    const openEdit = (acc: Account) => {
        setEditingAccount(acc);
        setName(acc.name);
        setBalance(acc.balance.toString());
        setType(acc.type);
        setErrors({});
        setModalVisible(true);
    };

    const handleDelete = async (account: Account) => {
        try {
            const hasTransactions = await checkTransactionsExistForAccount(account.id);
            if (hasTransactions) {
                setConfirmSheet({
                    title: 'Cannot Delete Account',
                    description: 'There are transactions associated with this account. Please reassign or delete them first.',
                    confirmLabel: 'OK',
                    actionType: 'warning',
                    onConfirm: () => setConfirmSheet(null)
                });
                return;
            }
            
            setConfirmSheet({
                title: 'Delete Account?',
                description: `Are you sure you want to delete "${account.name}"? This action cannot be undone.`,
                confirmLabel: 'Delete',
                actionType: 'delete',
                onConfirm: async () => {
                    setConfirmSheet(null);
                    await deleteAccount(account.id);
                    await refreshData();
                }
            });
        } catch (_e) {
            Alert.alert("Error", "Failed to check account transactions");
        }
    };

    const handleSave = async () => {
        const bal = parseFloat(balance);
        const newErrors: Record<string, string> = {};
        if (!name) newErrors.name = 'Account name is required';
        if (isNaN(bal)) newErrors.balance = 'Valid balance is required';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setErrors({});

        try {
            if (editingAccount) {
                await updateAccount(editingAccount.id, name, bal, type);
            } else {
                await addAccount(name, bal, type);
            }
            await refreshData();
            setModalVisible(false);
        } catch (_e) {
            Alert.alert('Error', 'Failed to save account');
        }
    };

    const renderItem = ({ item }: { item: Account }) => (
        <View style={styles.card}>
            <View>
                <Text style={styles.accName}>{item.name}</Text>
                <Text style={styles.accType}>{item.type}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.accBalance}>{formatCurrency(item.balance)}</Text>
                <TouchableOpacity onPress={() => openEdit(item)} style={{ marginTop: 8 }}>
                    <Pencil size={18} color="#2563eb" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Your Accounts</Text>
                <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
                    <Plus size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={accounts}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 16 }}
                ListFooterComponent={
                    isFreeUser ? (
                        <TouchableOpacity 
                            style={styles.lockedCard} 
                            activeOpacity={0.8}
                            onPress={() => router.push('/paywall')}
                        >
                            <Lock size={20} color={Colors.warning[500]} />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.lockedTitle}>Unlock Unlimited Accounts</Text>
                                <Text style={styles.lockedSubtitle}>Free tier is limited to 1 account. Tap to upgrade.</Text>
                            </View>
                            <Text style={styles.upgradeText}>Upgrade →</Text>
                        </TouchableOpacity>
                    ) : null
                }
            />

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingAccount ? 'Edit Account' : 'New Account'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ gap: 16 }}>
                            <TextInput
                                placeholder="Account Name (e.g., Bank)"
                                value={name}
                                onChangeText={(val) => {
                                    setName(val);
                                    if (errors.name) setErrors(prev => ({...prev, name: ''}));
                                }}
                                style={[styles.input, errors.name && { borderColor: Colors.danger[300] }]}
                            />
                            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

                            <TextInput
                                placeholder="Starting Balance"
                                value={balance}
                                onChangeText={(val) => {
                                    setBalance(val);
                                    if (errors.balance) setErrors(prev => ({...prev, balance: ''}));
                                }}
                                keyboardType="numeric"
                                style={[styles.input, errors.balance && { borderColor: Colors.danger[300] }]}
                            />
                            {errors.balance && <Text style={styles.errorText}>{errors.balance}</Text>}

                            <TextInput
                                placeholder="Account Type (e.g., Savings)"
                                value={type}
                                onChangeText={setType}
                                style={styles.input}
                            />
                        </View>

                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                            <Text style={styles.saveText}>Save Account</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingTop: 60,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[100],
    },
    title: {
        fontSize: Typography.size.xxl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    addBtn: {
        backgroundColor: Colors.primary[600],
        borderRadius: 20,
        padding: 8,
    },
    card: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.lg,
        marginBottom: 12,
        ...Layout.shadows.sm,
    },
    accName: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    accType: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.regular,
        color: Colors.gray[500],
        marginTop: 24,
    },
    errorText: {
        fontSize: 12,
        color: Colors.danger[600],
        fontFamily: Typography.family.medium,
        marginTop: -12,
        marginLeft: 4,
    },
    accBalance: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.xl,
        padding: 24,
        ...Layout.shadows.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: Typography.size.xl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    input: {
        backgroundColor: Colors.gray[50],
        padding: 16,
        borderRadius: Layout.radius.lg,
        marginBottom: 16,
        fontSize: Typography.size.md,
        fontFamily: Typography.family.medium,
        color: Colors.gray[900],
        borderWidth: 1,
        borderColor: Colors.gray[100],
    },
    saveBtn: {
        backgroundColor: Colors.primary[600],
        padding: 16,
        borderRadius: Layout.radius.lg,
        alignItems: 'center',
        marginTop: 8,
        ...Layout.shadows.sm,
    },
    saveText: {
        color: Colors.white,
        fontFamily: Typography.family.bold,
        fontSize: Typography.size.md,
    },
    lockedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.warning[50],
        borderWidth: 1,
        borderColor: Colors.warning[200],
        borderRadius: Layout.radius.lg,
        padding: 16,
        marginTop: 8,
        marginBottom: 20,
    },
    lockedTitle: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        color: Colors.warning[700],
    },
    lockedSubtitle: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.medium,
        color: Colors.warning[600],
        marginTop: 2,
        lineHeight: 14,
    },
    upgradeText: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
        color: Colors.warning[700],
    },
});
