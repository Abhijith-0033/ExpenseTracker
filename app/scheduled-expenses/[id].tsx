import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Switch } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Edit2, Trash2, Calendar, Clock, ShieldCheck, Pause, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { formatCurrency } from '../../utils/currency';
import { getDatabase, getScheduledExpenseById, updateScheduledExpense, softDeleteScheduledExpense, ScheduledExpenseJoined } from '../../services/database';
import { useSubscription } from '../../src/subscription/useSubscription';
import PaywallScreen from '../../src/subscription/PaywallScreen';
import { scheduleNotificationsForExpense, cancelNotificationsForExpense } from '../../src/scheduled/ScheduledExpenseEngine';
import { ConfirmActionSheet } from '../../components/ConfirmActionSheet';

const DAYS_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ScheduledExpenseDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = params.id ? parseInt(params.id as string) : null;

  const { isPremium, isTrialActive } = useSubscription();

  const [item, setItem] = useState<ScheduledExpenseJoined | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmSheet, setConfirmSheet] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    actionType: 'delete' | 'edit' | 'approve' | 'pay' | 'warning';
    onConfirm: () => void;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const db = getDatabase();
      const details = await getScheduledExpenseById(id);
      if (!details) {
        Alert.alert('Error', 'Scheduled expense not found');
        router.back();
        return;
      }
      setItem(details);

      const allLogs = await db.getAllAsync(`
        SELECT * FROM scheduled_expense_log 
        WHERE scheduled_expense_id = ? 
        ORDER BY created_at DESC 
        LIMIT 20
      `, [id]);
      setLogs(allLogs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!isPremium && !isTrialActive) {
    return <PaywallScreen showClose={true} />;
  }

  const handleToggleActive = async () => {
    if (!item) return;
    const newStatus = item.is_active === 1 ? 0 : 1;
    // Optimistic UI update to prevent shivering
    setItem(prev => prev ? { ...prev, is_active: newStatus } : prev);
    
    try {
      await updateScheduledExpense(item.id, { is_active: newStatus });
      const updatedItem = { ...item, is_active: newStatus };
      if (newStatus === 1) {
        await scheduleNotificationsForExpense(updatedItem);
      } else {
        await cancelNotificationsForExpense(item.id);
      }
      loadData();
    } catch (_e) {
      // Revert on failure
      setItem(prev => prev ? { ...prev, is_active: item.is_active } : prev);
      Alert.alert('Error', 'Failed to update schedule status');
    }
  };

  const handleDelete = () => {
    if (!item) return;
    setConfirmSheet({
      title: 'Delete Schedule?',
      description: 'Are you sure you want to delete this scheduled expense? This will stop future runs and cannot be undone.',
      confirmLabel: 'Delete',
      actionType: 'delete',
      onConfirm: async () => {
        setConfirmSheet(null);
        try {
          await softDeleteScheduledExpense(item.id);
          await cancelNotificationsForExpense(item.id);
          router.replace('/scheduled-expenses');
        } catch (_e) {
          Alert.alert('Error', 'Failed to delete scheduled expense');
        }
      }
    });
  };

  const getDaysFormatted = (daysJson: string) => {
    try {
      const days = JSON.parse(daysJson) as number[];
      return days.map(d => DAYS_NAMES[d - 1]).join(', ');
    } catch {
      return '';
    }
  };

  const getLogActionIcon = (action: string) => {
    switch (action) {
      case 'auto_created': return <ShieldCheck size={16} color={Colors.success[600]} />;
      case 'approved': return <CheckCircle2 size={16} color={Colors.success[600]} />;
      case 'rejected': return <XCircle size={16} color={Colors.danger[600]} />;
      case 'missed': return <AlertTriangle size={16} color={Colors.warning[600]} />;
      default: return <Clock size={16} color={Colors.gray[400]} />;
    }
  };

  const getLogActionLabel = (action: string) => {
    switch (action) {
      case 'auto_created': return 'Auto-Created';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'missed': return 'Missed';
      case 'pending': return 'Pending Approval';
      default: return action;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </SafeAreaView>
    );
  }

  if (!item) return null;

  const isPaused = item.is_active === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule Details</Text>
        <TouchableOpacity onPress={() => router.push(`/scheduled-expenses/add?id=${item.id}`)} style={styles.editBtn}>
          <Edit2 size={18} color={Colors.gray[800]} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main Card */}
        <View style={[styles.mainCard, isPaused && styles.pausedCard]}>
          <Text style={styles.cardLabel}>{item.category_name} · {item.account_name}</Text>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardAmount}>{formatCurrency(item.amount)}</Text>
          {isPaused && (
            <View style={styles.pausedBadge}>
              <Pause size={12} color={Colors.warning[600]} style={{ marginRight: 4 }} />
              <Text style={styles.pausedBadgeText}>PAUSED</Text>
            </View>
          )}
        </View>

        {/* Info List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scheduling</Text>
          <View style={styles.infoRow}>
            <Calendar size={18} color={Colors.gray[400]} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Repeats On</Text>
              <Text style={styles.infoValue}>{getDaysFormatted(item.days_of_week)}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Clock size={18} color={Colors.gray[400]} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Time</Text>
              <Text style={styles.infoValue}>{item.scheduled_time}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <ShieldCheck size={18} color={Colors.gray[400]} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Method</Text>
              <Text style={styles.infoValue}>{item.auto_create === 1 ? 'Auto-create transaction' : 'Require approval notification'}</Text>
            </View>
          </View>
          {item.description && (
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1, marginLeft: 30 }}>
                <Text style={styles.infoLabel}>Description</Text>
                <Text style={styles.infoValue}>{item.description}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Status Toggle Row */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>{isPaused ? 'Resume Schedule' : 'Pause Schedule'}</Text>
            <Text style={styles.toggleDesc}>{isPaused ? 'Enable this schedule to resume auto runs.' : 'Temporarily stop all scheduled alerts and transactions.'}</Text>
          </View>
          <Switch
            value={item.is_active === 1}
            onValueChange={handleToggleActive}
            trackColor={{ false: Colors.gray[200], true: Colors.primary[500] }}
            thumbColor={Colors.white}
          />
        </View>

        {/* History Log */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>History & Logs</Text>
          {logs.length === 0 ? (
            <Text style={styles.emptyLogsText}>No executions logged for this schedule yet.</Text>
          ) : (
            logs.map(log => (
              <View key={log.id} style={styles.logRow}>
                <View style={styles.logLeft}>
                  {getLogActionIcon(log.action)}
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.logActionName}>{getLogActionLabel(log.action)}</Text>
                    <Text style={styles.logDate}>{log.scheduled_date} at {log.scheduled_time}</Text>
                  </View>
                </View>
                <Text style={[styles.logAmount, log.action === 'rejected' && { textDecorationLine: 'line-through', color: Colors.gray[400] }]}>
                  {formatCurrency(log.amount)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Delete action button */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Trash2 size={18} color={Colors.danger[600]} style={{ marginRight: 8 }} />
          <Text style={styles.deleteBtnText}>Delete Scheduled Expense</Text>
        </TouchableOpacity>
      </ScrollView>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.gray[50] },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    ...Layout.shadows.sm
  },
  backBtn: { 
    padding: 10, 
    backgroundColor: Colors.white, 
    borderRadius: 12,
    ...Layout.shadows.sm
  },
  editBtn: { 
    padding: 10, 
    backgroundColor: Colors.white, 
    borderRadius: 12,
    ...Layout.shadows.sm
  },
  headerTitle: { fontSize: 20, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  scrollContent: { padding: 20, paddingBottom: 100 },
  mainCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    ...Layout.shadows.sm,
    borderWidth: 1,
    borderColor: Colors.gray[100]
  },
  pausedCard: {
    opacity: 0.7,
    backgroundColor: Colors.gray[100]
  },
  cardLabel: {
    fontSize: 12,
    fontFamily: Typography.family.bold,
    color: Colors.primary[600],
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8
  },
  cardName: {
    fontSize: 22,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 8,
    textAlign: 'center'
  },
  cardAmount: {
    fontSize: 32,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900]
  },
  pausedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning[50],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 12
  },
  pausedBadgeText: {
    fontSize: 10,
    fontFamily: Typography.family.bold,
    color: Colors.warning[700]
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    ...Layout.shadows.sm
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 16
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100]
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: Typography.family.bold,
    color: Colors.gray[400],
    textTransform: 'uppercase'
  },
  infoValue: {
    fontSize: 14,
    fontFamily: Typography.family.medium,
    color: Colors.gray[800],
    marginTop: 2
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    ...Layout.shadows.sm
  },
  toggleTitle: {
    fontSize: 15,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 4
  },
  toggleDesc: {
    fontSize: 12,
    color: Colors.gray[400],
    lineHeight: 18,
    fontFamily: Typography.family.regular
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[50]
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  logActionName: {
    fontSize: 14,
    fontFamily: Typography.family.bold,
    color: Colors.gray[800]
  },
  logDate: {
    fontSize: 11,
    color: Colors.gray[400],
    fontFamily: Typography.family.medium,
    marginTop: 2
  },
  logAmount: {
    fontSize: 14,
    fontFamily: Typography.family.bold,
    color: Colors.gray[700]
  },
  emptyLogsText: {
    fontSize: 13,
    color: Colors.gray[400],
    fontFamily: Typography.family.medium,
    textAlign: 'center',
    paddingVertical: 16
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger[50],
    borderRadius: 20,
    height: 56,
    marginTop: 12
  },
  deleteBtnText: {
    color: Colors.danger[700] || Colors.danger[600],
    fontFamily: Typography.family.bold,
    fontSize: 15
  }
});
