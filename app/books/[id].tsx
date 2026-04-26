
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator, Share } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, X, Trash2, Edit2, Calendar, Share2 } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../../constants/Theme';
import { useApp } from '../../context/AppContext';
import { getBookById, getBookItems, addBookItem, deleteBookItem, updateBookItem, getBookSummary, ExpenseBook, BookItem, deleteBook, updateBook } from '../../services/books';
import { BookCharts } from '../../components/BookCharts';
import { formatCurrency } from '../../utils/currency';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { playExpenseSound, playIncomeSound } from '../../services/SoundService';

export default function BookDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [book, setBook] = useState<ExpenseBook | null>(null);
    const [items, setItems] = useState<BookItem[]>([]);
    const [summary, setSummary] = useState({ totalSpent: 0, totalIncome: 0, itemCount: 0, budget: 0, progress: 0 });
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    // Item Modal
    const [itemModalVisible, setItemModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<BookItem | null>(null);
    const [itemName, setItemName] = useState('');
    const [itemAmount, setItemAmount] = useState('');
    const [itemNotes, setItemNotes] = useState('');
    const [itemType, setItemType] = useState<'expense' | 'income'>('expense');
    const [itemSourceId, setItemSourceId] = useState<number | null>(null);

    const { incomeSources, soundEnabled } = useApp() as any; // Assuming useApp provides incomeSources

    // Book Edit Modal
    const [bookModalVisible, setBookModalVisible] = useState(false);
    const [bookName, setBookName] = useState('');
    const [bookDesc, setBookDesc] = useState('');
    const [bookBudget, setBookBudget] = useState('');

    const fetchData = async () => {
        if (!id) return;
        try {
            const bookData = await getBookById(Number(id));
            const itemsData = await getBookItems(Number(id));
            const summaryData = await getBookSummary(Number(id));

            setBook(bookData);
            setItems(itemsData);
            setSummary(summaryData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchData();
        }, [id])
    );

    const handleSaveItem = async () => {
        if (!itemName.trim() || !itemAmount) {
            Alert.alert('Error', 'Name and Amount are required');
            return;
        }
        try {
            if (editingItem) {
                await updateBookItem(editingItem.id, itemName, parseFloat(itemAmount), itemNotes, editingItem.date, itemType, itemSourceId);
            } else {
                await addBookItem(Number(id), itemName, parseFloat(itemAmount), itemNotes, Date.now(), itemType, itemSourceId);
                // Sound Feedback on creation
                if (itemType === 'income') playIncomeSound(soundEnabled);
                else playExpenseSound(soundEnabled);
            }
            setItemModalVisible(false);
            resetItemForm();
            fetchData();
        } catch (e) {
            Alert.alert('Error', 'Failed to save item');
        }
    };

    const handleDeleteItem = (itemId: number) => {
        Alert.alert('Delete Item', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    await deleteBookItem(itemId);
                    fetchData();
                }
            }
        ]);
    };

    const handleEditBook = async () => {
        if (!bookName.trim()) {
            Alert.alert('Error', 'Name is required');
            return;
        }
        try {
            await updateBook(Number(id), bookName, bookDesc, parseFloat(bookBudget) || 0);
            setBookModalVisible(false);
            fetchData();
        } catch (e) {
            Alert.alert('Error', 'Update failed');
        }
    }

    const handleDeleteBook = () => {
        Alert.alert('Delete Project', 'This will delete the project and all its items. This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    await deleteBook(Number(id));
                    router.back();
                }
            }
        ]);
    };

    const openEditBook = () => {
        if (!book) return;
        setBookName(book.name);
        setBookDesc(book.description || '');
        setBookBudget(book.budget ? book.budget.toString() : '');
        setBookModalVisible(true);
    }

    const resetItemForm = () => {
        setEditingItem(null);
        setItemName('');
        setItemAmount('');
        setItemNotes('');
        setItemType('expense');
        setItemSourceId(null);
    };

    const openEditItem = (item: BookItem) => {
        setEditingItem(item);
        setItemName(item.name);
        setItemAmount(item.amount.toString());
        setItemNotes(item.notes || '');
        setItemType(item.type || 'expense');
        setItemSourceId(item.income_source_id || null);
        setItemModalVisible(true);
    };

    const handleExport = async () => {
        if (!book || items.length === 0) {
            Alert.alert('No Data', 'Nothing to export yet.');
            return;
        }

        setExporting(true);
        try {
            // Data Separation & Calculations
            const expenseItems = items.filter(i => (i as any).type !== 'income');
            const incomeItems = items.filter(i => (i as any).type === 'income');

            const totalExpenses = expenseItems.reduce((sum, i) => sum + i.amount, 0);
            const totalIncome = incomeItems.reduce((sum, i) => sum + i.amount, 0);
            const netBalance = totalIncome - totalExpenses;

            const html = `
                <html>
                  <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                    <style>
                      body { font-family: -apple-system, HelveticaNeue, Helvetica, Arial, sans-serif; padding: 30px; color: #333; line-height: 1.5; }
                      .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
                      h1 { margin: 0; color: #111; font-size: 28px; }
                      .description { color: #666; margin-top: 5px; font-size: 14px; }
                      .meta { color: #999; font-size: 12px; margin-top: 10px; }
                      
                      .summary-container { display: flex; gap: 20px; margin-bottom: 40px; }
                      .summary-box { flex: 1; padding: 15px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; }
                      .summary-label { font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 5px; }
                      .summary-value { font-size: 20px; font-weight: bold; font-family: monospace; }
                      .balance-box { background: ${netBalance >= 0 ? '#f0fdf4' : '#fef2f2'}; border-color: ${netBalance >= 0 ? '#bbf7d0' : '#fecaca'}; }
                      .balance-value { color: ${netBalance >= 0 ? '#16a34a' : '#dc2626'}; }

                      .section-header { font-size: 18px; font-weight: bold; margin-top: 30px; margin-bottom: 15px; display: flex; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
                      .expense-header { color: #dc2626; }
                      .income-header { color: #16a34a; }

                      table { width: 100%; border-collapse: collapse; }
                      th { text-align: left; background: #f8fafc; padding: 10px; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
                      td { padding: 10px; font-size: 13px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
                      .amount-cell { text-align: right; font-weight: bold; font-family: monospace; white-space: nowrap; }
                      .footer-row { background: #f8fafc; font-weight: bold; }
                      .notes { color: #94a3b8; font-size: 11px; display: block; margin-top: 2px; }
                      .empty-msg { padding: 20px; text-align: center; color: #94a3b8; font-style: italic; border: 1px dashed #e2e8f0; border-radius: 8px; margin-top: 10px; }
                    </style>
                  </head>
                  <body>
                    <div class="header">
                      <h1>${book.name}</h1>
                      ${book.description ? `<p class="description">${book.description}</p>` : ''}
                      <p class="meta">Generated: ${new Date().toLocaleDateString()} • ${new Date().toLocaleTimeString()}</p>
                    </div>

                    <div class="summary-container">
                      <div class="summary-box">
                        <div class="summary-label">Total Expense</div>
                        <div class="summary-value" style="color: #dc2626">${formatCurrency(totalExpenses)}</div>
                      </div>
                      <div class="summary-box">
                        <div class="summary-label">Total Income</div>
                        <div class="summary-value" style="color: #16a34a">${formatCurrency(totalIncome)}</div>
                      </div>
                      <div class="summary-box balance-box">
                        <div class="summary-label">Net Balance</div>
                        <div class="summary-value balance-value">${formatCurrency(netBalance)}</div>
                      </div>
                    </div>

                    <div class="section-header expense-header">📉 Expenses</div>
                    ${expenseItems.length > 0 ? `
                    <table>
                      <thead>
                        <tr>
                          <th style="width: 15%">Date</th>
                          <th style="width: 55%">Description</th>
                          <th style="width: 30%" class="amount-cell">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${expenseItems.map(item => `
                          <tr>
                            <td>${new Date(item.date).toLocaleDateString()}</td>
                            <td>
                              ${item.name}
                              ${item.notes ? `<span class="notes">${item.notes}</span>` : ''}
                            </td>
                            <td class="amount-cell">${formatCurrency(item.amount)}</td>
                          </tr>
                        `).join('')}
                        <tr class="footer-row">
                          <td colspan="2">Total Expense</td>
                          <td class="amount-cell" style="color: #dc2626">${formatCurrency(totalExpenses)}</td>
                        </tr>
                      </tbody>
                    </table>
                    ` : '<div class="empty-msg">No expense entries recorded.</div>'}

                    <div class="section-header income-header">📈 Income</div>
                    ${incomeItems.length > 0 ? `
                    <table>
                      <thead>
                        <tr>
                          <th style="width: 15%">Date</th>
                          <th style="width: 55%">Source / Item</th>
                          <th style="width: 30%" class="amount-cell">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${incomeItems.map(item => {
                const source = incomeSources?.find((s: any) => s.id === item.income_source_id);
                const sourceName = source ? source.name : 'Unknown Source';
                return `
                              <tr>
                                <td>${new Date(item.date).toLocaleDateString()}</td>
                                <td>
                                  ${item.name} <span class="notes">(${sourceName})</span>
                                  ${item.notes ? `<span class="notes">${item.notes}</span>` : ''}
                                </td>
                                <td class="amount-cell">${formatCurrency(item.amount)}</td>
                              </tr>
                            `;
            }).join('')}
                        <tr class="footer-row">
                          <td colspan="2">Total Income</td>
                          <td class="amount-cell" style="color: #16a34a">${formatCurrency(totalIncome)}</td>
                        </tr>
                      </tbody>
                    </table>
                    ` : '<div class="empty-msg">No income entries recorded.</div>'}

                  </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            } else {
                Alert.alert("Sharing not available", "Sharing is not supported on this device.");
            }

        } catch (error) {
            console.error('Export failed', error);
            Alert.alert("Export Failed", "Could not generate PDF.");
        } finally {
            setExporting(false);
        }
    };

    if (loading || !book) {
        return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary[500]} /></View>;
    }

    // @ts-ignore
    const { progress, budget, totalSpent, totalIncome } = summary;
    const isOverBudget = budget > 0 && totalSpent > budget;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                    <ArrowLeft size={24} color={Colors.gray[900]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{book.name}</Text>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={handleExport} style={styles.iconBtn} disabled={exporting}>
                        {exporting ? <ActivityIndicator size="small" color={Colors.gray[900]} /> : <Share2 size={20} color={Colors.gray[900]} />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={openEditBook} style={styles.iconBtn}>
                        <Edit2 size={20} color={Colors.gray[900]} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}>
                {/* Hero Section */}
                <LinearGradient
                    colors={isOverBudget ? [Colors.danger[500], Colors.danger[700]] : [Colors.primary[600], Colors.primary[800]]}
                    style={styles.hero}
                >
                    <View style={styles.summaryRow}>
                        <View style={styles.summaryCol}>
                            <Text style={styles.heroLabel}>Total Spent</Text>
                            <Text style={styles.heroAmount}>{formatCurrency(totalSpent)}</Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryCol}>
                            <Text style={styles.heroLabel}>Total Income</Text>
                            <Text style={[styles.heroAmount, { color: '#86efac' }]}>{formatCurrency(totalIncome)}</Text>
                        </View>
                    </View>

                    {budget > 0 && (
                        <View style={styles.budgetContainer}>
                            <View style={styles.budgetRow}>
                                <Text style={styles.budgetText}>Budget: {formatCurrency(budget)}</Text>
                                <Text style={styles.budgetText}>{Math.round(progress * 100)}%</Text>
                            </View>
                            <View style={styles.progressTrack}>
                                <View style={[
                                    styles.progressBar,
                                    { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: isOverBudget ? 'white' : Colors.warning[400] }
                                ]} />
                            </View>
                            {isOverBudget && (
                                <Text style={styles.overBudgetWarning}>
                                    ⚠️ Over budget by {formatCurrency(totalSpent - budget)}
                                </Text>
                            )}
                        </View>
                    )}

                    <TouchableOpacity style={styles.deleteBookBtn} onPress={handleDeleteBook}>
                        <Text style={styles.deleteBookText}>Delete Project</Text>
                    </TouchableOpacity>
                </LinearGradient>

                {/* Charts */}
                <BookCharts items={items} />

                {/* Items List */}
                <View style={styles.listHeader}>
                    <Text style={styles.sectionTitle}>Items ({items.length})</Text>
                </View>

                {items.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No expenses added yet.</Text>
                    </View>
                ) : (
                    items.map((item) => (
                        <View key={item.id} style={styles.itemCard}>
                            <View style={styles.itemRow}>
                                <View style={styles.itemInfo}>
                                    <View style={styles.itemNameRow}>
                                        <Text style={styles.itemName}>{item.name}</Text>
                                        {item.type === 'income' && (
                                            <View style={styles.incomeBadge}>
                                                <Text style={styles.incomeBadgeText}>Income</Text>
                                            </View>
                                        )}
                                    </View>
                                    {item.notes ? <Text style={styles.itemNotes} numberOfLines={1}>{item.notes}</Text> : null}
                                    <View style={styles.dateRow}>
                                        <Calendar size={12} color={Colors.gray[400]} />
                                        <Text style={styles.itemDate}>{new Date(item.date).toLocaleDateString()}</Text>
                                    </View>
                                </View>
                                <View style={styles.itemRight}>
                                    <Text style={[styles.itemAmount, item.type === 'income' && { color: Colors.success[600] }]}>
                                        {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                                    </Text>
                                    <View style={styles.itemActions}>
                                        <TouchableOpacity style={styles.actionBtn} onPress={() => openEditItem(item)}>
                                            <Edit2 size={16} color={Colors.gray[400]} />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteItem(item.id)}>
                                            <Trash2 size={16} color={Colors.gray[400]} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={() => { resetItemForm(); setItemModalVisible(true); }}>
                <Plus size={32} color="white" />
            </TouchableOpacity>

            {/* Item Modal */}
            <Modal visible={itemModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingItem ? 'Edit Expense' : 'Add Expense'}</Text>
                            <TouchableOpacity onPress={() => setItemModalVisible(false)}>
                                <X size={24} color={Colors.gray[500]} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Type</Text>
                        <View style={styles.typeSelector}>
                            <TouchableOpacity
                                style={[styles.typeBtn, itemType === 'expense' && styles.typeBtnActiveExpense]}
                                onPress={() => setItemType('expense')}
                            >
                                <Text style={[styles.typeBtnText, itemType === 'expense' && styles.typeBtnTextActive]}>Expense</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.typeBtn, itemType === 'income' && styles.typeBtnActiveIncome]}
                                onPress={() => setItemType('income')}
                            >
                                <Text style={[styles.typeBtnText, itemType === 'income' && styles.typeBtnTextActive]}>Income</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Item Name</Text>
                        <TextInput style={styles.input} value={itemName} onChangeText={setItemName} placeholder="e.g. Paint" />

                        <Text style={styles.label}>Amount</Text>
                        <TextInput style={styles.input} value={itemAmount} onChangeText={setItemAmount} keyboardType="numeric" placeholder="0.00" />

                        {itemType === 'income' && (
                            <>
                                <Text style={styles.label}>Source of Income</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sourceScroll}>
                                    {incomeSources?.map((source: any) => (
                                        <TouchableOpacity
                                            key={source.id}
                                            style={[styles.sourcePill, itemSourceId === source.id && styles.sourcePillActive]}
                                            onPress={() => setItemSourceId(source.id)}
                                        >
                                            <Text style={[styles.sourcePillText, itemSourceId === source.id && styles.sourcePillTextActive]}>
                                                {source.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </>
                        )}

                        <Text style={styles.label}>Notes</Text>
                        <TextInput style={[styles.input, { height: 60 }]} value={itemNotes} onChangeText={setItemNotes} multiline placeholder="Optional details..." />

                        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveItem}>
                            <Text style={styles.saveBtnText}>Save Expense</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Book Edit Modal */}
            <Modal visible={bookModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Project</Text>
                            <TouchableOpacity onPress={() => setBookModalVisible(false)}>
                                <X size={24} color={Colors.gray[500]} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Project Name</Text>
                        <TextInput style={styles.input} value={bookName} onChangeText={setBookName} />

                        <Text style={styles.label}>Description</Text>
                        <TextInput style={styles.input} value={bookDesc} onChangeText={setBookDesc} />

                        <Text style={styles.label}>Budget Target</Text>
                        <TextInput style={styles.input} value={bookBudget} onChangeText={setBookBudget} keyboardType="numeric" />

                        <TouchableOpacity style={styles.saveBtn} onPress={handleEditBook}>
                            <Text style={styles.saveBtnText}>Update Project</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.gray[50] },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: Colors.white,
    },
    headerTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, flex: 1, textAlign: 'center' },
    iconBtn: { padding: 8 },
    scrollContent: { padding: 20 },
    hero: {
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        alignItems: 'center',
        ...Layout.shadows.md,
    },
    heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: Typography.size.sm, marginBottom: 8, fontFamily: Typography.family.bold },
    heroAmount: { color: 'white', fontSize: 36, fontFamily: Typography.family.bold, marginBottom: 16 },
    budgetContainer: { width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 16 },
    budgetRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    budgetText: { color: 'white', fontSize: Typography.size.xs, fontFamily: Typography.family.bold },
    progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: 3 },
    overBudgetWarning: { color: '#fee2e2', fontSize: Typography.size.xs, marginTop: 8, fontFamily: Typography.family.bold },
    deleteBookBtn: { marginTop: 16 },
    deleteBookText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
    sectionTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    itemCard: {
        backgroundColor: Colors.white,
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        ...Layout.shadows.sm,
    },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    itemInfo: { flex: 1, paddingRight: 16 },
    itemName: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[900], marginBottom: 4 },
    itemNotes: { fontSize: Typography.size.sm, color: Colors.gray[500], marginBottom: 8, fontFamily: Typography.family.medium },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    itemDate: { fontSize: Typography.size.xs, color: Colors.gray[400], fontFamily: Typography.family.medium },
    itemRight: { alignItems: 'flex-end', gap: 8 },
    itemAmount: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    deleteBtn: { padding: 4 },
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
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 400 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold },
    label: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, marginBottom: 8, color: Colors.gray[700] },
    input: { backgroundColor: Colors.gray[50], padding: 16, borderRadius: Layout.radius.lg, marginBottom: 20, fontSize: Typography.size.md, fontFamily: Typography.family.medium, borderWidth: 1, borderColor: Colors.gray[100] },
    saveBtn: { backgroundColor: Colors.primary[600], padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 },
    saveBtnText: { color: 'white', fontSize: Typography.size.md, fontFamily: Typography.family.bold },
    summaryRow: { flexDirection: 'row', width: '100%', alignItems: 'center', marginBottom: 16 },
    summaryCol: { flex: 1, alignItems: 'center' },
    summaryDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' },
    itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    incomeBadge: { backgroundColor: Colors.success[50], paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    incomeBadgeText: { color: Colors.success[600], fontSize: 10, fontFamily: Typography.family.bold, textTransform: 'uppercase' },
    typeSelector: { flexDirection: 'row', backgroundColor: Colors.gray[100], borderRadius: 12, padding: 4, marginBottom: 20 },
    typeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    typeBtnActiveExpense: { backgroundColor: Colors.danger[500] },
    typeBtnActiveIncome: { backgroundColor: Colors.success[500] },
    typeBtnText: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.gray[500] },
    typeBtnTextActive: { color: 'white' },
    sourceScroll: { marginBottom: 20 },
    sourcePill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.gray[100], marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
    sourcePillActive: { backgroundColor: Colors.success[50], borderColor: Colors.success[200] },
    sourcePillText: { fontSize: Typography.size.sm, color: Colors.gray[600], fontFamily: Typography.family.medium },
    sourcePillTextActive: { color: Colors.success[700], fontFamily: Typography.family.bold },
    itemActions: { flexDirection: 'row', gap: 4, marginTop: 4 },
    actionBtn: { padding: 4 },
});
