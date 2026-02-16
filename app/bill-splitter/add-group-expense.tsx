
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, User, DollarSign, Calendar as CalendarIcon, Check, Receipt, Trash2 } from 'lucide-react-native';
import { Colors, Layout } from '../../constants/Theme';
import { getGroupMembers, addExpense, getExpenseById, updateExpense, deleteExpense, BillGroupMember, CreateExpenseParams } from '../../services/billSplitter';

import { StyleSheet as RNStyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

export default function AddGroupExpenseScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const groupId = parseInt(params.groupId as string);
    const expenseId = params.id ? parseInt(params.id as string) : null;
    const isEditing = !!expenseId;

    // State
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [paidBy, setPaidBy] = useState<number | null>(null);
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [splitMethod, setSplitMethod] = useState<'equal' | 'custom'>('equal');
    const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
    const [customAmounts, setCustomAmounts] = useState<Record<number, string>>({});
    const [notes, setNotes] = useState('');

    const [members, setMembers] = useState<BillGroupMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, [groupId]);

    const loadData = async () => {
        try {
            const m = await getGroupMembers(groupId);
            setMembers(m);

            if (isEditing && expenseId) {
                const exp = await getExpenseById(expenseId);
                if (exp) {
                    setTitle(exp.title);
                    setAmount(exp.amount.toString());
                    setPaidBy(exp.paid_by_member_id);
                    setDate(new Date(exp.date));
                    setNotes(exp.notes || '');

                    // Setup splits
                    const selectiveMembers = exp.splits.map(s => s.member_id);
                    setSelectedMembers(selectiveMembers);

                    // Check if it was custom split
                    // An equal split might have small rounding diffs, but usually all amounts match perPerson
                    const perPerson = exp.amount / selectiveMembers.length;
                    const isAllEqual = exp.splits.every(s => Math.abs(s.amount - perPerson) < 0.02);

                    if (isAllEqual) {
                        setSplitMethod('equal');
                    } else {
                        setSplitMethod('custom');
                        const amounts: Record<number, string> = {};
                        exp.splits.forEach(s => {
                            amounts[s.member_id] = s.amount.toString();
                        });
                        setCustomAmounts(amounts);
                    }
                }
            } else {
                // Default select all members for new expense
                setSelectedMembers(m.map(member => member.id));
                // Default payer = first member
                if (m.length > 0) setPaidBy(m[0].id);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    // Derived Logic
    const toggleMemberSelection = (id: number) => {
        if (selectedMembers.includes(id)) {
            if (selectedMembers.length === 1) {
                Alert.alert('Error', 'At least one person must be involved in the split');
                return;
            }
            setSelectedMembers(selectedMembers.filter(m => m !== id));
        } else {
            setSelectedMembers([...selectedMembers, id]);
        }
    };

    const handleCustomAmountChange = (id: number, text: string) => {
        setCustomAmounts(prev => ({ ...prev, [id]: text }));
    };

    const totalCustomAmount = useMemo(() => {
        return selectedMembers.reduce((sum, id) => {
            return sum + (parseFloat(customAmounts[id]) || 0);
        }, 0);
    }, [selectedMembers, customAmounts]);

    const parsedAmount = parseFloat(amount) || 0;
    const splitPreview = useMemo(() => {
        if (splitMethod === 'equal') {
            const count = selectedMembers.length;
            if (count === 0) return 0;
            return parsedAmount / count;
        }
        return 0;
    }, [amount, selectedMembers, splitMethod]);

    const isValid = useMemo(() => {
        if (!title.trim()) return false;
        if (parsedAmount <= 0) return false;
        if (!paidBy) return false;
        if (selectedMembers.length === 0) return false;

        if (splitMethod === 'custom') {
            // Allow small rounding Error? No, exact matches for now.
            return Math.abs(totalCustomAmount - parsedAmount) < 0.01;
        }

        return true;
    }, [title, parsedAmount, paidBy, selectedMembers, splitMethod, totalCustomAmount]);

    const handleSave = async () => {
        if (!isValid) return;
        setSaving(true);
        try {
            let splits: { memberId: number; amount: number }[] = [];

            if (splitMethod === 'equal') {
                const perPerson = parsedAmount / selectedMembers.length;
                splits = selectedMembers.map(id => ({
                    memberId: id,
                    amount: parseFloat(perPerson.toFixed(2)) // Round to 2 decimals
                }));
                // Handle remainder penny?
                // Simple approach: add remainder to first person or payer. 
                // Let's re-sum and adjust first person.
                const currentSum = splits.reduce((sum, s) => sum + s.amount, 0);
                const diff = parsedAmount - currentSum;
                if (Math.abs(diff) > 0.001) {
                    splits[0].amount += diff;
                }
            } else {
                splits = selectedMembers.map(id => ({
                    memberId: id,
                    amount: parseFloat(customAmounts[id]) || 0
                }));
            }

            const params: CreateExpenseParams = {
                groupId,
                title,
                amount: parsedAmount,
                paidByMemberId: paidBy!,
                date: date.getTime(),
                notes,
                splits
            };

            if (isEditing && expenseId) {
                await updateExpense(expenseId, params);
            } else {
                await addExpense(params);
            }
            router.back();
        } catch (e) {
            Alert.alert('Error', 'Failed to save expense');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!expenseId) return;

        Alert.alert(
            "Delete Expense",
            "Are you sure you want to delete this expense?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setSaving(true);
                            await deleteExpense(expenseId);
                            router.back();
                        } catch (e) {
                            Alert.alert("Error", "Failed to delete expense");
                            setSaving(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary[600]} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={Colors.gray[900]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isEditing ? 'Edit Expense' : 'Add Expense'}</Text>
                {isEditing ? (
                    <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
                        <Trash2 size={22} color={Colors.danger[600]} />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 24 }} />
                )}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Main Input */}
                <View style={styles.mainInputContainer}>
                    <View style={styles.iconCircle}>
                        <Receipt size={24} color={Colors.primary[600]} />
                    </View>
                    <TextInput
                        style={styles.titleInput}
                        placeholder="What is this for?"
                        value={title}
                        onChangeText={setTitle}
                        autoFocus
                    />
                </View>

                <View style={styles.amountSection}>
                    <Text style={styles.currencySymbol}>₹</Text>
                    <TextInput
                        style={styles.amountInput}
                        placeholder="0"
                        keyboardType="numeric"
                        value={amount}
                        onChangeText={setAmount}
                    />
                </View>

                {/* Details */}
                <View style={styles.card}>
                    {/* Paid By */}
                    <View style={styles.row}>
                        <View style={styles.rowLabel}>
                            <User size={20} color={Colors.gray[500]} />
                            <Text style={styles.labelText}>Paid by</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.payerScroll}>
                            {members.map(m => (
                                <TouchableOpacity
                                    key={m.id}
                                    style={[styles.payerChip, paidBy === m.id && styles.payerChipActive]}
                                    onPress={() => setPaidBy(m.id)}
                                >
                                    <Text style={[styles.payerText, paidBy === m.id && styles.payerTextActive]}>
                                        {m.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={styles.divider} />

                    {/* Date */}
                    <TouchableOpacity style={styles.row} onPress={() => setShowDatePicker(true)}>
                        <View style={styles.rowLabel}>
                            <CalendarIcon size={20} color={Colors.gray[500]} />
                            <Text style={styles.labelText}>Date</Text>
                        </View>
                        <View style={styles.dateValue}>
                            <Text style={styles.dateText}>{format(date, 'MMM d, yyyy')}</Text>
                        </View>
                    </TouchableOpacity>
                    {showDatePicker && (
                        <DateTimePicker
                            value={date}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event, selectedDate) => {
                                setShowDatePicker(false);
                                if (selectedDate) setDate(selectedDate);
                            }}
                        />
                    )}
                </View>

                {/* Split Section */}
                <Text style={styles.sectionHeader}>Split</Text>
                <View style={styles.card}>
                    <View style={styles.splitToggle}>
                        <TouchableOpacity
                            style={[styles.toggleBtn, splitMethod === 'equal' && styles.toggleBtnActive]}
                            onPress={() => setSplitMethod('equal')}
                        >
                            <Text style={[styles.toggleText, splitMethod === 'equal' && styles.toggleTextActive]}>Equally</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.toggleBtn, splitMethod === 'custom' && styles.toggleBtnActive]}
                            onPress={() => setSplitMethod('custom')}
                        >
                            <Text style={[styles.toggleText, splitMethod === 'custom' && styles.toggleTextActive]}>Unequally</Text>
                        </TouchableOpacity>
                    </View>

                    {members.map(member => {
                        const isSelected = selectedMembers.includes(member.id);
                        return (
                            <View key={member.id} style={styles.memberRow}>
                                <TouchableOpacity
                                    style={styles.memberCheck}
                                    onPress={() => toggleMemberSelection(member.id)}
                                >
                                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                                        {isSelected && <Check size={14} color="white" />}
                                    </View>
                                    <Text style={styles.memberName}>{member.name}</Text>
                                </TouchableOpacity>

                                {isSelected && (
                                    <View style={styles.memberAmount}>
                                        {splitMethod === 'equal' ? (
                                            <Text style={styles.splitAmountText}>₹{splitPreview.toFixed(2)}</Text>
                                        ) : (
                                            <View style={styles.customInputContainer}>
                                                <Text style={styles.currencyPrefix}>₹</Text>
                                                <TextInput
                                                    style={styles.customInput}
                                                    placeholder="0"
                                                    keyboardType="numeric"
                                                    value={customAmounts[member.id] || ''}
                                                    onChangeText={(text) => handleCustomAmountChange(member.id, text)}
                                                />
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })}

                    {splitMethod === 'custom' && (
                        <View style={styles.validationRow}>
                            <Text style={[styles.validationText, isValid ? styles.valid : styles.invalid]}>
                                Total: ₹{totalCustomAmount.toFixed(2)} / ₹{parsedAmount.toFixed(2)}
                            </Text>
                            {!isValid && parsedAmount > 0 && Math.abs(totalCustomAmount - parsedAmount) > 0.01 && (
                                <Text style={styles.errorText}>
                                    {totalCustomAmount > parsedAmount
                                        ? `Over by ₹${(totalCustomAmount - parsedAmount).toFixed(2)}`
                                        : `Short by ₹${(parsedAmount - totalCustomAmount).toFixed(2)}`}
                                </Text>
                            )}
                        </View>
                    )}
                </View>

            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.saveBtn, (!isValid || saving) && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!isValid || saving}
                >
                    {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>Save Expense</Text>}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.gray[50] },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: Colors.white,
    },
    backBtn: { padding: 4, marginLeft: -4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.gray[900], flex: 1, textAlign: 'center' },
    deleteBtn: { padding: 4, marginRight: -4 },
    scrollContent: { padding: 20, paddingBottom: 100 },
    mainInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    titleInput: {
        flex: 1,
        fontSize: 20,
        fontWeight: '600',
        color: Colors.gray[900],
    },
    amountSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    currencySymbol: {
        fontSize: 32,
        fontWeight: '700',
        color: Colors.gray[400],
        marginRight: 8,
    },
    amountInput: {
        fontSize: 48,
        fontWeight: '700',
        color: Colors.gray[900],
        minWidth: 100,
    },
    card: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        ...Layout.shadows.sm,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    rowLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 100,
    },
    labelText: {
        fontSize: 16,
        color: Colors.gray[600],
        marginLeft: 12,
        fontWeight: '500',
    },
    payerScroll: {
        alignItems: 'center',
    },
    payerChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: Colors.gray[100],
        marginRight: 8,
    },
    payerChipActive: {
        backgroundColor: Colors.primary[100],
    },
    payerText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.gray[600],
    },
    payerTextActive: {
        color: Colors.primary[700],
    },
    divider: {
        height: 1,
        backgroundColor: Colors.gray[100],
        marginVertical: 12,
    },
    dateValue: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: Colors.gray[50],
        borderRadius: 8,
    },
    dateText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.gray[900],
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.gray[900],
        marginBottom: 12,
        marginLeft: 4,
    },
    splitToggle: {
        flexDirection: 'row',
        backgroundColor: Colors.gray[100],
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
    },
    toggleBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    toggleBtnActive: {
        backgroundColor: Colors.white,
        ...Layout.shadows.sm,
    },
    toggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.gray[500],
    },
    toggleTextActive: {
        color: Colors.gray[900],
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[50],
    },
    memberCheck: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: Colors.gray[300],
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: Colors.primary[600],
        borderColor: Colors.primary[600],
    },
    memberName: {
        fontSize: 16,
        color: Colors.gray[900],
        fontWeight: '500',
    },
    memberAmount: {
        minWidth: 80,
        alignItems: 'flex-end',
    },
    splitAmountText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.gray[900],
    },
    customInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.gray[50],
        borderRadius: 8,
        paddingHorizontal: 8,
        width: 100,
    },
    currencyPrefix: {
        fontSize: 14,
        color: Colors.gray[500],
        marginRight: 4,
    },
    customInput: {
        flex: 1,
        paddingVertical: 8,
        fontSize: 16,
        fontWeight: '600',
        color: Colors.gray[900],
        textAlign: 'right',
    },
    validationRow: {
        marginTop: 16,
        alignItems: 'center',
    },
    validationText: {
        fontSize: 14,
        fontWeight: '600',
    },
    valid: { color: Colors.success[600] },
    invalid: { color: Colors.danger[600] },
    errorText: {
        fontSize: 12,
        color: Colors.danger[500],
        marginTop: 4,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.white,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: Colors.gray[100],
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    saveBtn: {
        backgroundColor: Colors.primary[600],
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
    },
    saveBtnDisabled: {
        backgroundColor: Colors.gray[300],
    },
    saveBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
