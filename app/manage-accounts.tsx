
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { useApp } from '../context/AppContext';
import { addAccount, updateAccount, Account } from '../services/database';
import { Plus, X, Pencil } from 'lucide-react-native';
import { formatCurrency } from '../utils/currency';
import { Colors, Layout, Typography } from '../constants/Theme';

export default function ManageAccountsScreen() {
    const { accounts, refreshData } = useApp();
    const [modalVisible, setModalVisible] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [balance, setBalance] = useState('');
    const [type, setType] = useState('General');

    const openAdd = () => {
        setEditingAccount(null);
        setName('');
        setBalance('');
        setType('General');
        setModalVisible(true);
    };

    const openEdit = (acc: Account) => {
        setEditingAccount(acc);
        setName(acc.name);
        setBalance(acc.balance.toString());
        setType(acc.type);
        setModalVisible(true);
    };

    const handleSave = async () => {
        const bal = parseFloat(balance);
        if (!name || isNaN(bal)) {
            Alert.alert('Invalid Input', 'Name and valid numeric balance required.');
            return;
        }

        try {
            if (editingAccount) {
                await updateAccount(editingAccount.id, name, bal, type);
            } else {
                await addAccount(name, bal, type);
            }
            await refreshData();
            setModalVisible(false);
        } catch (e) {
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

                        <TextInput
                            placeholder="Account Name (e.g., Bank)"
                            value={name}
                            onChangeText={setName}
                            style={styles.input}
                        />
                        <TextInput
                            placeholder="Current Balance"
                            value={balance}
                            onChangeText={setBalance}
                            keyboardType="numeric"
                            style={styles.input}
                        />
                        <TextInput
                            placeholder="Type (General, Cash, Savings)"
                            value={type}
                            onChangeText={setType}
                            style={styles.input}
                        />

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
        marginTop: 4,
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
});
