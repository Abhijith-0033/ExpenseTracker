import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus, TrendingDown, Calendar, DollarSign, Percent, Clock, CheckCircle } from 'lucide-react-native';
import { Colors, Layout, Typography, SemanticColors } from '../../constants/Theme';
import { getDebtRecordById, getDebtRepayments, addDebtRepayment, deleteDebtRepayment } from '../../services/debttracker/debtService';
import { getAccounts, Account } from '../../services/database';
import { calculateCurrentBalance, analyzePaymentHistory, DebtRecord } from '../../services/debttracker/DebtEngine';
import { formatCurrency } from '../../utils/currency';
import { Snackbar } from '../../components/Snackbar';
import { AccountSelector } from '../../components/AccountSelector';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import { format } from 'date-fns';

export default function DebtDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const debtId = parseInt(id);
  
  const [debt, setDebt] = useState<DebtRecord | null>(null);
  const [repayments, setRepayments] = useState<any[]>([]);
  const [calculation, setCalculation] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addPaymentModalVisible, setAddPaymentModalVisible] = useState(false);
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  // Snackbar state
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Form state for adding payment
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentType, setPaymentType] = useState<'principal' | 'interest' | 'both'>('principal');
  const [paymentNote, setPaymentNote] = useState('');

  const fetchData = async () => {
    try {
      const debtData = await getDebtRecordById(debtId);
      if (!debtData) {
        Alert.alert('Error', 'Debt not found');
        router.back();
        return;
      }
      
      const repaymentsData = await getDebtRepayments(debtId);
      const calculationData = calculateCurrentBalance(debtData, repaymentsData);
      const historyData = analyzePaymentHistory(debtData, repaymentsData);
      
      setDebt(debtData);
      setRepayments(repaymentsData);
      setCalculation(calculationData);
      setPaymentHistory(historyData);

      const accountsData = await getAccounts();
      setAccounts(accountsData);
    } catch (error) {
      console.error('Failed to fetch debt details:', error);
      Alert.alert('Error', 'Failed to load debt details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (debtId) {
      fetchData();
    }
  }, [debtId]);

  const handleAddPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount');
      return;
    }

    try {
      await addDebtRepayment({
        debt_id: debtId,
        amount: parseFloat(paymentAmount),
        payment_date: paymentDate,
        payment_type: paymentType,
        note: paymentNote || undefined,
        account_id: selectedAccountId || undefined
      });

      // Reset form
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentType('principal');
      setPaymentNote('');
      setSelectedAccountId(null);
      setAddPaymentModalVisible(false);

      // Check if debt is fully paid
      fetchData();
      setSnackbarMessage('Payment added successfully');
      setSnackbarVisible(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to add payment');
    }
  };

  const handleMarkAsCompleted = async () => {
    if (!debt) return;
    
    try {
      // Update debt status to completed
      // This would need to be implemented in the service
      setCompletionModalVisible(false);
      fetchData();
      setSnackbarMessage('Debt marked as completed');
      setSnackbarVisible(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to mark debt as completed');
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    Alert.alert(
      'Delete Payment',
      'This payment will be permanently deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDebtRepayment(paymentId);
              fetchData();
              setSnackbarMessage('Payment deleted');
              setSnackbarVisible(true);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete payment');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary[500]} style={{ marginTop: 100 }} />
      </View>
    );
  }

  if (!debt || !calculation) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Debt not found</Text>
      </View>
    );
  }

  const progressPercentage = debt.principal > 0 ? (calculation.totalRepaid / (calculation.totalAccrued || 1)) * 100 : 0;

  // Prepare chart data
  const balanceChartData = paymentHistory?.balanceHistory?.map((item: any, index: number) => ({
    value: item.balance,
    label: index % 3 === 0 ? format(new Date(item.date), 'MMM') : '',
    dataPointText: index === paymentHistory.balanceHistory.length - 1 ? formatCurrency(item.balance) : ''
  })) || [];

  const monthlyPaymentData = Object.entries(paymentHistory?.monthlyPayments || {}).map(([month, amount]) => ({
    value: amount as number,
    label: format(new Date(month + '-01'), 'MMM'),
    dataPointText: formatCurrency(amount as number)
  }));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{debt.name}</Text>
        <TouchableOpacity 
          onPress={() => setAddPaymentModalVisible(true)} 
          style={styles.addBtn}
        >
          <Plus size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.personInfo}>
              <View style={[
                styles.avatar,
                { backgroundColor: debt.direction === 'borrowed' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }
              ]}>
                <Text style={[
                  styles.avatarText,
                  { color: debt.direction === 'borrowed' ? SemanticColors.expense : SemanticColors.income }
                ]}>
                  {debt.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.personDetails}>
                <Text style={styles.personName}>{debt.name}</Text>
                <Text style={styles.direction}>
                  {debt.direction === 'borrowed' ? 'I borrowed' : 'I lent'}
                </Text>
              </View>
            </View>
            
            {debt.status === 'completed' && (
              <View style={[styles.statusBadge, { backgroundColor: Colors.success[100] }]}>
                <CheckCircle size={16} color={Colors.success[600]} />
                <Text style={[styles.statusText, { color: Colors.success[600] }]}>Completed</Text>
              </View>
            )}
          </View>

          <View style={styles.balanceSection}>
            <Text style={styles.balanceLabel}>Current Balance</Text>
            <Text style={[
              styles.balanceAmount,
              { color: debt.direction === 'borrowed' ? SemanticColors.expense : SemanticColors.income }
            ]}>
              {formatCurrency(calculation.currentBalance)}
            </Text>
            
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View style={[
                  styles.progressFill,
                  { 
                    width: `${Math.min(progressPercentage, 100)}%`,
                    backgroundColor: progressPercentage < 50 ? SemanticColors.expense : 
                                   progressPercentage < 80 ? '#F59E0B' : SemanticColors.income
                  }
                ]} />
              </View>
              <Text style={styles.progressText}>{progressPercentage.toFixed(1)}% paid</Text>
            </View>
          </View>

          <View style={styles.quickStats}>
            <View style={styles.statItem}>
              <DollarSign size={16} color={Colors.gray[500]} />
              <Text style={styles.statLabel}>Principal</Text>
              <Text style={styles.statValue}>{formatCurrency(debt.principal)}</Text>
            </View>
            
            {debt.interest_rate > 0 && (
              <View style={styles.statItem}>
                <Percent size={16} color={Colors.gray[500]} />
                <Text style={styles.statLabel}>Interest</Text>
                <Text style={styles.statValue}>{debt.interest_rate}%</Text>
              </View>
            )}
            
            <View style={styles.statItem}>
              <Calendar size={16} color={Colors.gray[500]} />
              <Text style={styles.statLabel}>Started</Text>
              <Text style={styles.statValue}>{format(new Date(debt.start_date), 'MMM dd, yyyy')}</Text>
            </View>
          </View>
        </View>

        {/* Interest Breakdown */}
        {debt.interest_rate > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Interest Breakdown</Text>
            <View style={styles.interestBreakdown}>
              <View style={styles.interestRow}>
                <Text style={styles.interestLabel}>Principal</Text>
                <Text style={styles.interestValue}>{formatCurrency(debt.principal)}</Text>
              </View>
              <View style={styles.interestRow}>
                <Text style={styles.interestLabel}>Accrued Interest</Text>
                <Text style={styles.interestValue}>{formatCurrency(calculation.accruedInterest)}</Text>
              </View>
              <View style={[styles.interestRow, styles.interestRowTotal]}>
                <Text style={styles.interestLabel}>Total Amount</Text>
                <Text style={styles.interestValue}>{formatCurrency(calculation.totalAccrued)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Balance Trend Chart */}
        {balanceChartData.length > 1 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Balance Trend</Text>
            <LineChart
              data={balanceChartData}
              height={200}
              spacing={40}
              initialSpacing={20}
              color={debt.direction === 'borrowed' ? SemanticColors.expense : SemanticColors.income}
              thickness={2}
              backgroundColor={Colors.white}
              hideDataPoints={false}
              dataPointsRadius={4}
              dataPointsColor={debt.direction === 'borrowed' ? SemanticColors.expense : SemanticColors.income}
              yAxisTextStyle={{ color: Colors.gray[500], fontSize: 10 }}
            />
          </View>
        )}

        {/* Monthly Payments Chart */}
        {monthlyPaymentData.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Monthly Payments</Text>
            <BarChart
              data={monthlyPaymentData}
              height={200}
              spacing={30}
              initialSpacing={20}
              barWidth={20}
              frontColor={Colors.primary[500]}
              backgroundColor={Colors.white}
              yAxisTextStyle={{ color: Colors.gray[500], fontSize: 10 }}
            />
          </View>
        )}

        {/* Repayment History */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Repayment History</Text>
            <TouchableOpacity 
              onPress={() => setAddPaymentModalVisible(true)}
              style={styles.addPaymentBtn}
            >
              <Plus size={16} color={Colors.primary[600]} />
              <Text style={styles.addPaymentText}>Add Payment</Text>
            </TouchableOpacity>
          </View>
          
          {repayments.length > 0 ? (
            repayments.map((payment) => (
              <View key={payment.id} style={styles.paymentItem}>
                <View style={styles.paymentLeft}>
                  <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
                  <Text style={styles.paymentDate}>
                    {format(new Date(payment.payment_date), 'MMM dd, yyyy')}
                  </Text>
                  <View style={styles.paymentTypeBadge}>
                    <Text style={styles.paymentTypeText}>
                      {payment.payment_type.charAt(0).toUpperCase() + payment.payment_type.slice(1)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity 
                  onPress={() => handleDeletePayment(payment.id)}
                  style={styles.deletePaymentBtn}
                >
                  <Text style={styles.deletePaymentText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyHistoryText}>No payments recorded yet</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        {debt.status === 'active' && calculation.currentBalance <= 0 && (
          <TouchableOpacity 
            style={styles.completeBtn}
            onPress={() => setCompletionModalVisible(true)}
          >
            <CheckCircle size={20} color="white" />
            <Text style={styles.completeBtnText}>Mark as Completed</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Payment Modal */}
      {addPaymentModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Payment</Text>
              <TouchableOpacity onPress={() => setAddPaymentModalVisible(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.label}>Amount *</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="numeric"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
              />
              
              <Text style={styles.label}>Payment Type</Text>
              <View style={styles.paymentTypeOptions}>
                {(['principal', 'interest', 'both'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.paymentTypeOption,
                      paymentType === type && styles.paymentTypeOptionSelected
                    ]}
                    onPress={() => setPaymentType(type)}
                  >
                    <Text style={[
                      styles.paymentTypeOptionText,
                      paymentType === type && styles.paymentTypeOptionTextSelected
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={styles.label}>Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={paymentDate}
                onChangeText={setPaymentDate}
              />
              
              <Text style={styles.label}>Note (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add a note..."
                multiline
                value={paymentNote}
                onChangeText={setPaymentNote}
              />

              <Text style={styles.label}>Payment Account</Text>
              <AccountSelector
                accounts={accounts}
                selectedAccountId={selectedAccountId}
                onSelect={setSelectedAccountId}
              />
              
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddPayment}>
                <Text style={styles.saveBtnText}>Add Payment</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Completion Modal */}
      {completionModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mark as Completed</Text>
              <TouchableOpacity onPress={() => setCompletionModalVisible(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.completionMessage}>
              Are you sure you want to mark this debt as completed? This will change its status but keep all payment history.
            </Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => setCompletionModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.confirmBtn]} 
                onPress={handleMarkAsCompleted}
              >
                <Text style={styles.confirmBtnText}>Complete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        message={snackbarMessage}
        onDismiss={() => setSnackbarVisible(false)}
      />
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: Colors.white,
  },
  backBtn: {
    padding: 4,
    marginLeft: -4,
  },
  headerTitle: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    flex: 1,
    textAlign: 'center',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  heroCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.lg,
    padding: 20,
    marginTop: 16,
    marginBottom: 20,
    ...Layout.shadows.md,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  personInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
  },
  personDetails: {
    flex: 1,
  },
  personName: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 4,
  },
  direction: {
    fontSize: Typography.size.sm,
    color: Colors.gray[500],
    fontFamily: Typography.family.medium,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Layout.radius.sm,
  },
  statusText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
    marginLeft: 4,
  },
  balanceSection: {
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: Typography.size.sm,
    color: Colors.gray[500],
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: Typography.size.xxxl,
    fontFamily: Typography.family.bold,
    marginBottom: 16,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.gray[200],
    borderRadius: Layout.radius.full,
    width: '100%',
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Layout.radius.full,
  },
  progressText: {
    fontSize: Typography.size.sm,
    color: Colors.gray[600],
    fontFamily: Typography.family.medium,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: Typography.size.xs,
    color: Colors.gray[500],
    marginTop: 4,
    marginBottom: 2,
  },
  statValue: {
    fontSize: Typography.size.sm,
    color: Colors.gray[900],
    fontFamily: Typography.family.bold,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.lg,
    padding: 20,
    marginBottom: 16,
    ...Layout.shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  addPaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Layout.radius.sm,
    backgroundColor: Colors.primary[100],
  },
  addPaymentText: {
    fontSize: Typography.size.sm,
    color: Colors.primary[600],
    fontFamily: Typography.family.medium,
    marginLeft: 4,
  },
  interestBreakdown: {
    marginTop: 12,
  },
  interestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  interestRowTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.gray[200],
    paddingTop: 12,
  },
  interestLabel: {
    fontSize: Typography.size.md,
    color: Colors.gray[600],
  },
  interestValue: {
    fontSize: Typography.size.md,
    color: Colors.gray[900],
    fontFamily: Typography.family.bold,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  paymentLeft: {
    flex: 1,
  },
  paymentAmount: {
    fontSize: Typography.size.md,
    color: Colors.gray[900],
    fontFamily: Typography.family.bold,
    marginBottom: 4,
  },
  paymentDate: {
    fontSize: Typography.size.sm,
    color: Colors.gray[500],
    marginBottom: 4,
  },
  paymentTypeBadge: {
    backgroundColor: Colors.gray[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Layout.radius.sm,
    alignSelf: 'flex-start',
  },
  paymentTypeText: {
    fontSize: Typography.size.xs,
    color: Colors.gray[600],
    fontFamily: Typography.family.medium,
  },
  deletePaymentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Layout.radius.sm,
    backgroundColor: Colors.danger[100],
  },
  deletePaymentText: {
    fontSize: Typography.size.sm,
    color: Colors.danger[600],
    fontFamily: Typography.family.medium,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyHistoryText: {
    fontSize: Typography.size.md,
    color: Colors.gray[500],
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success[600],
    paddingVertical: 16,
    borderRadius: Layout.radius.lg,
    marginBottom: 20,
    ...Layout.shadows.md,
  },
  completeBtnText: {
    color: 'white',
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    marginLeft: 8,
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
  modalClose: {
    fontSize: Typography.size.xxl,
    color: Colors.gray[500],
  },
  label: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    marginBottom: 8,
    color: Colors.gray[700],
  },
  input: {
    backgroundColor: Colors.gray[50],
    padding: 16,
    borderRadius: Layout.radius.lg,
    marginBottom: 20,
    fontSize: Typography.size.md,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  paymentTypeOptions: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  paymentTypeOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.gray[50],
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  paymentTypeOptionSelected: {
    backgroundColor: Colors.primary[100],
    borderColor: Colors.primary[500],
  },
  paymentTypeOptionText: {
    fontSize: Typography.size.sm,
    color: Colors.gray[600],
    fontFamily: Typography.family.medium,
  },
  paymentTypeOptionTextSelected: {
    color: Colors.primary[600],
    fontFamily: Typography.family.bold,
  },
  saveBtn: {
    backgroundColor: Colors.primary[600],
    padding: 16,
    borderRadius: Layout.radius.lg,
    alignItems: 'center',
  },
  saveBtnText: {
    color: 'white',
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
  },
  completionMessage: {
    fontSize: Typography.size.md,
    color: Colors.gray[600],
    lineHeight: 22,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: Layout.radius.lg,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: Colors.gray[100],
  },
  cancelBtnText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[700],
  },
  confirmBtn: {
    backgroundColor: Colors.success[600],
  },
  confirmBtnText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: 'white',
  },
  errorText: {
    fontSize: Typography.size.lg,
    color: Colors.gray[500],
    textAlign: 'center',
    marginTop: 100,
  },
});
