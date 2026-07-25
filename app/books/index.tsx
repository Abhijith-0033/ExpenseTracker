import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  Modal, TextInput, Alert, ActivityIndicator, Pressable
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, X, Search, FileText, CheckCircle, Edit3, Trash2 } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../../constants/Theme';
import { getBooks, addBook, updateBook, deleteBook, ExpenseBook } from '../../services/books';
import { formatCurrency } from '../../utils/currency';
import { PressableScale } from '../../components/ui/PressableScale';
import { Snackbar } from '../../components/Snackbar';
import { ConfirmActionSheet } from '../../components/ConfirmActionSheet';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const BOOK_EMOJIS = ['📒', '✈️', '🏖️', '🎉', '🏠', '🎓', '💼', '🏥', '🛍️', '🍽️', '🚗', '⛰️', '🎊', '💒', '🏋️', '📱', '🎸', '🌍', '🎄', '🏆'];

const BOOK_COLORS = [
  '#D66A4E', // Brand coral
  '#2F9E44', // Green
  '#E03131', // Red
  '#F76707', // Orange
  '#7048E8', // Purple
  '#0B7285', // Teal
  '#C2255C', // Pink
  '#1C7C3A', // Dark green
];

const TEMPLATES = [
  { emoji: '✈️', label: 'Trip / Vacation', sections: ['Flight & Train', 'Hotel', 'Food', 'Activities', 'Shopping', 'Local Transport', 'Misc'] },
  { emoji: '🎉', label: 'Event / Party', sections: ['Venue', 'Food & Drinks', 'Decorations', 'Entertainment', 'Gifts', 'Misc'] },
  { emoji: '💒', label: 'Wedding', sections: ['Venue', 'Catering', 'Decoration', 'Clothing', 'Jewelry', 'Photography', 'Misc'] },
  { emoji: '🏠', label: 'Home Renovation', sections: ['Materials', 'Labor', 'Furniture', 'Electronics', 'Misc'] },
  { emoji: '📒', label: 'Custom (Blank)', sections: [] },
];

export default function BooksScreen() {
  const router = useRouter();
  const [books, setBooks] = useState<(ExpenseBook & { total_spent: number; total_income: number; item_count: number })[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<(ExpenseBook & { total_spent: number; total_income: number; item_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all');

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📒');
  const [selectedColor, setSelectedColor] = useState('#D66A4E');

  // Edit State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingBook, setEditingBook] = useState<ExpenseBook | null>(null);

  // Snackbar & Confirmation
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [confirmSheet, setConfirmSheet] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    actionType: 'delete' | 'edit' | 'approve' | 'pay' | 'warning';
    onConfirm: () => void;
  } | null>(null);

  const fetchData = async () => {
    try {
      const data = await getBooks(activeFilter);
      setBooks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [activeFilter])
  );

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredBooks(books);
    } else {
      const lower = searchQuery.toLowerCase();
      setFilteredBooks(books.filter(b =>
        b.name.toLowerCase().includes(lower) ||
        (b.description && b.description.toLowerCase().includes(lower))
      ));
    }
  }, [searchQuery, books]);

  const handleSelectTemplate = (template: typeof TEMPLATES[0]) => {
    setSelectedTemplate(template);
    setSelectedEmoji(template.emoji);
    if (!name) {
      setName(template.label !== 'Custom (Blank)' ? template.label : '');
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter an expense book name');
      return;
    }
    try {
      const newBookId = await addBook(name.trim(), description.trim(), parseFloat(budget) || 0, {
        cover_emoji: selectedEmoji,
        color: selectedColor,
      });

      // Insert template default sections
      if (selectedTemplate.sections.length > 0 && typeof newBookId === 'number') {
        const { getDatabase } = await import('../../services/database');
        const db = getDatabase();
        for (let i = 0; i < selectedTemplate.sections.length; i++) {
          await db.runAsync(
            'INSERT INTO expense_book_sections (book_id, name, order_index) VALUES (?, ?, ?)',
            [newBookId, selectedTemplate.sections[i], i]
          );
        }
      }

      setModalVisible(false);
      resetCreateForm();
      fetchData();
      setSnackbarMessage('Expense book created');
      setSnackbarVisible(true);
    } catch (_e) {
      Alert.alert('Error', 'Failed to create expense book');
    }
  };

  const resetCreateForm = () => {
    setName('');
    setDescription('');
    setBudget('');
    setSelectedEmoji('📒');
    setSelectedColor('#D66A4E');
    setSelectedTemplate(TEMPLATES[0]);
  };

  const handleEditBook = (book: ExpenseBook) => {
    setEditingBook(book);
    setName(book.name);
    setDescription(book.description || '');
    setBudget(book.budget ? book.budget.toString() : '');
    setSelectedEmoji(book.cover_emoji || '📒');
    setSelectedColor(book.color || '#D66A4E');
    setEditModalVisible(true);
  };

  const handleUpdateBook = async () => {
    if (!editingBook || !name.trim()) {
      Alert.alert('Required', 'Please enter a book name');
      return;
    }

    try {
      await updateBook(editingBook.id, name.trim(), description.trim(), parseFloat(budget) || 0, {
        cover_emoji: selectedEmoji,
        color: selectedColor,
      });
      setEditModalVisible(false);
      setEditingBook(null);
      resetCreateForm();
      fetchData();
      setSnackbarMessage('Expense book updated');
      setSnackbarVisible(true);
    } catch (_e) {
      Alert.alert('Error', 'Failed to update book');
    }
  };

  const handleDeleteBook = (book: ExpenseBook) => {
    setConfirmSheet({
      title: 'Delete Expense Book?',
      description: `This will permanently delete '${book.name}' and all its entries.`,
      confirmLabel: 'Delete Book',
      actionType: 'delete',
      onConfirm: async () => {
        setConfirmSheet(null);
        try {
          await deleteBook(book.id);
          fetchData();
          setSnackbarMessage('Expense book deleted');
          setSnackbarVisible(true);
        } catch (_e) {
          Alert.alert('Error', 'Failed to delete book');
        }
      }
    });
  };

  const handleExportPDF = async (book: ExpenseBook) => {
    try {
      const { getBookItems } = await import('../../services/books');
      const items = await getBookItems(book.id);
      if (items.length === 0) {
        Alert.alert('No Entries', 'This book has no entries to export.');
        return;
      }

      const totalSpent = items.reduce((s, i) => s + (i.type === 'expense' ? i.amount : 0), 0);

      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
              body { font-family: -apple-system, sans-serif; padding: 30px; color: #1a1a2e; }
              .header { border-bottom: 3px solid ${book.color || '#D66A4E'}; padding-bottom: 16px; margin-bottom: 24px; }
              h1 { margin: 0; color: #111; font-size: 24px; }
              .meta { color: #666; font-size: 13px; margin-top: 4px; }
              .total-box { background: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #e2e8f0; }
              .total-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; }
              .total-value { font-size: 22px; font-weight: bold; color: ${book.color || '#D66A4E'}; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; }
              th { text-align: left; background: #f1f5f9; padding: 10px; font-size: 11px; text-transform: uppercase; color: #64748b; }
              td { padding: 10px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
              .amount { text-align: right; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${book.cover_emoji || '📒'} ${book.name}</h1>
              ${book.description ? `<p class="meta">${book.description}</p>` : ''}
              <p class="meta">Exported on ${new Date().toLocaleDateString()}</p>
            </div>
            <div class="total-box">
              <div class="total-label">Total Expenses</div>
              <div class="total-value">${formatCurrency(totalSpent)}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Description</th>
                  <th>Date</th>
                  <th style="text-align: right">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(item => `
                  <tr>
                    <td>${item.section_name || 'General'}</td>
                    <td>${item.name}${item.notes ? `<br/><small style="color:#888">${item.notes}</small>` : ''}</td>
                    <td>${new Date(item.date).toLocaleDateString()}</td>
                    <td class="amount">${formatCurrency(item.amount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      }
    } catch (e) {
      Alert.alert('Export Failed', 'Could not export PDF.');
    }
  };

  const totalTracked = books.reduce((sum, b) => sum + (b.total_spent || 0), 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.gray[900]} />
        </PressableScale>
        <Text style={styles.headerTitle}>Expense Books</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Plus size={16} color="white" />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'draft', 'published', 'archived'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, activeFilter === tab && styles.filterTabActive]}
            onPress={() => setActiveFilter(tab)}
          >
            <Text style={[styles.filterTabText, activeFilter === tab && styles.filterTabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={18} color={Colors.gray[400]} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search books..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.gray[400]}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        {/* Summary Header */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Books</Text>
            <Text style={styles.summaryValue}>{books.length}</Text>
          </View>
          <View style={[styles.summaryItem, { borderLeftWidth: 1, borderLeftColor: Colors.gray[200], paddingLeft: 20 }]}>
            <Text style={styles.summaryLabel}>Total Tracked</Text>
            <Text style={[styles.summaryValue, { color: Colors.primary[600] }]}>
              {formatCurrency(totalTracked)}
            </Text>
          </View>
        </View>

        {/* List */}
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary[500]} style={{ marginTop: 40 }} />
        ) : filteredBooks.length > 0 ? (
          filteredBooks.map(book => (
            <Pressable
              key={book.id}
              style={styles.bookCard}
              onPress={() => router.push(`/books/${book.id}` as any)}
            >
              {/* Top Color Bar */}
              <View style={[styles.bookColorBar, { backgroundColor: book.color || '#D66A4E' }]} />

              <View style={styles.bookCardContent}>
                <View style={styles.bookTopRow}>
                  <Text style={styles.bookEmoji}>{book.cover_emoji || '📒'}</Text>
                  <View style={[
                    styles.statusBadge,
                    book.status === 'published' ? { backgroundColor: Colors.success[50] } :
                    book.status === 'archived' ? { backgroundColor: Colors.gray[100] } :
                    { backgroundColor: Colors.warning[50] }
                  ]}>
                    <Text style={[
                      styles.statusBadgeText,
                      book.status === 'published' ? { color: Colors.success[700] } :
                      book.status === 'archived' ? { color: Colors.gray[500] } :
                      { color: Colors.warning[700] }
                    ]}>
                      {book.status === 'published' ? '✅ Published' : book.status === 'archived' ? '📦 Archived' : '✏️ Draft'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.bookName}>{book.name}</Text>
                {book.description ? (
                  <Text style={styles.bookDesc} numberOfLines={1}>{book.description}</Text>
                ) : null}

                <View style={styles.statsRow}>
                  <Text style={styles.statText}>📝 {book.item_count} entries</Text>
                  <Text style={styles.statText}>💰 {formatCurrency(book.total_spent)}</Text>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.dateText}>
                    Updated {new Date(book.last_updated).toLocaleDateString()}
                  </Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity onPress={() => handleEditBook(book)} style={styles.iconActionBtn}>
                      <Edit3 size={16} color={Colors.gray[500]} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleExportPDF(book)} style={styles.iconActionBtn}>
                      <FileText size={16} color={Colors.gray[500]} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteBook(book)} style={styles.iconActionBtn}>
                      <Trash2 size={16} color={Colors.danger[500]} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📖</Text>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No matching expense books found' : 'No expense books yet.\nCreate one to track a project or vacation!'}
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Plus size={28} color="white" />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Expense Book</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetCreateForm(); }}>
                <X size={24} color={Colors.gray[500]} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Template Picker */}
              <Text style={styles.label}>Choose a Template</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateRow}>
                {TEMPLATES.map(t => (
                  <TouchableOpacity
                    key={t.label}
                    style={[styles.templateCard, selectedTemplate.label === t.label && styles.templateCardActive]}
                    onPress={() => handleSelectTemplate(t)}
                  >
                    <Text style={styles.templateEmoji}>{t.emoji}</Text>
                    <Text style={styles.templateLabel}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Cover Emoji */}
              <Text style={styles.label}>Cover Emoji</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {BOOK_EMOJIS.map(emoji => (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.emojiBtn, selectedEmoji === emoji && styles.emojiBtnActive]}
                    onPress={() => setSelectedEmoji(emoji)}
                  >
                    <Text style={{ fontSize: 22 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Accent Color */}
              <Text style={styles.label}>Theme Color</Text>
              <View style={styles.colorRow}>
                {BOOK_COLORS.map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[styles.colorSwatch, { backgroundColor: color }, selectedColor === color && styles.colorSwatchActive]}
                    onPress={() => setSelectedColor(color)}
                  />
                ))}
              </View>

              {/* Book Name */}
              <Text style={styles.label}>Book Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Goa Trip 2026"
                value={name}
                onChangeText={setName}
              />

              {/* Description */}
              <Text style={styles.label}>Description (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Flight, hotel, meals and local expenses"
                value={description}
                onChangeText={setDescription}
              />

              {/* Target Budget */}
              <Text style={styles.label}>Target Budget (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="numeric"
                value={budget}
                onChangeText={setBudget}
              />

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: selectedColor }]} onPress={handleCreate}>
                <Text style={styles.saveBtnText}>Create Expense Book</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Expense Book</Text>
              <TouchableOpacity onPress={() => { setEditModalVisible(false); setEditingBook(null); resetCreateForm(); }}>
                <X size={24} color={Colors.gray[500]} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Cover Emoji</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {BOOK_EMOJIS.map(emoji => (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.emojiBtn, selectedEmoji === emoji && styles.emojiBtnActive]}
                    onPress={() => setSelectedEmoji(emoji)}
                  >
                    <Text style={{ fontSize: 22 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Theme Color</Text>
              <View style={styles.colorRow}>
                {BOOK_COLORS.map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[styles.colorSwatch, { backgroundColor: color }, selectedColor === color && styles.colorSwatchActive]}
                    onPress={() => setSelectedColor(color)}
                  />
                ))}
              </View>

              <Text style={styles.label}>Book Name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} />

              <Text style={styles.label}>Description</Text>
              <TextInput style={styles.input} value={description} onChangeText={setDescription} />

              <Text style={styles.label}>Budget Target</Text>
              <TextInput style={styles.input} value={budget} onChangeText={setBudget} keyboardType="numeric" />

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: selectedColor }]} onPress={handleUpdateBook}>
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        message={snackbarMessage}
        onDismiss={() => setSnackbarVisible(false)}
      />

      {confirmSheet && (
        <ConfirmActionSheet
          visible={!!confirmSheet}
          title={confirmSheet.title}
          description={confirmSheet.description}
          confirmLabel={confirmSheet.confirmLabel}
          actionType={confirmSheet.actionType}
          onConfirm={confirmSheet.onConfirm}
          onCancel={() => setConfirmSheet(null)}
        />
      )}
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
    paddingBottom: 16,
    backgroundColor: Colors.white,
  },
  backBtn: { padding: 4, marginLeft: -4 },
  headerTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary[600],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Layout.radius.full,
  },
  addBtnText: { color: 'white', fontFamily: Typography.family.bold, fontSize: Typography.size.xs },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Layout.radius.full,
    backgroundColor: Colors.gray[100],
  },
  filterTabActive: { backgroundColor: Colors.primary[600] },
  filterTabText: { fontSize: Typography.size.xs, fontFamily: Typography.family.bold, color: Colors.gray[500] },
  filterTabTextActive: { color: 'white' },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray[100],
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[900],
  },
  scrollContent: { padding: 16 },
  summaryContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 16,
    ...Layout.shadows.sm,
  },
  summaryItem: { flex: 1 },
  summaryLabel: { fontSize: Typography.size.xs, color: Colors.gray[500], marginBottom: 4, fontFamily: Typography.family.bold },
  summaryValue: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  bookCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginBottom: 14,
    ...Layout.shadows.sm,
    overflow: 'hidden',
  },
  bookColorBar: { height: 6, width: '100%' },
  bookCardContent: { padding: 16 },
  bookTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  bookEmoji: { fontSize: 26 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Layout.radius.full },
  statusBadgeText: { fontSize: 10, fontFamily: Typography.family.bold },
  bookName: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.gray[900], marginBottom: 4 },
  bookDesc: { fontSize: Typography.size.sm, color: Colors.gray[500], marginBottom: 10, fontFamily: Typography.family.regular },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  statText: { fontSize: Typography.size.xs, color: Colors.gray[600], fontFamily: Typography.family.medium },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.gray[100] },
  dateText: { fontSize: Typography.size.xs, color: Colors.gray[400] },
  actionRow: { flexDirection: 'row', gap: 12 },
  iconActionBtn: { padding: 4 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { textAlign: 'center', color: Colors.gray[400], lineHeight: 22, fontFamily: Typography.family.medium, fontSize: Typography.size.sm },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: Colors.primary[600],
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold },
  label: { fontSize: Typography.size.xs, fontFamily: Typography.family.bold, marginBottom: 6, color: Colors.gray[700], textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: Colors.gray[50],
    padding: 14,
    borderRadius: Layout.radius.lg,
    marginBottom: 14,
    fontSize: Typography.size.md,
    fontFamily: Typography.family.medium,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    color: Colors.gray[900],
  },
  templateRow: { gap: 8, marginBottom: 16 },
  templateCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: Layout.radius.lg,
    borderWidth: 1.5, borderColor: Colors.gray[200],
    backgroundColor: Colors.gray[50], marginRight: 8,
  },
  templateCardActive: { borderColor: Colors.primary[600], backgroundColor: Colors.primary[50] },
  templateEmoji: { fontSize: 20 },
  templateLabel: { fontSize: Typography.size.xs, fontFamily: Typography.family.bold, color: Colors.gray[800] },
  emojiBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 8, backgroundColor: Colors.gray[100] },
  emojiBtnActive: { borderWidth: 2, borderColor: Colors.primary[600], backgroundColor: Colors.primary[50] },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorSwatchActive: { borderWidth: 3, borderColor: Colors.gray[900] },
  saveBtn: {
    padding: 16,
    borderRadius: Layout.radius.lg,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  saveBtnText: { color: 'white', fontSize: Typography.size.md, fontFamily: Typography.family.bold },
});
