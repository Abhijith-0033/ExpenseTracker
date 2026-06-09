import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useRouter , useFocusEffect } from 'expo-router';
import { Plus, CreditCard, Calendar, DollarSign, AlertCircle, CheckCircle, Clock, ChevronRight } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { formatCurrency } from '../../utils/currency';
import { getEMIRecords, getEMIPayments, deleteEMIRecord, EMIRecord } from '../../services/emitracker/EMIEngine';
import { SwipeableRow } from '../../components/SwipeableRow';
import { initDatabase } from '../../services/database';


export default function EMITrackerScreen() {
  const router = useRouter();
  const [emiRecords, setEMIRecords] = useState<EMIRecord[]>([]);
  const [paymentStats, setPaymentStats] = useState<{ pending: number; overdue: number; paid: number }>({
    pending: 0,
    overdue: 0,
    paid: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      await initDatabase();
      const records = await getEMIRecords();
      setEMIRecords(records);

      // Calculate payment stats
      let pending = 0;
      let overdue = 0;
      let paid = 0;

      for (const record of records) {
        if (record.status === 'active') {
          const payments = await getEMIPayments(record.id);
          payments.forEach((payment) => {
            if (payment.payment_status === 'pending') {
              const today = new Date();
              const dueDate = new Date(payment.due_date);
              if (dueDate < today) {
                overdue++;
              } else {
                pending++;
              }
            } else if (payment.payment_status === 'paid') {
              paid++;
            }
          });
        }
      }

      setPaymentStats({ pending, overdue, paid });
    } catch (error) {
      console.error('Error loading EMI records:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleDelete = async (id: number, name: string) => {
    Alert.alert(
      'Delete EMI',
      `Are you sure you want to delete "${name}"? This will also delete all payment history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEMIRecord(id);
              loadData();
            } catch (error) {
              console.error('Error deleting EMI:', error);
              Alert.alert('Error', 'Failed to delete EMI');
            }
          },
        },
      ]
    );
  };

  const handleEdit = (id: number) => {
    router.push(`/emi-tracker/edit?id=${id}` as any);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return Colors.success[600];
      case 'completed':
        return Colors.primary[600];
      case 'paused':
        return Colors.warning[600];
      default:
        return Colors.gray[500];
    }
  };

  const _getProgress = async (record: EMIRecord) => {
    const payments = await getEMIPayments(record.id);
    const paidCount = payments.filter((p) => p.payment_status === 'paid').length;
    return (paidCount / record.tenure_months) * 100;
  };

  const renderEMICard = (record: EMIRecord) => {
    const isAutopay = record.is_autopay === 1;

    return (
      <SwipeableRow
        key={record.id}
        onDelete={() => handleDelete(record.id, record.name)}
        onEdit={() => handleEdit(record.id)}
      >
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push(`/emi-tracker/detail?id=${record.id}` as any)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardIconContainer}>
              <CreditCard size={24} color={Colors.primary[600]} />
            </View>
            <View style={styles.cardHeaderContent}>
              <Text style={styles.cardTitle}>{record.name}</Text>
              {record.lender_name && (
                <Text style={styles.cardSubtitle}>{record.lender_name}</Text>
              )}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(record.status)}20` }]}>
              <Text style={[styles.statusText, { color: getStatusColor(record.status) }]}>
                {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
              </Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <DollarSign size={16} color={Colors.gray[500]} />
                <Text style={styles.statLabel}>EMI Amount</Text>
                <Text style={styles.statValue}>{formatCurrency(record.emi_amount)}</Text>
              </View>
              <View style={styles.statItem}>
                <Calendar size={16} color={Colors.gray[500]} />
                <Text style={styles.statLabel}>Tenure</Text>
                <Text style={styles.statValue}>{record.tenure_months} months</Text>
              </View>
            </View>

            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Principal</Text>
                <Text style={styles.statValue}>{formatCurrency(record.principal)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Interest</Text>
                <Text style={styles.statValue}>{record.interest_rate}% p.a.</Text>
              </View>
            </View>

            {isAutopay && (
              <View style={styles.autopayBadge}>
                <CheckCircle size={14} color={Colors.success[600]} />
                <Text style={styles.autopayText}>AutoPay Enabled</Text>
              </View>
            )}
          </View>

          <ChevronRight size={20} color={Colors.gray[300]} style={styles.chevron} />
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>EMI Tracker</Text>
          <Text style={styles.headerSubtitle}>Track your loan EMIs</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>EMI Tracker</Text>
        <Text style={styles.headerSubtitle}>Track your loan EMIs</Text>
      </View>

      {/* Summary Grid */}
      <View style={styles.metricsGridContainer}>
        <View style={styles.metricsGridRow}>
          <View style={styles.metricCardHalf}>
            <View style={[styles.metricCardIcon, { backgroundColor: 'rgba(124, 58, 237, 0.1)' }]}>
              <CreditCard size={18} color={Colors.primary[600]} />
            </View>
            <Text style={styles.metricGridLabel}>Active EMIs</Text>
            <Text style={[styles.metricGridValue, { color: Colors.primary[700] }]}>
              {emiRecords.filter((r) => r.status === 'active').length}
            </Text>
          </View>

          <View style={styles.metricCardHalf}>
            <View style={[styles.metricCardIcon, { backgroundColor: Colors.accent.rose }]}>
              <AlertCircle size={18} color={Colors.danger[600]} />
            </View>
            <Text style={styles.metricGridLabel}>Overdue Payments</Text>
            <Text style={[styles.metricGridValue, { color: Colors.danger[700] }]}>
              {paymentStats.overdue}
            </Text>
          </View>
        </View>

        <View style={styles.metricsGridRow}>
          <View style={styles.metricCardHalf}>
            <View style={[styles.metricCardIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
              <Clock size={18} color="#F59E0B" />
            </View>
            <Text style={styles.metricGridLabel}>Pending Next</Text>
            <Text style={[styles.metricGridValue, { color: '#B45309' }]}>
              {paymentStats.pending}
            </Text>
          </View>

          <View style={styles.metricCardHalf}>
            <View style={[styles.metricCardIcon, { backgroundColor: Colors.accent.mint }]}>
              <CheckCircle size={18} color={Colors.success[600]} />
            </View>
            <Text style={styles.metricGridLabel}>Total Paid</Text>
            <Text style={[styles.metricGridValue, { color: Colors.success[700] }]}>
              {paymentStats.paid}
            </Text>
          </View>
        </View>
      </View>

      {/* EMI List */}
      <ScrollView
        style={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {emiRecords.length === 0 ? (
          <View style={styles.emptyState}>
            <CreditCard size={64} color={Colors.gray[300]} />
            <Text style={styles.emptyTitle}>No EMI Records</Text>
            <Text style={styles.emptySubtitle}>Add your first EMI to start tracking</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/emi-tracker/add' as any)}
            >
              <Plus size={20} color={Colors.white} />
              <Text style={styles.emptyButtonText}>Add EMI</Text>
            </TouchableOpacity>
          </View>
        ) : (
          emiRecords.map(renderEMICard)
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/emi-tracker/add' as any)}
      >
        <Plus size={24} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray[50],
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.md,
  },
  headerTitle: {
    fontSize: Typography.size.xxxl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[500],
  },
  metricsGridContainer: {
    paddingHorizontal: Layout.spacing.lg,
    marginBottom: Layout.spacing.lg,
    gap: 12,
  },
  metricsGridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCardHalf: {
    flex: 1,
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 24,
    ...Layout.shadows.sm,
  },
  metricCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricGridLabel: {
    fontFamily: Typography.family.medium,
    fontSize: Typography.size.xs,
    color: Colors.gray[600],
    marginBottom: 4,
  },
  metricGridValue: {
    fontFamily: Typography.family.bold,
    fontSize: Typography.size.lg,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: Layout.spacing.lg,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.md,
    marginBottom: Layout.spacing.sm,
    ...Layout.shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Layout.spacing.md,
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Layout.spacing.md,
  },
  cardHeaderContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
  },
  statusBadge: {
    paddingHorizontal: Layout.spacing.sm,
    paddingVertical: Layout.spacing.xs,
    borderRadius: Layout.radius.sm,
  },
  statusText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
  },
  cardBody: {
    marginBottom: Layout.spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Layout.spacing.sm,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: Colors.gray[500],
    marginLeft: Layout.spacing.xs,
  },
  statValue: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginLeft: Layout.spacing.xs,
  },
  autopayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success[50],
    paddingHorizontal: Layout.spacing.sm,
    paddingVertical: Layout.spacing.xs,
    borderRadius: Layout.radius.sm,
    alignSelf: 'flex-start',
  },
  autopayText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
    color: Colors.success[600],
    marginLeft: Layout.spacing.xs,
  },
  chevron: {
    position: 'absolute',
    right: Layout.spacing.md,
    top: Layout.spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.medium,
    color: Colors.gray[500],
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Layout.spacing.xxl,
  },
  emptyTitle: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginTop: Layout.spacing.lg,
    marginBottom: Layout.spacing.xs,
  },
  emptySubtitle: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
    marginBottom: Layout.spacing.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[600],
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.md,
  },
  emptyButtonText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.white,
    marginLeft: Layout.spacing.sm,
  },
  fab: {
    position: 'absolute',
    bottom: Layout.spacing.xl,
    right: Layout.spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    ...Layout.shadows.md,
  },
});
