
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { useApp } from '../context/AppContext';
import { addAccount, updateAccount, Account } from '../services/database';
import { Plus, X, Pencil } from 'lucide-react-native';
import { formatCurrency } from '../utils/currency';

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
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingTop: 60,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    addBtn: {
        backgroundColor: '#2563eb',
        borderRadius: 20,
        padding: 8,
    },
    card: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        marginBottom: 12,
    },
    accName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
    },
    accType: {
        fontSize: 12,
        color: '#6b7280',
    },
    accBalance: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    input: {
        backgroundColor: '#f3f4f6',
        padding: 14,
        borderRadius: 8,
        marginBottom: 12,
        fontSize: 16,
    },
    saveBtn: {
        backgroundColor: '#2563eb',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    saveText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
