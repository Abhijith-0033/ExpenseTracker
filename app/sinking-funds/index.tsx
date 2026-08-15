import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, Target } from 'lucide-react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Colors, Typography, Layout, SemanticColors } from '../../constants/Theme';
import { formatCurrency } from '../../utils/currency';
import { getSinkingFunds, deleteSinkingFund, getTotalSaved } from '../../services/sinkingfunds/sinkingFundService';
import { getFundStatus, SinkingFund } from '../../services/sinkingfunds/SinkingFundEngine';
import { Snackbar } from '../../components/Snackbar';
import { format } from 'date-fns';
import { ConfirmActionSheet, ConfirmActionType } from '../../components/ConfirmActionSheet';

export default function SinkingFundsScreen() {
  const router = useRouter();
  const [funds, setFunds] = useState<(SinkingFund & { totalSaved: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [confirmSheet, setConfirmSheet] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    actionType: ConfirmActionType;
    onConfirm: () => void;
  } | null>(null);

  const loadFunds = useCallback(async () => {
    const rawFunds = await getSinkingFunds();
    const withSaved = await Promise.all(rawFunds.map(async f => ({
      ...f,
      totalSaved: await getTotalSaved(f.id),
    })));
    setFunds(withSaved);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { loadFunds(); }, [loadFunds]));

  const handleDelete = (fund: SinkingFund) => {
    setConfirmSheet({
      title: 'Delete Fund?',
      description: `Delete "${fund.name}" and all contributions? This action cannot be undone.`,
      confirmLabel: 'Delete',
      actionType: 'delete',
      onConfirm: async () => {
        setConfirmSheet(null);
        await deleteSinkingFund(fund.id);
        loadFunds();
        setSnackbarMessage('Fund deleted');
        setSnackbarVisible(true);
      }
    });
  };

  const totalSavingMonthly = funds.reduce((s, f) => s + f.monthly_contribution, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sinking Funds</Text>
        <TouchableOpacity onPress={() => router.push('/sinking-funds/add' as any)} style={styles.addBtn}>
          <Plus size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadFunds(); }} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
      >
        {/* Summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Monthly Saving</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(totalSavingMonthly)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Active Funds</Text>
            <Text style={styles.summaryAmount}>{funds.length}</Text>
          </View>
        </View>

        {funds.length === 0 && !loading ? (
          <View style={styles.emptyState}>
            <Target size={48} color={Colors.gray[400]} />
            <Text style={styles.emptyTitle}>No sinking funds yet</Text>
            <Text style={styles.emptySubtitle}>
              Create funds for annual insurance, vacation, vehicle service, or any predictable big expense.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/sinking-funds/add' as any)}>
              <Text style={styles.emptyBtnText}>Create First Fund</Text>
            </TouchableOpacity>
          </View>
        ) : (
          funds.map(fund => {
            const status = getFundStatus(fund, fund.totalSaved);
            const statusColor = status.status === 'on_track' ? SemanticColors.income
              : status.status === 'completed' ? SemanticColors.income
              : status.status === 'overdue' ? SemanticColors.expense
              : '#F59E0B';
            const statusLabel = status.status === 'on_track' ? 'On Track'
              : status.status === 'completed' ? 'Completed'
              : status.status === 'overdue' ? 'Overdue'
              : 'Behind';
            const pct = Math.min(100, status.percentComplete);

            return (
              <Swipeable
                key={fund.id}
                renderRightActions={() => (
                  <TouchableOpacity
                    style={styles.deleteAction}
                    onPress={() => handleDelete(fund)}
                  >
                    <Text style={styles.deleteActionText}>Delete</Text>
                  </TouchableOpacity>
                )}
              >
                <TouchableOpacity style={styles.fundCard} activeOpacity={0.7}>
                  <View style={styles.fundCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fundName}>{fund.name}</Text>
                      <Text style={styles.fundDate}>
                        Target: {format(new Date(fund.target_date), 'MMM dd, yyyy')}
                      </Text>
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: statusColor + '20' }]}>
                      <Text style={[styles.statusChipText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, {
                      width: `${pct}%`,
                      backgroundColor: statusColor
                    }]} />
                  </View>
                  <View style={styles.progressRow}>
                    <Text style={styles.progressSaved}>{formatCurrency(fund.totalSaved)} saved</Text>
                    <Text style={styles.progressPct}>{pct.toFixed(0)}%</Text>
                    <Text style={styles.progressTarget}>{formatCurrency(fund.target_amount)} goal</Text>
                  </View>

                  <View style={styles.fundFooter}>
                    <Text style={styles.fundMonthly}>
                      {formatCurrency(status.status === 'behind' ? status.catchUpMonthly : fund.monthly_contribution)}/month
                      {status.status === 'behind' ? ' (catch-up)' : ''}
                    </Text>
                    <Text style={styles.fundMonthsLeft}>
                      {status.monthsRemaining > 0 ? `${status.monthsRemaining} months left` : 'Due now'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Swipeable>
            );
          })
        )}
      </ScrollView>

      <Snackbar visible={snackbarVisible} message={snackbarMessage} onDismiss={() => setSnackbarVisible(false)} />
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: Colors.white },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary[600], justifyContent: 'center', alignItems: 'center' },
  summaryCard: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: Layout.radius.lg, padding: 20, marginTop: 16, marginBottom: 20, ...Layout.shadows.md },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: Typography.size.sm, color: Colors.gray[500], fontFamily: Typography.family.medium, marginBottom: 4 },
  summaryAmount: { fontSize: Typography.size.xxl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  divider: { width: 1, backgroundColor: Colors.gray[200], marginHorizontal: 20 },
  fundCard: { backgroundColor: Colors.white, borderRadius: Layout.radius.lg, padding: 16, marginBottom: 12, ...Layout.shadows.sm },
  fundCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  fundName: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.gray[900], marginBottom: 2 },
  fundDate: { fontSize: Typography.size.xs, color: Colors.gray[400] },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Layout.radius.full },
  statusChipText: { fontSize: Typography.size.xs, fontFamily: Typography.family.bold },
  progressTrack: { height: 8, backgroundColor: Colors.gray[200], borderRadius: Layout.radius.full, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: Layout.radius.full },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressSaved: { fontSize: Typography.size.xs, color: Colors.gray[500] },
  progressPct: { fontSize: Typography.size.xs, fontFamily: Typography.family.bold, color: Colors.gray[700] },
  progressTarget: { fontSize: Typography.size.xs, color: Colors.gray[500] },
  fundFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.gray[100], paddingTop: 10 },
  fundMonthly: { fontSize: Typography.size.sm, fontFamily: Typography.family.medium, color: Colors.primary[600] },
  fundMonthsLeft: { fontSize: Typography.size.sm, color: Colors.gray[400] },
  deleteAction: { backgroundColor: Colors.danger[500], justifyContent: 'center', alignItems: 'center', width: 80, marginBottom: 12, borderRadius: Layout.radius.lg, marginLeft: 8 },
  deleteActionText: { color: Colors.white, fontSize: Typography.size.sm, fontFamily: Typography.family.bold },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[600], marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: Typography.size.md, color: Colors.gray[500], textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyBtn: { backgroundColor: Colors.primary[600], paddingHorizontal: 24, paddingVertical: 12, borderRadius: Layout.radius.lg },
  emptyBtnText: { color: Colors.white, fontSize: Typography.size.md, fontFamily: Typography.family.bold },
});
