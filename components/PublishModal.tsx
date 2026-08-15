import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Colors, Layout, Typography } from '../constants/Theme';
import { X } from 'lucide-react-native';
import { getPublishPreview, publishBook, PublishPreview, ExpenseBook } from '../services/books';

interface PublishModalProps {
  bookId: number;
  book: ExpenseBook;
  onClose: () => void;
  onPublished: () => void;
}

export function PublishModal({ bookId, book, onClose, onPublished }: PublishModalProps) {
  const [preview, setPreview] = useState<PublishPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    loadPreview();
  }, [bookId]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      const p = await getPublishPreview(bookId);
      setPreview(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    if (preview.itemsMissingAccount.length > 0) {
      Alert.alert('Missing Accounts', `${preview.itemsMissingAccount.length} entries have no account selected. Please assign accounts before publishing.`);
      return;
    }
    try {
      setPublishing(true);
      await publishBook(bookId);
      onPublished();
    } catch (e: any) {
      Alert.alert('Publish Failed', e.message || 'Something went wrong');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🚀 Publish {book.name}?</Text>
            <Pressable onPress={onClose} hitSlop={10}><X size={24} color={Colors.gray[500]} /></Pressable>
          </View>

          <Text style={styles.subtitle}>
            This will create real expense transactions and update your account balances.
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary[600]} style={{ margin: 40 }} />
          ) : preview ? (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {/* Summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryRow}>📝 Entries: <Text style={styles.summaryValue}>{preview.itemCount}</Text></Text>
                <Text style={styles.summaryRow}>💰 Total Amount: <Text style={[styles.summaryValue, { color: Colors.danger[600] }]}>₹{preview.totalAmount.toLocaleString()}</Text></Text>
              </View>

              {/* Warning: items missing account */}
              {preview.itemsMissingAccount.length > 0 && (
                <View style={styles.warningCard}>
                  <Text style={styles.warningText}>
                    ⚠️ {preview.itemsMissingAccount.length} entries have no account selected.
                    {'\n'}Please go back and assign accounts to all entries.
                  </Text>
                </View>
              )}

              {/* Account Impact */}
              <Text style={styles.sectionLabel}>Account Impact</Text>
              {preview.accountImpact.map(acc => (
                <View key={acc.account_id} style={styles.impactRow}>
                  <Text style={styles.impactAccount}>{acc.account_name}</Text>
                  <Text style={[styles.impactDeduction, acc.will_go_negative && { color: Colors.danger[600] }]}>
                    -₹{acc.deduction.toLocaleString()}
                    {acc.will_go_negative && ' ⚠️'}
                  </Text>
                </View>
              ))}

              {/* Entries preview */}
              <Text style={styles.sectionLabel}>Entries ({preview.itemCount})</Text>
              {preview.items.slice(0, 10).map(item => (
                <View key={item.id} style={styles.previewRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewName}>{item.name}</Text>
                    <Text style={styles.previewSection}>{item.section_name || 'General'}</Text>
                  </View>
                  <Text style={styles.previewAmount}>₹{item.amount.toLocaleString()}</Text>
                  {!item.account_id && <Text style={{ color: Colors.danger[500], fontSize: 10, marginLeft: 4 }}>No Account</Text>}
                </View>
              ))}
              {preview.itemCount > 10 && (
                <Text style={{ textAlign: 'center', color: Colors.gray[400], fontSize: Typography.size.xs, marginTop: 8 }}>
                  + {preview.itemCount - 10} more entries
                </Text>
              )}

              <View style={{ height: 20 }} />
            </ScrollView>
          ) : null}

          <View style={styles.buttons}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, (publishing || (preview?.itemsMissingAccount?.length ?? 0) > 0) && { opacity: 0.5 }]}
              onPress={handleConfirm}
              disabled={publishing || (preview?.itemsMissingAccount?.length ?? 0) > 0}
            >
              {publishing
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={styles.confirmBtnText}>✓ Confirm & Publish</Text>
              }
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  title: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.gray[900], flex: 1, marginRight: 12 },
  subtitle: { fontSize: Typography.size.sm, color: Colors.gray[500], paddingHorizontal: 20, marginBottom: 16, fontFamily: Typography.family.regular },
  summaryCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: Colors.gray[50], borderRadius: Layout.radius.lg, padding: 16, gap: 6 },
  summaryRow: { fontSize: Typography.size.sm, color: Colors.gray[600], fontFamily: Typography.family.medium },
  summaryValue: { fontFamily: Typography.family.bold, color: Colors.gray[900] },
  warningCard: { marginHorizontal: 20, backgroundColor: '#FEF3C7', borderRadius: Layout.radius.lg, padding: 12, marginBottom: 16 },
  warningText: { color: '#92400E', fontSize: Typography.size.sm, fontFamily: Typography.family.medium, lineHeight: 20 },
  sectionLabel: { fontSize: Typography.size.xs, fontFamily: Typography.family.bold, color: Colors.gray[400], textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: 20, marginBottom: 8, marginTop: 16 },
  impactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  impactAccount: { fontSize: Typography.size.sm, fontFamily: Typography.family.medium, color: Colors.gray[800] },
  impactDeduction: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.gray[600] },
  previewRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.gray[50] },
  previewName: { fontSize: Typography.size.sm, fontFamily: Typography.family.medium, color: Colors.gray[800] },
  previewSection: { fontSize: Typography.size.xs, color: Colors.gray[400], marginTop: 2 },
  previewAmount: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.danger[600] },
  buttons: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: Layout.radius.lg, borderWidth: 1.5, borderColor: Colors.gray[200], alignItems: 'center' },
  cancelBtnText: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[600] },
  confirmBtn: { flex: 2, padding: 14, borderRadius: Layout.radius.lg, backgroundColor: Colors.success[600], alignItems: 'center' },
  confirmBtnText: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.white },
});
