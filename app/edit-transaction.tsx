

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, DeviceEventEmitter } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import { updateTransaction, deleteTransaction } from '../services/database';
import { Keypad } from '../components/ui/Keypad';
import { CategoryPicker } from '../components/CategoryPicker';
import { Calendar as CalendarIcon, Wallet as WalletIcon, Tag as TagIcon, Trash2 } from 'lucide-react-native';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Layout } from '../constants/Theme';

export default function EditTransactionScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
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
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

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
        const newErrors: Record<string, string> = {};
        if (!amount || parseFloat(amount) <= 0) newErrors.amount = 'Valid amount is required';
        if (!category) newErrors.category = 'Please select a category';
        if (!selectedAccount) newErrors.account = 'Please select an account';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setErrors({});

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
            DeviceEventEmitter.emit('RECOMPUTE_SATISFACTION');
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
                    DeviceEventEmitter.emit('RECOMPUTE_SATISFACTION');
                    router.back();
                }
            }
        ]);
    };

    if (loading) return <ActivityIndicator style={{ marginTop: 50 }} />;

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 100 }}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={[styles.header, { paddingTop: insets.top || 16 }]}>
                        <Text style={styles.title}>Edit Expense</Text>
                        <TouchableOpacity onPress={handleDeleteTx}>
                            <Trash2 size={24} color="#ef4444" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.display}>
                        <Text style={[styles.currency, errors.amount && { color: Colors.danger[400] }]}>₹</Text>
                        <Text style={[styles.amount, errors.amount && { color: Colors.danger[600] }]}>{amount}</Text>
                        {errors.amount && <Text style={styles.inlineError}>{errors.amount}</Text>}
                    </View>

                    <View style={styles.formContainer}>
                        {/* Date Row */}
                        <View style={styles.row}>
                            <TouchableOpacity style={styles.selector} onPress={() => setShowDatePicker(true)}>
                                <CalendarIcon size={20} color="#6b7280" />
                                <Text style={styles.selectorText}>{format(date, 'MMM dd, yyyy')}</Text>
                            </TouchableOpacity>
                        </View>
                        {/* Category Row */}
                        <View style={styles.row}>
                            <TouchableOpacity style={[styles.selector, { flex: 1 }, errors.category && { borderColor: Colors.danger[300] }]} onPress={() => setShowCategoryPicker(true)}>
                                <TagIcon size={20} color={errors.category ? Colors.danger[600] : "#6b7280"} />
                                <Text style={[styles.selectorText, errors.category && { color: Colors.danger[600] }]}>
                                    {category ? (subcategory ? `${category} - ${subcategory}` : category) : 'Select Category'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        {errors.category && <Text style={styles.pillError}>{errors.category}</Text>}
                        {/* Account Row */}
                        <View style={styles.row}>
                            <TouchableOpacity
                                style={[styles.selector, { flex: 1 }, errors.account && { borderColor: Colors.danger[300] }]}
                                onPress={() => {
                                    if (accounts.length > 0) {
                                        const idx = accounts.findIndex(a => a.id === selectedAccount?.id);
                                        const next = accounts[(idx + 1) % accounts.length];
                                        setSelectedAccount(next);
                                        setErrors(prev => ({...prev, account: ''}));
                                    }
                                }}
                            >
                                <WalletIcon size={20} color={errors.account ? Colors.danger[600] : "#6b7280"} />
                                <Text style={[styles.selectorText, errors.account && { color: Colors.danger[600] }]}>
                                    {selectedAccount ? selectedAccount.name : 'Select Account'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        {errors.account && <Text style={styles.pillError}>{errors.account}</Text>}
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

                    <Keypad onPress={handleKeyPress} onDelete={handleDeleteKey} onClear={() => setAmount('0')} onSubmit={handleSave} />
                </ScrollView>
            </KeyboardAvoidingView>

            <CategoryPicker
                visible={showCategoryPicker}
                onClose={() => setShowCategoryPicker(false)}
                onSelect={(cat, sub) => {
                    setCategory(cat);
                    setSubcategory(sub);
                }}
            />

            {/* Date Picker Modal */}
            {showDatePicker && (
                <DateTimePicker
                    value={date}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                        setShowDatePicker(false);
                        if (selectedDate) setDate(selectedDate);
                    }}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.gray[50] },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingBottom: 20,
    },
    title: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    display: {
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
    },
    currency: { fontSize: Typography.size.xxxl, color: Colors.gray[400], marginRight: 4, fontFamily: Typography.family.bold },
    amount: { fontSize: 48, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    formContainer: { padding: 16 },
    row: { marginBottom: 12, flexDirection: 'row' },
    selector: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.white, padding: 16, borderRadius: Layout.radius.lg, marginRight: 8,
        ...Layout.shadows.sm,
    },
    selectorText: { marginLeft: 12, fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[800] },
    input: { padding: 16, backgroundColor: 'white', borderRadius: 16, fontSize: 16, color: '#1f2937', borderWidth: 1, borderColor: '#e5e7eb' },
    inlineError: {
        fontSize: 12,
        color: Colors.danger[600],
        fontFamily: Typography.family.medium,
        marginTop: 4,
        textAlign: 'center',
    },
    pillError: {
        fontSize: 10,
        color: Colors.danger[600],
        fontFamily: Typography.family.bold,
        marginTop: -8,
        marginBottom: 12,
        marginLeft: 16,
    },
});
