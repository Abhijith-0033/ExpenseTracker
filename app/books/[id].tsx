import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  Modal, ActivityIndicator, Pressable, Share
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft, Plus, Trash2, Edit2, Share2, MoreVertical, CheckCircle,
  Archive, RotateCcw
} from 'lucide-react-native';
import { Colors, Layout, Typography } from '../../constants/Theme';
import {
  getBookById, getBookItems, getBookSections, addBookItem, deleteBookItem,
  updateBookItem, getBookSummary, getBookSectionTotals, unpublishBook, archiveBook,
  ExpenseBook, BookItem, BookSection, deleteBook, updateBook, generateShareSummary
} from '../../services/books';
import { BookCharts } from '../../components/BookCharts';
import { formatCurrency } from '../../utils/currency';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ConfirmActionSheet } from '../../components/ConfirmActionSheet';
import { AddEntrySheet } from '../../components/AddEntrySheet';
import { PublishModal } from '../../components/PublishModal';
import { SuccessAnimation } from '../../components/SuccessAnimation';

export default function BookDetailScreen() {
  const { id, action } = useLocalSearchParams();
  const router = useRouter();

  const [book, setBook] = useState<ExpenseBook | null>(null);
  const [items, setItems] = useState<BookItem[]>([]);
  const [sections, setSections] = useState<BookSection[]>([]);
  const [sectionTotals, setSectionTotals] = useState<{ section_name: string; total: number }[]>([]);
  const [summary, setSummary] = useState({ totalSpent: 0, totalIncome: 0, itemCount: 0, budget: 0, progress: 0 });
  const [loading, setLoading] = useState(true);

  // Section Filter State
  const [activeSection, setActiveSection] = useState('All');

  // Modals State
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BookItem | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('Success!');

  // Edit Book Header Modal State
  const [showEditBookModal, setShowEditBookModal] = useState(false);
  const [editBookName, setEditBookName] = useState('');
  const [editBookDesc, setEditBookDesc] = useState('');
  const [editBookBudget, setEditBookBudget] = useState('');

  const [confirmSheet, setConfirmSheet] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    actionType: 'delete' | 'edit' | 'approve' | 'pay' | 'warning';
    onConfirm: () => void;
  } | null>(null);

  const fetchData = async () => {
    if (!id) return;
    try {
      const bookId = Number(id);
      const [bookData, itemsData, sectionsData, summaryData, totalsData] = await Promise.all([
        getBookById(bookId),
        getBookItems(bookId),
        getBookSections(bookId),
        getBookSummary(bookId),
        getBookSectionTotals(bookId),
      ]);

      setBook(bookData);
      setItems(itemsData);
      setSections(sectionsData);
      setSummary(summaryData);
      setSectionTotals(totalsData);

      // Auto-open publish modal if action query param is publish
      if (action === 'publish' && bookData && bookData.status === 'draft') {
        setShowPublishModal(true);
      }
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

  const handleSaveEntry = async (entryData: any) => {
    if (!book) return;
    if (editingEntry) {
      await updateBookItem(
        editingEntry.id,
        entryData.name,
        entryData.amount,
        entryData.notes,
        entryData.date,
        'expense',
        null,
        {
          section_name: entryData.section_name,
          account_id: entryData.account_id,
        }
      );
    } else {
      await addBookItem(
        book.id,
        entryData.name,
        entryData.amount,
        entryData.notes,
        entryData.date,
        'expense',
        null,
        {
          section_name: entryData.section_name,
          account_id: entryData.account_id,
        }
      );
    }
    fetchData();
  };

  const handleDeleteEntry = (itemId: number) => {
    setConfirmSheet({
      title: 'Delete Entry?',
      description: 'Are you sure you want to delete this expense entry?',
      confirmLabel: 'Delete',
      actionType: 'delete',
      onConfirm: async () => {
        setConfirmSheet(null);
        await deleteBookItem(itemId);
        fetchData();
      }
    });
  };

  const handleUnpublish = () => {
    setShowMenuModal(false);
    setConfirmSheet({
      title: 'Unpublish Expense Book?',
      description: 'This will delete the created transactions and restore account balances. The book will return to Draft status.',
      confirmLabel: 'Unpublish Book',
      actionType: 'warning',
      onConfirm: async () => {
        setConfirmSheet(null);
        if (!book) return;
        try {
          await unpublishBook(book.id);
          setSuccessMsg('Unpublished!');
          setShowSuccess(true);
          fetchData();
        } catch (e: any) {
          Alert.alert('Error', e.message || 'Failed to unpublish');
        }
      }
    });
  };

  const handleArchive = async () => {
    setShowMenuModal(false);
    if (!book) return;
    setConfirmSheet({
      title: 'Archive Book?',
      description: `Are you sure you want to archive "${book.name}"? It will be moved to the Archived section.`,
      confirmLabel: 'Archive',
      actionType: 'warning',
      onConfirm: async () => {
        setConfirmSheet(null);
        await archiveBook(book.id);
        setSuccessMsg('Archived!');
        setShowSuccess(true);
        fetchData();
      }
    });
  };

  const handleDeleteBook = () => {
    setShowMenuModal(false);
    setConfirmSheet({
      title: 'Delete Book?',
      description: 'This will permanently delete this book and all its entries.',
      confirmLabel: 'Delete',
      actionType: 'delete',
      onConfirm: async () => {
        setConfirmSheet(null);
        if (!book) return;
        await deleteBook(book.id);
        router.back();
      }
    });
  };

  const handleExportTextShare = async () => {
    setShowMenuModal(false);
    if (!book) return;
    try {
      const text = await generateShareSummary(book.id);
      await Share.share({
        title: `${book.name} Summary`,
        message: text,
      });
    } catch (e: any) {
      console.error('Share failed', e);
    }
  };

  const handleExportPDF = async () => {
    setShowMenuModal(false);
    if (!book || items.length === 0) return;

    try {
      const totalExpenses = items.reduce((sum, i) => sum + i.amount, 0);

      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
              body { font-family: -apple-system, sans-serif; padding: 30px; color: #333; }
              .header { border-bottom: 3px solid ${book.color || '#D66A4E'}; padding-bottom: 16px; margin-bottom: 24px; }
              h1 { margin: 0; color: #111; }
              .summary-box { background: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #e2e8f0; }
              .summary-val { font-size: 24px; font-weight: bold; color: ${book.color || '#D66A4E'}; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; }
              th { text-align: left; background: #f1f5f9; padding: 10px; font-size: 11px; text-transform: uppercase; color: #64748b; }
              td { padding: 10px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
              .amount { text-align: right; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${book.cover_emoji || '📒'} ${book.name}</h1>
              ${book.description ? `<p>${book.description}</p>` : ''}
              <p style="color:#888;font-size:12px;">Exported on ${new Date().toLocaleDateString()}</p>
            </div>
            <div class="summary-box">
              <div style="font-size:12px;color:#64748b;font-weight:bold;">TOTAL EXPENSES</div>
              <div class="summary-val">${formatCurrency(totalExpenses)}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Entry</th>
                  <th>Date</th>
                  <th style="text-align:right">Amount</th>
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
      Alert.alert('Export Failed', 'Could not export PDF');
    }
  };

  if (loading || !book) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary[500]} /></View>;
  }

  // Filter items by active section tab
  const filteredItems = activeSection === 'All'
    ? items
    : items.filter(i => (i.section_name || 'General') === activeSection);

  // Group items by section for 'All' view
  const sectionGroups: { section: string; total: number; items: BookItem[] }[] = [];
  if (activeSection === 'All') {
    const map = new Map<string, BookItem[]>();
    for (const item of items) {
      const sName = item.section_name || 'General';
      if (!map.has(sName)) map.set(sName, []);
      map.get(sName)!.push(item);
    }
    map.forEach((secItems, secName) => {
      const total = secItems.reduce((s, i) => s + i.amount, 0);
      sectionGroups.push({ section: secName, total, items: secItems });
    });
  } else {
    const total = filteredItems.reduce((s, i) => s + i.amount, 0);
    sectionGroups.push({ section: activeSection, total, items: filteredItems });
  }

  const isOverBudget = book.budget > 0 && summary.totalSpent > book.budget;
  const bookThemeColor = book.color || Colors.primary[600];

  return (
    <View style={styles.container}>
      {/* Top Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{book.cover_emoji} {book.name}</Text>

        <View style={styles.headerRightActions}>
          {book.status === 'draft' && (
            <TouchableOpacity style={[styles.publishHeaderBtn, { backgroundColor: bookThemeColor }]} onPress={() => setShowPublishModal(true)}>
              <Text style={styles.publishHeaderBtnText}>🚀 Publish</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowMenuModal(true)} style={styles.iconBtn}>
            <MoreVertical size={20} color={Colors.gray[900]} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: bookThemeColor }]}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroEmoji}>{book.cover_emoji || '📒'}</Text>
            <View style={styles.heroStatusBadge}>
              <Text style={styles.heroStatusBadgeText}>
                {book.status === 'published' ? '✅ Published' : book.status === 'archived' ? '📦 Archived' : '✏️ Draft'}
              </Text>
            </View>
          </View>

          <Text style={styles.heroName}>{book.name}</Text>
          {book.description ? <Text style={styles.heroDesc}>{book.description}</Text> : null}

          {/* Hero Stats */}
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>Total Spent</Text>
              <Text style={styles.heroStatValue}>{formatCurrency(summary.totalSpent)}</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>Entries</Text>
              <Text style={styles.heroStatValue}>{items.length}</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>Sections</Text>
              <Text style={styles.heroStatValue}>{sectionTotals.length}</Text>
            </View>
          </View>

          {/* Budget progress */}
          {book.budget > 0 && (
            <View style={styles.budgetContainer}>
              <View style={styles.budgetRow}>
                <Text style={styles.budgetText}>Budget: {formatCurrency(book.budget)}</Text>
                <Text style={styles.budgetText}>{Math.round(summary.progress * 100)}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[
                  styles.progressBar,
                  { width: `${Math.min(summary.progress * 100, 100)}%`, backgroundColor: isOverBudget ? Colors.danger[400] : 'white' }
                ]} />
              </View>
              {isOverBudget && (
                <Text style={styles.overBudgetWarning}>
                  ⚠️ Over budget by {formatCurrency(summary.totalSpent - book.budget)}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Section Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionTabsScroll}>
          {['All', ...sectionTotals.map(s => s.section_name)].map(sec => (
            <TouchableOpacity
              key={sec}
              style={[styles.sectionTabPill, activeSection === sec && { backgroundColor: bookThemeColor }]}
              onPress={() => setActiveSection(sec)}
            >
              <Text style={[styles.sectionTabPillText, activeSection === sec && { color: 'white' }]}>
                {sec}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Grouped Entry List */}
        {sectionGroups.map(group => (
          <View key={group.section} style={styles.groupContainer}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>📌 {group.section}</Text>
              <Text style={styles.groupTotal}>{formatCurrency(group.total)}</Text>
            </View>

            {group.items.map(item => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemRow}>
                  <View style={[styles.itemColorIndicator, { backgroundColor: bookThemeColor }]} />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.notes ? <Text style={styles.itemNotes} numberOfLines={1}>{item.notes}</Text> : null}
                    <Text style={styles.itemDate}>{new Date(item.date).toLocaleDateString()}</Text>
                  </View>
                  <View style={styles.itemRight}>
                    <Text style={styles.itemAmount}>
                      {formatCurrency(item.amount)}
                    </Text>
                    {item.is_published === 1 ? (
                      <Text style={styles.publishedCheck}>✓ Published</Text>
                    ) : (
                      <View style={styles.itemActions}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => { setEditingEntry(item); setShowAddEntry(true); }}>
                          <Edit2 size={15} color={Colors.gray[400]} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteEntry(item.id)}>
                          <Trash2 size={15} color={Colors.danger[400]} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        ))}

        {items.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={styles.emptyText}>No expenses in this book yet.{'\n'}Tap + to add your first entry.</Text>
          </View>
        )}

        {/* Section Totals Breakdown Chart */}
        {items.length > 0 && (
          <BookCharts items={items} />
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: bookThemeColor }]} onPress={() => { setEditingEntry(null); setShowAddEntry(true); }}>
        <Plus size={28} color="white" />
      </TouchableOpacity>

      {/* Add / Edit Entry Sheet */}
      <AddEntrySheet
        visible={showAddEntry}
        bookId={book.id}
        bookColor={bookThemeColor}
        existingSections={sectionTotals.map(s => s.section_name)}
        editingItem={editingEntry}
        onSave={handleSaveEntry}
        onClose={() => { setShowAddEntry(false); setEditingEntry(null); }}
      />

      {/* Publish Modal */}
      {showPublishModal && (
        <PublishModal
          bookId={book.id}
          book={book}
          onClose={() => setShowPublishModal(false)}
          onPublished={() => {
            setShowPublishModal(false);
            setSuccessMsg('Published!');
            setShowSuccess(true);
            fetchData();
          }}
        />
      )}

      {/* Options Menu Modal */}
      <Modal visible={showMenuModal} transparent animationType="fade" statusBarTranslucent>
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenuModal(false)}>
          <View style={styles.menuContent}>
            {book.status === 'published' && (
              <TouchableOpacity style={styles.menuOption} onPress={handleUnpublish}>
                <RotateCcw size={18} color={Colors.warning[700]} />
                <Text style={[styles.menuOptionText, { color: Colors.warning[700] }]}>Unpublish Book (Revert)</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuOption} onPress={handleExportPDF}>
              <Share2 size={18} color={Colors.gray[800]} />
              <Text style={styles.menuOptionText}>Export PDF Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOption} onPress={handleExportTextShare}>
              <Share2 size={18} color={Colors.gray[800]} />
              <Text style={styles.menuOptionText}>Share Text Summary</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOption} onPress={handleArchive}>
              <Archive size={18} color={Colors.gray[800]} />
              <Text style={styles.menuOptionText}>Archive Book</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuOption, { borderBottomWidth: 0 }]} onPress={handleDeleteBook}>
              <Trash2 size={18} color={Colors.danger[600]} />
              <Text style={[styles.menuOptionText, { color: Colors.danger[600] }]}>Delete Book</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Success Animation */}
      <SuccessAnimation
        visible={showSuccess}
        onAnimationFinish={() => setShowSuccess(false)}
        message={successMsg}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  headerTitle: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, flex: 1, marginHorizontal: 12 },
  iconBtn: { padding: 8 },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  publishHeaderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Layout.radius.full,
  },
  publishHeaderBtnText: { color: 'white', fontSize: Typography.size.xs, fontFamily: Typography.family.bold },
  scrollContent: { padding: 16 },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    ...Layout.shadows.md,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heroEmoji: { fontSize: 36 },
  heroStatusBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Layout.radius.full },
  heroStatusBadgeText: { color: 'white', fontSize: 10, fontFamily: Typography.family.bold },
  heroName: { color: 'white', fontSize: Typography.size.xxl, fontFamily: Typography.family.bold, marginBottom: 4 },
  heroDesc: { color: 'rgba(255,255,255,0.85)', fontSize: Typography.size.sm, fontFamily: Typography.family.regular, marginBottom: 16 },
  heroStatsRow: { flexDirection: 'row', width: '100%', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)', padding: 14, borderRadius: 16 },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontFamily: Typography.family.bold, textTransform: 'uppercase', marginBottom: 2 },
  heroStatValue: { color: 'white', fontSize: Typography.size.md, fontFamily: Typography.family.bold },
  heroStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
  budgetContainer: { width: '100%', backgroundColor: 'rgba(0,0,0,0.15)', padding: 12, borderRadius: 14, marginTop: 12 },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  budgetText: { color: 'white', fontSize: Typography.size.xs, fontFamily: Typography.family.bold },
  progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 3 },
  overBudgetWarning: { color: '#fee2e2', fontSize: Typography.size.xs, marginTop: 6, fontFamily: Typography.family.bold },
  sectionTabsScroll: { marginBottom: 16 },
  sectionTabPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Layout.radius.full, backgroundColor: Colors.gray[200], marginRight: 8 },
  sectionTabPillText: { fontSize: Typography.size.xs, fontFamily: Typography.family.bold, color: Colors.gray[700] },
  groupContainer: { marginBottom: 20 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 },
  groupTitle: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.gray[800] },
  groupTotal: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  itemCard: {
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
    ...Layout.shadows.sm,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemColorIndicator: { width: 4, height: 36, borderRadius: 2, marginRight: 12 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  itemNotes: { fontSize: Typography.size.xs, color: Colors.gray[500], marginTop: 2, fontFamily: Typography.family.medium },
  itemDate: { fontSize: 10, color: Colors.gray[400], marginTop: 2 },
  itemRight: { alignItems: 'flex-end' },
  itemAmount: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  publishedCheck: { fontSize: 10, color: Colors.success[700], fontFamily: Typography.family.bold, marginTop: 2 },
  itemActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: { padding: 4 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyText: { textAlign: 'center', color: Colors.gray[400], fontFamily: Typography.family.medium, lineHeight: 20 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 90, paddingRight: 16 },
  menuContent: { backgroundColor: Colors.white, borderRadius: 16, width: 220, paddingVertical: 8, ...Layout.shadows.md },
  menuOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  menuOptionText: { fontSize: Typography.size.sm, fontFamily: Typography.family.medium, color: Colors.gray[800] },
});
