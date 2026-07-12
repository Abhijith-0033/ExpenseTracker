import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Trash2, Calendar, AlertTriangle, History } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, subMonths, subYears, startOfYear } from 'date-fns';
import { Colors, Typography, Layout } from '../constants/Theme';
import { previewDeleteByDateRange, deleteTransactionsByDateRange, getDataDeletionLog } from '../services/database';
import { ConfirmActionSheet } from '../components/ConfirmActionSheet';
import { useApp } from '../context/AppContext';

const PRESETS = [
  { label: 'Last 1 Month', getRange: () => ({ start: subMonths(new Date(), 1), end: new Date() }) },
  { label: 'Last 3 Months', getRange: () => ({ start: subMonths(new Date(), 3), end: new Date() }) },
  { label: 'Last 6 Months', getRange: () => ({ start: subMonths(new Date(), 6), end: new Date() }) },
  { label: 'Last 1 Year', getRange: () => ({ start: subYears(new Date(), 1), end: new Date() }) },
  { label: 'This Year', getRange: () => ({ start: startOfYear(new Date()), end: new Date() }) },
];

export default function DataCleanupScreen() {
  const router = useRouter();
  const { refreshData } = useApp();

  const [startDate, setStartDate] = useState<Date>(subMonths(new Date(), 3));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletionLog, setDeletionLog] = useState<any[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    loadLog();
  }, []);

  const loadLog = async () => {
    const log = await getDataDeletionLog();
    setDeletionLog(log);
  };

  const handlePreset = (preset: typeof PRESETS[0]) => {
    const { start, end } = preset.getRange();
    setStartDate(start);
    setEndDate(end);
    setPreviewCount(null);
  };

  const handlePreview = async () => {
    if (startDate > endDate) {
      Alert.alert('Invalid Range', 'Start date must be before end date.');
      return;
    }
    setPreviewing(true);
    const count = await previewDeleteByDateRange(
      format(startDate, 'yyyy-MM-dd'),
      format(endDate, 'yyyy-MM-dd')
    );
    setPreviewCount(count);
    setPreviewing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const deleted = await deleteTransactionsByDateRange(
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd')
      );
      await refreshData();
      setPreviewCount(null);
      Alert.alert('Done', `${deleted} transaction(s) deleted successfully.`);
      loadLog();
    } catch (_e) {
      Alert.alert('Error', 'Failed to delete records.');
    } finally {
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete Records</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Warning Card */}
        <View style={styles.warningCard}>
          <AlertTriangle size={24} color={Colors.danger[600]} style={{ marginBottom: 8 }} />
          <Text style={styles.warningTitle}>Permanent Data Deletion</Text>
          <Text style={styles.warningDesc}>
            All transactions in the selected date range will be permanently removed. Account balances will be automatically corrected. This cannot be undone.
          </Text>
        </View>

        {/* Preset Buttons */}
        <Text style={styles.sectionTitle}>Quick Select</Text>
        <View style={styles.presetGrid}>
          {PRESETS.map((p) => (
            <TouchableOpacity key={p.label} style={styles.presetBtn} onPress={() => handlePreset(p)}>
              <Text style={styles.presetBtnText}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date Pickers */}
        <Text style={styles.sectionTitle}>Custom Range</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.datePill} onPress={() => setShowStartPicker(true)}>
            <Calendar size={16} color={Colors.primary[600]} />
            <View>
              <Text style={styles.datePillLabel}>From</Text>
              <Text style={styles.datePillValue}>{format(startDate, 'dd MMM yyyy')}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.datePill} onPress={() => setShowEndPicker(true)}>
            <Calendar size={16} color={Colors.primary[600]} />
            <View>
              <Text style={styles.datePillLabel}>To</Text>
              <Text style={styles.datePillValue}>{format(endDate, 'dd MMM yyyy')}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Preview */}
        <TouchableOpacity style={styles.previewBtn} onPress={handlePreview} disabled={previewing}>
          {previewing ? <ActivityIndicator color={Colors.primary[600]} /> : (
            <Text style={styles.previewBtnText}>Preview Affected Records</Text>
          )}
        </TouchableOpacity>

        {previewCount !== null && (
          <View style={[styles.previewResult, previewCount === 0 && styles.previewResultEmpty]}>
            <Text style={[styles.previewCount, previewCount > 0 && { color: Colors.danger[600] }]}>
              {previewCount}
            </Text>
            <Text style={styles.previewLabel}>
              {previewCount === 0 ? 'No records found in this range' : 'transactions will be permanently deleted'}
            </Text>
          </View>
        )}

        {/* Delete Button */}
        {previewCount !== null && previewCount > 0 && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => setShowConfirm(true)}
            disabled={deleting}
          >
            {deleting ? <ActivityIndicator color={Colors.white} /> : (
              <>
                <Trash2 size={18} color={Colors.white} />
                <Text style={styles.deleteBtnText}>Delete {previewCount} Records</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Deletion Log */}
        {deletionLog.length > 0 && (
          <View style={styles.logSection}>
            <View style={styles.logHeader}>
              <History size={16} color={Colors.gray[500]} />
              <Text style={styles.sectionTitle}>Past Deletions</Text>
            </View>
            {deletionLog.map((entry) => (
              <View key={entry.id} style={styles.logItem}>
                <View>
                  <Text style={styles.logRange}>{entry.start_date} → {entry.end_date}</Text>
                  <Text style={styles.logDate}>{format(new Date(entry.deleted_at.replace(' ', 'T') + 'Z'), 'dd MMM yyyy, hh:mm a')}</Text>
                </View>
                <View style={styles.logCountBadge}>
                  <Text style={styles.logCountText}>{entry.records_deleted} deleted</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {showStartPicker && (
        <DateTimePicker value={startDate} mode="date" maximumDate={endDate}
          onChange={(_, d) => { setShowStartPicker(false); if (d) setStartDate(d); setPreviewCount(null); }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker value={endDate} mode="date" minimumDate={startDate} maximumDate={new Date()}
          onChange={(_, d) => { setShowEndPicker(false); if (d) setEndDate(d); setPreviewCount(null); }}
        />
      )}

      <ConfirmActionSheet
        visible={showConfirm}
        title={`Delete ${previewCount} Transactions?`}
        description={`All records from ${format(startDate, 'MMM dd, yyyy')} to ${format(endDate, 'MMM dd, yyyy')} will be permanently removed. Account balances will be adjusted.`}
        confirmLabel="Delete Records"
        actionType="delete"
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: Colors.gray[100] },
  headerTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  scrollContent: { padding: 20, gap: 16, paddingBottom: 60 },
  warningCard: { backgroundColor: Colors.danger[50], borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: Colors.danger[100] },
  warningTitle: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.danger[700], marginBottom: 8 },
  warningDesc: { fontSize: Typography.size.sm, color: Colors.danger[600], textAlign: 'center', lineHeight: 20 },
  sectionTitle: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.gray[500], textTransform: 'uppercase', letterSpacing: 0.5 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray[200] },
  presetBtnText: { fontSize: Typography.size.sm, fontFamily: Typography.family.medium, color: Colors.gray[700] },
  dateRow: { flexDirection: 'row', gap: 12 },
  datePill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.gray[200], ...Layout.shadows.sm },
  datePillLabel: { fontSize: 10, fontFamily: Typography.family.bold, color: Colors.gray[400], textTransform: 'uppercase' },
  datePillValue: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  previewBtn: { backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.primary[400], borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  previewBtnText: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.primary[600] },
  previewResult: { backgroundColor: Colors.danger[50], borderRadius: 16, padding: 20, alignItems: 'center' },
  previewResultEmpty: { backgroundColor: Colors.success[50] },
  previewCount: { fontSize: 40, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  previewLabel: { fontSize: Typography.size.sm, color: Colors.gray[500], textAlign: 'center', marginTop: 4 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.danger[600], borderRadius: 16, paddingVertical: 16 },
  deleteBtnText: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.white },
  logSection: { gap: 12, marginTop: 16 },
  logHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.white, borderRadius: 14, padding: 14, ...Layout.shadows.sm },
  logRange: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.gray[800] },
  logDate: { fontSize: 11, fontFamily: Typography.family.regular, color: Colors.gray[400], marginTop: 2 },
  logCountBadge: { backgroundColor: Colors.danger[50], borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  logCountText: { fontSize: Typography.size.xs, fontFamily: Typography.family.bold, color: Colors.danger[700] },
});
