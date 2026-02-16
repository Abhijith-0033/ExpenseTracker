
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import { updateTransaction, deleteTransaction } from '../services/database';
import { Keypad } from '../components/ui/Keypad';
import { CategoryPicker } from '../components/CategoryPicker';
import { Calendar as CalendarIcon, Wallet as WalletIcon, Tag as TagIcon, Trash2 } from 'lucide-react-native';
import { format } from 'date-fns';

export default function EditTransactionScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { transactions, accounts, refreshData } = useApp();

    // State
    const [loading, setLoading] = useState(true);
    const [originalTx, setOriginalTx] = useState<any>(null);

    const [amount, setAmount] = useState('0');
    const [description, setDescription] = useState('');
    const [selectedAccount, setSelectedAccount] = useState<any>(null);
    const [category, setCategory] = useState('');
    const [subcategory, setSubcategory] = useState('');
    const [date, setDate] = useState(new Date());

    const [showCategoryPicker, setShowCategoryPicker] = useState(false);

    useEffect(() => {
        if (id && transactions.length > 0) {
            const tx = transactions.find(t => t.id.toString() === id);
            if (tx) {
                setOriginalTx(tx);
                setAmount(tx.amount.toString());
                setDescription(tx.description || '');
                setCategory(tx.category);
                setSubcategory(tx.subcategory);
                setDate(new Date(tx.date));
                const acc = accounts.find(a => a.id === tx.account_id);
                setSelectedAccount(acc || accounts[0]);
                setLoading(false);
            }
        }
    }, [id, transactions, accounts]);

    const handleKeyPress = (val: string) => {
        if (val === '.') {
            if (!amount.includes('.')) setAmount(prev => prev + val);
        } else {
            setAmount(prev => (prev === '0' ? val : prev + val));
        }
    };

    const handleDeleteKey = () => setAmount(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));

    const handleSave = async () => {
        if (!selectedAccount || !category) return;

        try {
            // Use the new atomic updateTransaction service to prevent data loss
            await updateTransaction(originalTx.id, {
                amount: parseFloat(amount),
                category,
                subcategory,
                account_id: selectedAccount.id,
                date: date.toISOString(),
                description
            });

            await refreshData();
            router.back();
        } catch (e) {
            Alert.alert('Error', 'Failed to update transaction');
        }
    };

    const handleDeleteTx = async () => {
        Alert.alert('Confirm Delete', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    // Include category to ensure proper balance reversal
                    await deleteTransaction(originalTx.id, originalTx.account_id, originalTx.amount, originalTx.category);
                    await refreshData();
                    router.back();
                }
            }
        ]);
    };

    if (loading) return <ActivityIndicator style={{ marginTop: 50 }} />;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Edit Expense</Text>
                <TouchableOpacity onPress={handleDeleteTx}>
                    <Trash2 size={24} color="#ef4444" />
                </TouchableOpacity>
            </View>

            <View style={styles.display}>
                <Text style={styles.currency}>₹</Text>
                <Text style={styles.amount}>{amount}</Text>
            </View>

            <View style={styles.formContainer}>
                {/* Date Row */}
                <View style={styles.row}>
                    <TouchableOpacity style={styles.selector}>
                        <CalendarIcon size={20} color="#6b7280" />
                        <Text style={styles.selectorText}>{format(date, 'MMM dd, yyyy')}</Text>
                    </TouchableOpacity>
                </View>
                {/* Category Row */}
                <View style={styles.row}>
                    <TouchableOpacity style={[styles.selector, { flex: 1 }]} onPress={() => setShowCategoryPicker(true)}>
                        <TagIcon size={20} color="#6b7280" />
                        <Text style={styles.selectorText}>
                            {category ? `${category} - ${subcategory}` : 'Select Category'}
                        </Text>
                    </TouchableOpacity>
                </View>
                {/* Account Row */}
                <View style={styles.row}>
                    <TouchableOpacity
                        style={[styles.selector, { flex: 1 }]}
                        onPress={() => {
                            if (accounts.length > 0) {
                                const idx = accounts.findIndex(a => a.id === selectedAccount?.id);
                                const next = accounts[(idx + 1) % accounts.length];
                                setSelectedAccount(next);
                            }
                        }}
                    >
                        <WalletIcon size={20} color="#6b7280" />
                        <Text style={styles.selectorText}>
                            {selectedAccount ? selectedAccount.name : 'Select Account'}
                        </Text>
                    </TouchableOpacity>
                </View>
                {/* Note Row */}
                <View style={styles.row}>
                    <TextInput
                        placeholder="Add a note (optional)"
                        value={description}
                        onChangeText={setDescription}
                        style={styles.input}
                    />
                </View>
            </View>

            <View style={{ flex: 1 }} />

            <Keypad onPress={handleKeyPress} onDelete={handleDeleteKey} onClear={() => setAmount('0')} onSubmit={handleSave} />

            <TouchableOpacity style={styles.submitBtn} onPress={handleSave}>
                <Text style={styles.submitText}>Update Transaction</Text>
            </TouchableOpacity>

            <CategoryPicker
                visible={showCategoryPicker}
                onClose={() => setShowCategoryPicker(false)}
                onSelect={(cat, sub) => {
                    setCategory(cat);
                    setSubcategory(sub);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingTop: 0 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingTop: 60,
        backgroundColor: '#fff',
    },
    title: { fontSize: 20, fontWeight: 'bold' },
    display: {
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
    },
    currency: { fontSize: 32, color: '#9ca3af', marginRight: 4 },
    amount: { fontSize: 48, fontWeight: 'bold', color: '#1f2937' },
    formContainer: { padding: 16 },
    row: { marginBottom: 12, flexDirection: 'row' },
    selector: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, marginRight: 8,
    },
    selectorText: { marginLeft: 8, fontSize: 16, color: '#1f2937' },
    input: { flex: 1, backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, fontSize: 16 },
    submitBtn: { backgroundColor: '#2563eb', padding: 16, alignItems: 'center', justifyContent: 'center' },
    submitText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
