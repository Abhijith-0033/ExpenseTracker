import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save, DollarSign, Info } from 'lucide-react-native';
import { Colors, Layout, Typography, SemanticColors } from '../../constants/Theme';
import { addChitFund, generateMonthlyRecords } from '../../services/chitfund/chitService';
import { ChitFund } from '../../services/chitfund/ChitEngine';
import { Snackbar } from '../../components/Snackbar';
import { FormField } from '../../components/FormField';
import { formatCurrency } from '../../utils/currency';

export default function AddChitFundScreen() {
  const router = useRouter();
  
  // Form state
  const [name, setName] = useState('');
  const [totalMembers, setTotalMembers] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [durationMonths, setDurationMonths] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [foremanCommission, setForemanCommission] = useState('5');
  const [myTurnMonth, setMyTurnMonth] = useState('');
  const [notes, setNotes] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Calculate preview values
  const members = parseInt(totalMembers) || 0;
  const monthlyAmountNum = parseFloat(monthlyAmount) || 0;
  const duration = parseInt(durationMonths) || 0;
  const commission = parseFloat(foremanCommission) || 0;
  const totalPot = monthlyAmountNum * members;
  const netPot = totalPot * (1 - commission / 100);
  const totalInvestment = monthlyAmountNum * duration;
  const expectedReturn = netPot; // Simplified - assumes one win
  const projectedRoi = totalInvestment > 0 ? ((expectedReturn - totalInvestment) / totalInvestment) * 100 : 0;

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a chit fund name');
      return;
    }
    
    if (!totalMembers || parseInt(totalMembers) < 2) {
      Alert.alert('Required', 'Please enter at least 2 members');
      return;
    }
    
    if (!monthlyAmount || parseFloat(monthlyAmount) <= 0) {
      Alert.alert('Required', 'Please enter a valid monthly amount');
      return;
    }
    
    if (!durationMonths || parseInt(durationMonths) < 3) {
      Alert.alert('Required', 'Please enter at least 3 months duration');
      return;
    }
    
    if (!startDate) {
      Alert.alert('Required', 'Please enter a start date');
      return;
    }
    
    if (myTurnMonth && (parseInt(myTurnMonth) < 1 || parseInt(myTurnMonth) > parseInt(durationMonths))) {
      Alert.alert('Invalid', 'Your turn month must be between 1 and the total duration');
      return;
    }

    setLoading(true);
    
    try {
      const chitFundData: Omit<ChitFund, 'id' | 'created_at'> = {
        name: name.trim(),
        total_members: parseInt(totalMembers),
        monthly_amount: parseFloat(monthlyAmount),
        total_pot: totalPot,
        duration_months: parseInt(durationMonths),
        start_date: startDate,
        foreman_commission: parseFloat(foremanCommission),
        status: 'active',
        my_turn_month: myTurnMonth ? parseInt(myTurnMonth) : null,
        notes: notes.trim() || null,
      };

      const chitFundId = await addChitFund(chitFundData);
      
      // Generate monthly records
      await generateMonthlyRecords(chitFundId, startDate, parseInt(durationMonths));

      setSnackbarMessage('Chit fund added successfully');
      setSnackbarVisible(true);
      
      setTimeout(() => {
        router.push('/chit-funds' as any);
      }, 1500);
      
    } catch (error) {
      console.error('Failed to add chit fund:', error);
      Alert.alert('Error', 'Failed to add chit fund. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Chit Fund</Text>
        <TouchableOpacity 
          onPress={handleSave} 
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Save size={20} color="white" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <FormField
            label="Chit Fund Name *"
            placeholder="e.g. Office Monthly Chit"
            value={name}
            onChangeText={setName}
          />

          <FormField
            label="Number of Members *"
            placeholder="e.g. 10"
            value={totalMembers}
            onChangeText={setTotalMembers}
            keyboardType="numeric"
          />

          <FormField
            label="Monthly Amount *"
            placeholder="e.g. 10000"
            value={monthlyAmount}
            onChangeText={setMonthlyAmount}
            keyboardType="numeric"
          />

          <FormField
            label="Duration (Months) *"
            placeholder="e.g. 12"
            value={durationMonths}
            onChangeText={setDurationMonths}
            keyboardType="numeric"
          />

          <FormField
            label="Start Date *"
            placeholder="YYYY-MM-DD"
            value={startDate}
            onChangeText={setStartDate}
          />

          <FormField
            label="Foreman Commission (%)"
            placeholder="5"
            value={foremanCommission}
            onChangeText={setForemanCommission}
            keyboardType="numeric"
          />

          <FormField
            label="My Turn Month (Optional)"
            placeholder={`e.g. 1-${durationMonths || '12'}`}
            value={myTurnMonth}
            onChangeText={setMyTurnMonth}
            keyboardType="numeric"
          />

          <FormField
            label="Notes (Optional)"
            placeholder="Add notes about this chit fund"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

        {/* Preview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Preview</Text>
            <TouchableOpacity 
              onPress={() => setShowPreview(!showPreview)}
              style={styles.previewToggle}
            >
              <Info size={20} color={Colors.gray[500]} />
            </TouchableOpacity>
          </View>

          {showPreview && members > 0 && monthlyAmountNum > 0 && duration > 0 && (
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <DollarSign size={16} color={Colors.primary[600]} />
                <Text style={styles.previewTitle}>Financial Summary</Text>
              </View>
              
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Monthly Pot:</Text>
                <Text style={styles.previewValue}>{formatCurrency(totalPot)}</Text>
              </View>
              
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Net Pot (after {commission}% commission):</Text>
                <Text style={styles.previewValue}>{formatCurrency(netPot)}</Text>
              </View>
              
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Total Investment:</Text>
                <Text style={styles.previewValue}>{formatCurrency(totalInvestment)}</Text>
              </View>
              
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Expected Return (if you win once):</Text>
                <Text style={styles.previewValue}>{formatCurrency(expectedReturn)}</Text>
              </View>
              
              <View style={[styles.previewRow, styles.previewRowTotal]}>
                <Text style={styles.previewLabel}>Projected ROI:</Text>
                <Text style={[
                  styles.previewValue,
                  { color: projectedRoi >= 0 ? SemanticColors.income : SemanticColors.expense }
                ]}>
                  {projectedRoi >= 0 ? '+' : ''}{projectedRoi.toFixed(2)}%
                </Text>
              </View>
            </View>
          )}

          {/* Important Notes */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Important Notes</Text>
            <Text style={styles.infoText}>
              • Chit funds involve regular monthly payments{'\n'}
              • Returns depend on when you win the auction{'\n'}
              • Early wins typically yield better ROI{'\n'}
              • Consider the commission rate carefully{'\n'}
              • Ensure you can make all monthly payments
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

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
  },
  saveBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: Colors.gray[300],
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
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
    marginBottom: 16,
  },
  previewToggle: {
    padding: 8,
  },
  previewCard: {
    backgroundColor: Colors.primary[50],
    borderRadius: Layout.radius.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.primary[600],
    marginLeft: 8,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  previewRowTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.primary[200],
    paddingTop: 12,
    marginTop: 4,
  },
  previewLabel: {
    fontSize: Typography.size.sm,
    color: Colors.gray[600],
    flex: 1,
  },
  previewValue: {
    fontSize: Typography.size.sm,
    color: Colors.gray[900],
    fontFamily: Typography.family.bold,
  },
  infoCard: {
    backgroundColor: Colors.warning[50],
    borderRadius: Layout.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.warning[200],
  },
  infoTitle: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.warning[700],
    marginBottom: 8,
  },
  infoText: {
    fontSize: Typography.size.sm,
    color: Colors.warning[700],
    lineHeight: 20,
  },
});
