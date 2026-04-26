
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, Layout, Typography } from '../constants/Theme';
import { BudgetStatus, getBudgetStatus, getBudgets, setBudget, deleteBudget, Budget } from '../services/budgets';
import { getCategories, CategoryNode } from '../services/database';
import { BudgetCard } from '../components/BudgetCard';
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { format, addMonths, subMonths } from 'date-fns';

export default function BudgetsScreen() {
    const router = useRouter();
    const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
    const [categories, setCategories] = useState<CategoryNode[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [modalVisible, setModalVisible] = useState(false);

    // Form State
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [budgetAmount, setBudgetAmount] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    const loadData = async () => {
        const [status, cats] = await Promise.all([
            getBudgetStatus(selectedMonth),
            getCategories()
        ]);
        setBudgets(status);
        setCategories(cats);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [selectedMonth])
    );

    const handleSave = async () => {
        if (!selectedCategory || !budgetAmount) return;
        const amount = parseFloat(budgetAmount);
        if (isNaN(amount) || amount <= 0) return;

        const monthStr = selectedMonth.toISOString().slice(0, 7);
        await setBudget(selectedCategory, amount, monthStr);
        setModalVisible(false);
        setBudgetAmount('');
        setSelectedCategory('');
        setIsEditing(false);
        loadData();
    };

    const handleEdit = (category: string, amount: number) => {
        setSelectedCategory(category);
        setBudgetAmount(amount.toString());
        setIsEditing(true);
        setModalVisible(true);
    };

    const handleDelete = async (category: string) => {
        // Need to find the ID first, but for now we can just find it in the list if we stored IDs, 
        // OR we can make deleteBudget take month + category. 
        // Since deleteBudget takes ID, let's fetch the list first to find ID.
        // Optimization: Pass ID in BudgetStatus
        const monthStr = selectedMonth.toISOString().slice(0, 7);
        const allBudgets = await getBudgets(monthStr);
        const budget = allBudgets.find(b => b.category === category);
        if (budget) {
            await deleteBudget(budget.id);
            loadData();
        }
    };

    const openAddModal = () => {
        setIsEditing(false);
        setSelectedCategory(categories.length > 0 ? categories[0].name : '');
        setBudgetAmount('');
        setModalVisible(true);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={24} color={Colors.gray[900]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Monthly Budgets</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.monthSelector}>
                <TouchableOpacity onPress={() => setSelectedMonth(subMonths(selectedMonth, 1))}>
                    <ChevronLeft size={20} color={Colors.gray[600]} />
                </TouchableOpacity>
                <Text style={styles.monthText}>{format(selectedMonth, 'MMMM yyyy')}</Text>
                <TouchableOpacity onPress={() => setSelectedMonth(addMonths(selectedMonth, 1))}>
                    <ChevronRight size={20} color={Colors.gray[600]} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {budgets.length > 0 ? (
                    budgets.map((item) => (
                        <BudgetCard
                            key={item.category}
                            data={item}
                            onEdit={handleEdit}
                            onDelete={() => handleDelete(item.category)}
                        />
                    ))
                ) : (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No budgets set for this month</Text>
                        <Text style={styles.emptySub}>Tap + to start planning</Text>
                    </View>
                )}
            </ScrollView>

            <TouchableOpacity style={styles.fab} onPress={openAddModal}>
                <Plus size={32} color="white" />
            </TouchableOpacity>

            <Modal visible={modalVisible} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{isEditing ? 'Edit Budget' : 'New Budget'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={24} color={Colors.gray[500]} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Category</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                            {categories.map(cat => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[styles.catChip, selectedCategory === cat.name && styles.catChipActive]}
                                    onPress={() => !isEditing && setSelectedCategory(cat.name)} // Disable changing category in edit mode
                                    disabled={isEditing}
                                >
                                    <Text style={[styles.catText, selectedCategory === cat.name && styles.catTextActive]}>{cat.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.label}>Monthly Limit</Text>
                        <TextInput
                            style={styles.input}
                            value={budgetAmount}
                            onChangeText={setBudgetAmount}
                            keyboardType="numeric"
                            placeholder="0.00"
                            placeholderTextColor={Colors.gray[400]}
                            autoFocus
                        />

                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                            <Text style={styles.saveBtnText}>Save Budget</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
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
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Layout.spacing.md,
        paddingTop: 60,
        paddingBottom: Layout.spacing.md,
        backgroundColor: Colors.white,
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: Typography.size.xl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    monthSelector: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[100],
    },
    monthText: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        width: 150,
        textAlign: 'center',
        color: Colors.gray[800],
    },
    content: {
        padding: Layout.spacing.md,
        paddingBottom: 100,
    },
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
        ...Layout.shadows.lg,
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
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: Typography.size.xl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    label: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        color: Colors.gray[700],
        marginBottom: 8,
    },
    catScroll: {
        flexDirection: 'row',
        marginBottom: 24,
        maxHeight: 40,
    },
    catChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: Colors.gray[100],
        marginRight: 8,
    },
    catChipActive: {
        backgroundColor: Colors.primary[100],
        borderWidth: 1,
        borderColor: Colors.primary[500],
    },
    catText: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.medium,
        color: Colors.gray[700],
    },
    catTextActive: {
        color: Colors.primary[700],
        fontFamily: Typography.family.bold,
    },
    input: {
        backgroundColor: Colors.gray[50],
        borderRadius: 12,
        padding: 16,
        fontSize: Typography.size.xxl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        marginBottom: 24,
    },
    saveBtn: {
        backgroundColor: Colors.primary[600],
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
    },
    saveBtnText: {
        color: Colors.white,
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 60,
    },
    emptyText: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.gray[600],
        marginBottom: 8,
    },
    emptySub: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.medium,
        color: Colors.gray[400],
    }
});
