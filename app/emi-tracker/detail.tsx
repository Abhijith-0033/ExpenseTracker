import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Edit2, Calendar, DollarSign, Percent, Clock, CheckCircle, AlertCircle, TrendingUp, PieChart, BarChart } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { formatCurrency } from '../../utils/currency';
import { getEMIRecord, getEMIPayments, EMIRecord, EMIPayment, markPaymentAsPaid } from '../../services/emitracker/EMIEngine';
import { PieChart as GiftedPieChart, BarChart as GiftedBarChart } from 'react-native-gifted-charts';
import { format, parseISO, isBefore, isToday, differenceInDays } from 'date-fns';

const screenWidth = Dimensions.get('window').width;

export default function EMIDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const emiId = params.id ? parseInt(params.id) : 0;

  const [emiRecord, setEMIRecord] = useState<EMIRecord | null>(null);
  const [payments, setPayments] = useState<EMIPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!emiId) return;
    try {
      const record = await getEMIRecord(emiId);
      const paymentList = await getEMIPayments(emiId);
      setEMIRecord(record);
      setPayments(paymentList);
    } catch (error) {
      console.error('Error loading EMI details:', error);
      Alert.alert('Error', 'Failed to load EMI details');
    } finally {
      setLoading(false);
    }
  }, [emiId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const paidCount = payments.filter((p) => p.payment_status === 'paid').length;
  const pendingCount = payments.filter((p) => p.payment_status === 'pending').length;
  const overdueCount = payments.filter((p) => p.payment_status === 'overdue').length;
  const progress = (paidCount / (emiRecord?.tenure_months || 1)) * 100;
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
  const totalPrincipalPaid = payments.reduce((sum, p) => sum + (p.principal_component || 0), 0);
  const totalInterestPaid = payments.reduce((sum, p) => sum + (p.interest_component || 0), 0);

  const getPieData = () => {
    if (!emiRecord) return [];
    return [
      {
        value: totalPrincipalPaid,
        color: Colors.primary[600],
        text: 'Principal',
      },
      {
        value: totalInterestPaid,
        color: Colors.warning[600],
        text: 'Interest',
      },
      {
        value: emiRecord.total_amount - totalPaid,
        color: Colors.gray[300],
        text: 'Remaining',
      },
    ].filter((item) => item.value > 0);
  };

  const getBarData = () => {
    return payments.slice(0, 12).map((payment) => ({
      value: payment.amount_paid || 0,
      label: payment.month_number.toString(),
      frontColor: payment.payment_status === 'paid' ? Colors.success[600] : Colors.gray[300],
    }));
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return Colors.success[600];
      case 'overdue':
        return Colors.danger[600];
      case 'pending':
        return Colors.warning[600];
      default:
        return Colors.gray[500];
    }
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle size={16} color={Colors.success[600]} />;
      case 'overdue':
        return <AlertCircle size={16} color={Colors.danger[600]} />;
      default:
        return <Clock size={16} color={Colors.warning[600]} />;
    }
  };

  const handleMarkAsPaid = (payment: EMIPayment) => {
    Alert.alert(
      'Mark as Paid',
      `Are you sure you want to mark this payment as paid?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await markPaymentAsPaid(
                payment.id,
                format(new Date(), 'yyyy-MM-dd'),
                payment.amount_paid || emiRecord?.emi_amount || 0,
                null,
                null,
                'Manually marked as paid'
              );
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to mark payment as paid');
            }
          }
        }
      ]
    );
  };

  const handleEditPayment = (payment: EMIPayment) => {
    // This will open a bottom sheet for editing payment
    Alert.alert('Edit Payment', 'This feature will open a bottom sheet to edit the payment details.');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.gray[900]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>EMI Details</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!emiRecord) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.gray[900]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>EMI Details</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>EMI not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EMI Details</Text>
        <TouchableOpacity
          onPress={() => router.push(`/emi-tracker/edit?id=${emiId}` as any)}
          style={styles.editButton}
        >
          <Edit2 size={20} color={Colors.primary[600]} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* EMI Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryIconContainer}>
              <DollarSign size={24} color={Colors.primary[600]} />
            </View>
            <View style={styles.summaryHeaderContent}>
              <Text style={styles.summaryTitle}>{emiRecord.name}</Text>
              {emiRecord.lender_name && (
                <Text style={styles.summarySubtitle}>{emiRecord.lender_name}</Text>
              )}
            </View>
          </View>

          <View style={styles.summaryStats}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Monthly EMI</Text>
              <Text style={styles.statValue}>{formatCurrency(emiRecord.emi_amount)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Progress</Text>
              <Text style={styles.statValue}>{paidCount}/{emiRecord.tenure_months}</Text>
            </View>
          </View>

          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{progress.toFixed(1)}% Complete</Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.quickStatItem}>
            <Percent size={20} color={Colors.warning[600]} />
            <Text style={styles.quickStatLabel}>Interest Rate</Text>
            <Text style={styles.quickStatValue}>{emiRecord.interest_rate}% p.a.</Text>
          </View>
          <View style={styles.quickStatItem}>
            <Clock size={20} color={Colors.primary[600]} />
            <Text style={styles.quickStatLabel}>Tenure</Text>
            <Text style={styles.quickStatValue}>{emiRecord.tenure_months} months</Text>
          </View>
          <View style={styles.quickStatItem}>
            <Calendar size={20} color={Colors.success[600]} />
            <Text style={styles.quickStatLabel}>Start Date</Text>
            <Text style={styles.quickStatValue}>{format(parseISO(emiRecord.start_date), 'MMM yyyy')}</Text>
          </View>
        </View>

        {/* Charts Section */}
        <View style={styles.chartsSection}>
          <Text style={styles.sectionTitle}>Payment Breakdown</Text>
          {getPieData().length > 0 && (
            <View style={styles.chartCard}>
              <GiftedPieChart
                data={getPieData()}
                donut
                radius={80}
                innerRadius={50}
                centerLabelComponent={() => (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.chartCenterLabel}>Total</Text>
                    <Text style={styles.chartCenterValue}>{formatCurrency(totalPaid)}</Text>
                  </View>
                )}
              />
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.primary[600] }]} />
                  <Text style={styles.legendText}>Principal</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.warning[600] }]} />
                  <Text style={styles.legendText}>Interest</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.gray[300] }]} />
                  <Text style={styles.legendText}>Remaining</Text>
                </View>
              </View>
            </View>
          )}

          <Text style={[styles.sectionTitle, { marginTop: Layout.spacing.lg }]}>Monthly Payments</Text>
          {getBarData().length > 0 && (
            <View style={styles.chartCard}>
              <GiftedBarChart
                data={getBarData()}
                barWidth={20}
                spacing={10}
                frontColor={Colors.primary[600]}
                noOfSections={4}
                isAnimated
              />
            </View>
          )}
        </View>

        {/* Payment History */}
        <View style={styles.paymentHistorySection}>
          <View style={styles.paymentHistoryHeader}>
            <Text style={styles.sectionTitle}>Payment History</Text>
            <View style={styles.paymentStats}>
              <View style={styles.paymentStatBadge}>
                <CheckCircle size={14} color={Colors.success[600]} />
                <Text style={styles.paymentStatText}>{paidCount} Paid</Text>
              </View>
              <View style={styles.paymentStatBadge}>
                <Clock size={14} color={Colors.warning[600]} />
                <Text style={styles.paymentStatText}>{pendingCount} Pending</Text>
              </View>
              <View style={styles.paymentStatBadge}>
                <AlertCircle size={14} color={Colors.danger[600]} />
                <Text style={styles.paymentStatText}>{overdueCount} Overdue</Text>
              </View>
            </View>
          </View>

          {payments.map((payment) => (
            <View key={payment.id} style={styles.paymentCard}>
              <View style={styles.paymentCardHeader}>
                <View style={styles.paymentMonth}>
                  <Text style={styles.paymentMonthText}>Month {payment.month_number}</Text>
                  <Text style={styles.paymentDate}>{format(parseISO(payment.due_date), 'MMM dd, yyyy')}</Text>
                </View>
                <View style={[styles.paymentStatusBadge, { backgroundColor: `${getPaymentStatusColor(payment.payment_status)}20` }]}>
                  {getPaymentStatusIcon(payment.payment_status)}
                  <Text style={[styles.paymentStatusText, { color: getPaymentStatusColor(payment.payment_status) }]}>
                    {payment.payment_status.charAt(0).toUpperCase() + payment.payment_status.slice(1)}
                  </Text>
                </View>
              </View>

              <View style={styles.paymentCardBody}>
                <View style={styles.paymentDetailRow}>
                  <Text style={styles.paymentDetailLabel}>Amount</Text>
                  <Text style={styles.paymentDetailValue}>{formatCurrency(payment.amount_paid || 0)}</Text>
                </View>
                <View style={styles.paymentDetailRow}>
                  <Text style={styles.paymentDetailLabel}>Principal</Text>
                  <Text style={styles.paymentDetailValue}>{formatCurrency(payment.principal_component || 0)}</Text>
                </View>
                <View style={styles.paymentDetailRow}>
                  <Text style={styles.paymentDetailLabel}>Interest</Text>
                  <Text style={styles.paymentDetailValue}>{formatCurrency(payment.interest_component || 0)}</Text>
                </View>
                <View style={styles.paymentDetailRow}>
                  <Text style={styles.paymentDetailLabel}>Outstanding</Text>
                  <Text style={styles.paymentDetailValue}>{formatCurrency(payment.outstanding_balance || 0)}</Text>
                </View>
              </View>

              {payment.payment_status === 'pending' && (
                <View style={styles.paymentActions}>
                  <TouchableOpacity
                    style={styles.paymentActionButton}
                    onPress={() => handleMarkAsPaid(payment)}
                  >
                    <CheckCircle size={16} color={Colors.success[600]} />
                    <Text style={styles.paymentActionText}>Mark as Paid</Text>
                  </TouchableOpacity>
                </View>
              )}

              {payment.payment_status === 'paid' && (
                <View style={styles.paymentActions}>
                  <TouchableOpacity
                    style={styles.paymentActionButton}
                    onPress={() => handleEditPayment(payment)}
                  >
                    <Edit2 size={16} color={Colors.primary[600]} />
                    <Text style={styles.paymentActionText}>Edit Payment</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.md,
    backgroundColor: Colors.white,
    ...Layout.shadows.sm,
  },
  backButton: {
    padding: Layout.spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  headerRight: {
    width: 40,
  },
  editButton: {
    padding: Layout.spacing.sm,
  },
  content: {
    flex: 1,
    padding: Layout.spacing.lg,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.medium,
    color: Colors.gray[500],
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.md,
    ...Layout.shadows.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Layout.spacing.lg,
  },
  summaryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: Layout.radius.lg,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Layout.spacing.md,
  },
  summaryHeaderContent: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Layout.spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.gray[50],
    borderRadius: Layout.radius.md,
    padding: Layout.spacing.md,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: Colors.gray[600],
    marginBottom: 4,
  },
  statValue: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  progressBarContainer: {
    marginTop: Layout.spacing.sm,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: Colors.gray[200],
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary[600],
  },
  progressText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: Colors.gray[600],
    marginTop: Layout.spacing.xs,
    textAlign: 'center',
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Layout.spacing.md,
  },
  quickStatItem: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.md,
    padding: Layout.spacing.md,
    alignItems: 'center',
    marginHorizontal: Layout.spacing.xs,
    ...Layout.shadows.sm,
  },
  quickStatLabel: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: Colors.gray[600],
    marginTop: Layout.spacing.xs,
    marginBottom: 2,
  },
  quickStatValue: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  chartsSection: {
    marginBottom: Layout.spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: Layout.spacing.md,
  },
  chartCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.lg,
    alignItems: 'center',
    ...Layout.shadows.sm,
  },
  chartCenterLabel: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: Colors.gray[500],
  },
  chartCenterValue: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Layout.spacing.lg,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Layout.spacing.sm,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Layout.spacing.xs,
  },
  legendText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: Colors.gray[600],
  },
  paymentHistorySection: {
    marginBottom: Layout.spacing.xl,
  },
  paymentHistoryHeader: {
    marginBottom: Layout.spacing.md,
  },
  paymentStats: {
    flexDirection: 'row',
    marginTop: Layout.spacing.sm,
    gap: Layout.spacing.sm,
  },
  paymentStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Layout.spacing.sm,
    paddingVertical: Layout.spacing.xs,
    borderRadius: Layout.radius.sm,
    ...Layout.shadows.sm,
  },
  paymentStatText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
    color: Colors.gray[700],
    marginLeft: Layout.spacing.xs,
  },
  paymentCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.md,
    padding: Layout.spacing.md,
    marginBottom: Layout.spacing.sm,
    ...Layout.shadows.sm,
  },
  paymentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Layout.spacing.md,
  },
  paymentMonth: {
    flex: 1,
  },
  paymentMonthText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  paymentDate: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
    marginTop: 2,
  },
  paymentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.sm,
    paddingVertical: Layout.spacing.xs,
    borderRadius: Layout.radius.sm,
  },
  paymentStatusText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
    marginLeft: Layout.spacing.xs,
  },
  paymentCardBody: {
    marginBottom: Layout.spacing.sm,
  },
  paymentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Layout.spacing.xs,
  },
  paymentDetailLabel: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.gray[600],
  },
  paymentDetailValue: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  paymentActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
    paddingTop: Layout.spacing.sm,
  },
  paymentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Layout.spacing.sm,
  },
  paymentActionText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.primary[600],
    marginLeft: Layout.spacing.xs,
  },
});
