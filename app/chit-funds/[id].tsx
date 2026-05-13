import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus, TrendingUp, Users, Calendar, DollarSign, Percent, Edit, Trash2, Crown, CheckCircle } from 'lucide-react-native';
import { Colors, Layout, Typography, SemanticColors } from '../../constants/Theme';
import { getChitFundById, getChitMonthlyRecords, getChitMembers, updateChitMonthlyRecord, deleteChitMonthlyRecord } from '../../services/chitfund/chitService';
import { calculateChitFundPosition, analyzeChitFundPerformance, ChitFund, ChitMonthlyRecord } from '../../services/chitfund/ChitEngine';
import { formatCurrency } from '../../utils/currency';
import { Snackbar } from '../../components/Snackbar';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import { format } from 'date-fns';

export default function ChitFundDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const chitFundId = parseInt(id);
  
  const [chitFund, setChitFund] = useState<ChitFund | null>(null);
  const [monthlyRecords, setMonthlyRecords] = useState<ChitMonthlyRecord[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [calculation, setCalculation] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ChitMonthlyRecord | null>(null);

  // Snackbar state
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Form state for editing monthly record
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [winnerName, setWinnerName] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [recordNote, setRecordNote] = useState('');

  const fetchData = async () => {
    try {
      const chitFundData = await getChitFundById(chitFundId);
      if (!chitFundData) {
        Alert.alert('Error', 'Chit fund not found');
        router.back();
        return;
      }
      
      const recordsData = await getChitMonthlyRecords(chitFundId);
      const membersData = await getChitMembers(chitFundId);
      const calculationData = calculateChitFundPosition(chitFundData, recordsData);
      const analysisData = analyzeChitFundPerformance(chitFundData, recordsData);
      
      setChitFund(chitFundData);
      setMonthlyRecords(recordsData);
      setMembers(membersData);
      setCalculation(calculationData);
      setAnalysis(analysisData);
    } catch (error) {
      console.error('Failed to fetch chit fund details:', error);
      Alert.alert('Error', 'Failed to load chit fund details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (chitFundId) {
      fetchData();
    }
  }, [chitFundId]);

  const handleEditRecord = (record: ChitMonthlyRecord) => {
    setEditingRecord(record);
    setPaymentAmount(record.amount_paid?.toString() || '');
    setPaymentDate(record.payment_date || '');
    setWinnerName(record.winner_name || '');
    setBidAmount(record.bid_amount?.toString() || '');
    setRecordNote(record.notes || '');
    setEditModalVisible(true);
  };

  const handleSaveRecord = async () => {
    if (!editingRecord) return;
    
    try {
      await updateChitMonthlyRecord(editingRecord.id, {
        amount_paid: paymentAmount ? parseFloat(paymentAmount) : null,
        payment_date: paymentDate || null,
        payment_status: paymentAmount ? 'paid' : 'pending',
        winner_name: winnerName || null,
        winner_is_me: winnerName === 'Me' ? 1 : 0,
        bid_amount: bidAmount ? parseFloat(bidAmount) : null,
        notes: recordNote || null
      });

      setEditModalVisible(false);
      setEditingRecord(null);
      fetchData();
      setSnackbarMessage('Record updated successfully');
      setSnackbarVisible(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to update record');
    }
  };

  const handleDeleteRecord = async (recordId: number) => {
    Alert.alert(
      'Delete Record',
      'This record will be permanently deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChitMonthlyRecord(recordId);
              fetchData();
              setSnackbarMessage('Record deleted');
              setSnackbarVisible(true);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete record');
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

  if (!chitFund || !calculation) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Chit fund not found</Text>
      </View>
    );
  }

  const progressPercentage = chitFund.duration_months > 0 ? (calculation.monthsPaid / chitFund.duration_months) * 100 : 0;
  const roiColor = calculation.roi >= 0 ? SemanticColors.income : SemanticColors.expense;

  // Prepare chart data
  const roiChartData = monthlyRecords
    .filter(r => r.winner_name !== null && r.net_received !== null)
    .map((record, index) => ({
      value: record.net_received || 0,
      label: `M${record.month_number}`,
      dataPointText: formatCurrency(record.net_received || 0)
    }));

  const paymentChartData = monthlyRecords
    .filter(r => r.amount_paid !== null)
    .map((record) => ({
      value: record.amount_paid || 0,
      label: `M${record.month_number}`,
      dataPointText: formatCurrency(record.amount_paid || 0)
    }));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{chitFund.name}</Text>
        <TouchableOpacity 
          onPress={() => router.push(`/chit-funds/edit/${chitFund.id}` as any)} 
          style={styles.editBtn}
        >
          <Edit size={20} color={Colors.primary[600]} />
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
            <View style={styles.fundInfo}>
              <View style={styles.fundIcon}>
                <Users size={24} color={Colors.primary[600]} />
              </View>
              <View style={styles.fundDetails}>
                <Text style={styles.fundName}>{chitFund.name}</Text>
                <Text style={styles.fundDuration}>
                  {chitFund.duration_months} months • {chitFund.total_members} members
                </Text>
              </View>
            </View>
            
            {chitFund.status === 'completed' && (
              <View style={[styles.statusBadge, { backgroundColor: Colors.success[100] }]}>
                <CheckCircle size={16} color={Colors.success[600]} />
                <Text style={[styles.statusText, { color: Colors.success[600] }]}>Completed</Text>
              </View>
            )}
          </View>

          {/* Financial Summary */}
          <View style={styles.financialSummary}>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Total Invested</Text>
              <Text style={styles.financialValue}>
                {formatCurrency(calculation.totalInvested)}
              </Text>
            </View>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Total Received</Text>
              <Text style={styles.financialValue}>
                {formatCurrency(calculation.totalReceived)}
              </Text>
            </View>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Net Position</Text>
              <Text style={[
                styles.financialValue,
                { color: roiColor }
              ]}>
                {formatCurrency(calculation.netPosition)}
              </Text>
            </View>
          </View>

          {/* ROI */}
          <View style={styles.roiSection}>
            <Text style={styles.roiLabel}>Return on Investment</Text>
            <Text style={[
              styles.roiValue,
              { color: roiColor }
            ]}>
              {calculation.roi >= 0 ? '+' : ''}{calculation.roi.toFixed(2)}%
            </Text>
            <Text style={styles.annualizedRoi}>
              ({calculation.annualizedRoi.toFixed(2)}% annualized)
            </Text>
          </View>

          {/* Progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[
                styles.progressFill,
                { 
                  width: `${Math.min(progressPercentage, 100)}%`,
                  backgroundColor: Colors.primary[500]
                }
              ]} />
            </View>
            <Text style={styles.progressText}>
              {calculation.monthsPaid}/{chitFund.duration_months} months completed
            </Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.quickStatItem}>
            <DollarSign size={16} color={Colors.gray[500]} />
            <Text style={styles.quickStatLabel}>Monthly Amount</Text>
            <Text style={styles.quickStatValue}>{formatCurrency(chitFund.monthly_amount)}</Text>
          </View>
          
          <View style={styles.quickStatItem}>
            <Percent size={16} color={Colors.gray[500]} />
            <Text style={styles.quickStatLabel}>Commission</Text>
            <Text style={styles.quickStatValue}>{chitFund.foreman_commission}%</Text>
          </View>
          
          <View style={styles.quickStatItem}>
            <Calendar size={16} color={Colors.gray[500]} />
            <Text style={styles.quickStatLabel}>Started</Text>
            <Text style={styles.quickStatValue}>{format(new Date(chitFund.start_date), 'MMM dd, yyyy')}</Text>
          </View>
        </View>

        {/* My Turn Status */}
        {chitFund.my_turn_month && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>My Turn Status</Text>
            <View style={styles.turnStatus}>
              <Crown size={20} color={Colors.primary[600]} />
              <View style={styles.turnInfo}>
                <Text style={styles.turnMonth}>Month {chitFund.my_turn_month}</Text>
                <Text style={styles.turnStatusText}>
                  {calculation.myTurnStatus === 'completed' ? '✅ Completed' :
                   calculation.myTurnStatus === 'upcoming' ? '📅 Upcoming' :
                   calculation.myTurnStatus === 'passed' ? '⏰ Passed' : '📋 Not assigned'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Best Month Analysis */}
        {calculation.bestMonth && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Best Month Performance</Text>
            <View style={styles.monthAnalysis}>
              <View style={styles.monthHeader}>
                <Text style={styles.monthTitle}>Month {calculation.bestMonth.monthNumber}</Text>
                <Text style={styles.monthRoi}>
                  ROI: {calculation.bestMonth.roi.toFixed(2)}%
                </Text>
              </View>
              <Text style={styles.monthAmount}>
                Net Received: {formatCurrency(calculation.bestMonth.netReceived)}
              </Text>
            </View>
          </View>
        )}

        {/* ROI Trend Chart */}
        {roiChartData.length > 1 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>ROI Trend</Text>
            <LineChart
              data={roiChartData}
              height={200}
              spacing={40}
              initialSpacing={20}
              color={roiColor}
              thickness={2}
              backgroundColor={Colors.white}
              hideDataPoints={false}
              dataPointsRadius={4}
              dataPointsColor={roiColor}
              yAxisTextStyle={{ color: Colors.gray[500], fontSize: 10 }}
            />
          </View>
        )}

        {/* Payment History Chart */}
        {paymentChartData.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Payment History</Text>
            <BarChart
              data={paymentChartData}
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

        {/* Monthly Records */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Monthly Records</Text>
          </View>
          
          {monthlyRecords.length > 0 ? (
            monthlyRecords.map((record) => (
              <View key={record.id} style={styles.monthlyRecord}>
                <View style={styles.recordHeader}>
                  <Text style={styles.recordMonth}>Month {record.month_number}</Text>
                  <View style={styles.recordActions}>
                    <TouchableOpacity 
                      onPress={() => handleEditRecord(record)}
                      style={styles.recordActionBtn}
                    >
                      <Edit size={16} color={Colors.primary[600]} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => handleDeleteRecord(record.id)}
                      style={styles.recordActionBtn}
                    >
                      <Trash2 size={16} color={Colors.danger[600]} />
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.recordContent}>
                  <View style={styles.recordRow}>
                    <Text style={styles.recordLabel}>Payment:</Text>
                    <Text style={styles.recordValue}>
                      {record.amount_paid ? formatCurrency(record.amount_paid) : 'Not paid'}
                    </Text>
                  </View>
                  
                  <View style={styles.recordRow}>
                    <Text style={styles.recordLabel}>Status:</Text>
                    <Text style={[
                      styles.recordValue,
                      { 
                        color: record.payment_status === 'paid' ? Colors.success[600] :
                               record.payment_status === 'missed' ? Colors.danger[600] : Colors.gray[600]
                      }
                    ]}>
                      {record.payment_status.charAt(0).toUpperCase() + record.payment_status.slice(1)}
                    </Text>
                  </View>
                  
                  {record.winner_name && (
                    <View style={styles.recordRow}>
                      <Text style={styles.recordLabel}>Winner:</Text>
                      <Text style={styles.recordValue}>
                        {record.winner_name} {record.winner_is_me ? '(You)' : ''}
                      </Text>
                    </View>
                  )}
                  
                  {record.net_received !== null && (
                    <View style={styles.recordRow}>
                      <Text style={styles.recordLabel}>Net Received:</Text>
                      <Text style={[
                        styles.recordValue,
                        { color: SemanticColors.income }
                      ]}>
                        {formatCurrency(record.net_received)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyRecords}>
              <Text style={styles.emptyRecordsText}>No monthly records yet</Text>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Edit Record Modal */}
      {editModalVisible && editingRecord && (
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Month {editingRecord.month_number}</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.label}>Payment Amount</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="numeric"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
            />
            
            <Text style={styles.label}>Payment Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={paymentDate}
              onChangeText={setPaymentDate}
            />
            
            <Text style={styles.label}>Winner Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Winner name or 'Me'"
              value={winnerName}
              onChangeText={setWinnerName}
            />
            
            <Text style={styles.label}>Bid Amount</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="numeric"
              value={bidAmount}
              onChangeText={setBidAmount}
            />
            
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add notes..."
              multiline
              value={recordNote}
              onChangeText={setRecordNote}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.saveBtn]} 
                onPress={handleSaveRecord}
              >
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[100],
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
  fundInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fundIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fundDetails: {
    flex: 1,
  },
  fundName: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 4,
  },
  fundDuration: {
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
  financialSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  financialRow: {
    alignItems: 'center',
  },
  financialLabel: {
    fontSize: Typography.size.xs,
    color: Colors.gray[500],
    marginBottom: 2,
  },
  financialValue: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  roiSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: Colors.gray[50],
    padding: 12,
    borderRadius: Layout.radius.md,
  },
  roiLabel: {
    fontSize: Typography.size.sm,
    color: Colors.gray[600],
    fontFamily: Typography.family.medium,
  },
  roiValue: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
  },
  annualizedRoi: {
    fontSize: Typography.size.xs,
    color: Colors.gray[500],
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.gray[200],
    borderRadius: Layout.radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Layout.radius.full,
  },
  progressText: {
    fontSize: Typography.size.sm,
    color: Colors.gray[600],
    textAlign: 'center',
    marginTop: 4,
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.lg,
    padding: 16,
    marginBottom: 20,
    ...Layout.shadows.sm,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatLabel: {
    fontSize: Typography.size.xs,
    color: Colors.gray[500],
    marginTop: 4,
    marginBottom: 2,
  },
  quickStatValue: {
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
  turnStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[50],
    padding: 16,
    borderRadius: Layout.radius.lg,
  },
  turnInfo: {
    marginLeft: 12,
  },
  turnMonth: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.primary[600],
    marginBottom: 4,
  },
  turnStatusText: {
    fontSize: Typography.size.sm,
    color: Colors.primary[700],
  },
  monthAnalysis: {
    backgroundColor: Colors.success[50],
    padding: 16,
    borderRadius: Layout.radius.lg,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  monthTitle: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.success[700],
  },
  monthRoi: {
    fontSize: Typography.size.sm,
    color: Colors.success[600],
    fontFamily: Typography.family.medium,
  },
  monthAmount: {
    fontSize: Typography.size.sm,
    color: Colors.gray[700],
  },
  monthlyRecord: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordMonth: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  recordActions: {
    flexDirection: 'row',
    gap: 8,
  },
  recordActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordContent: {
    paddingLeft: 8,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  recordLabel: {
    fontSize: Typography.size.sm,
    color: Colors.gray[600],
  },
  recordValue: {
    fontSize: Typography.size.sm,
    color: Colors.gray[900],
    fontFamily: Typography.family.medium,
  },
  emptyRecords: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyRecordsText: {
    fontSize: Typography.size.md,
    color: Colors.gray[500],
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
  saveBtn: {
    backgroundColor: Colors.primary[600],
  },
  saveBtnText: {
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
