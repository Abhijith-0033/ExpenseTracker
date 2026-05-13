import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Save, Calculator, CreditCard, Calendar, DollarSign, Percent, Clock, CheckCircle, AlertCircle } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { formatCurrency } from '../../utils/currency';
import { FormField } from '../../components/FormField';
import { getEMIRecord, updateEMIRecord, createEMIRecord, calculateEMI, generateAmortizationSchedule, EMIRecord } from '../../services/emitracker/EMIEngine';
import { getAccounts } from '../../services/database';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function AddEMIScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!params.id;

  const [formData, setFormData] = useState({
    name: '',
    lender_name: '',
    principal: '',
    interest_rate: '',
    tenure_months: '',
    start_date: new Date(),
    due_day: '5',
    is_autopay: false,
    autopay_account_id: '',
    category: 'EMI',
    notes: '',
  });

  const [emiCalculation, setEMICalculation] = useState<{
    emi_amount: number;
    total_amount: number;
    total_interest: number;
  } | null>(null);

  const [accounts, setAccounts] = useState<Array<{ id: number; name: string; balance: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDueDayPicker, setShowDueDayPicker] = useState(false);

  useEffect(() => {
    loadAccounts();
    if (isEdit && params.id) {
      loadEMIRecord(parseInt(params.id));
    }
  }, [isEdit, params.id]);

  const loadAccounts = async () => {
    try {
      const accs = await getAccounts();
      setAccounts(accs.filter((a) => a.type !== 'meta_categories'));
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const loadEMIRecord = async (id: number) => {
    try {
      const record = await getEMIRecord(id);
      if (record) {
        setFormData({
          name: record.name,
          lender_name: record.lender_name || '',
          principal: record.principal.toString(),
          interest_rate: record.interest_rate.toString(),
          tenure_months: record.tenure_months.toString(),
          start_date: new Date(record.start_date),
          due_day: record.due_day.toString(),
          is_autopay: record.is_autopay === 1,
          autopay_account_id: record.autopay_account_id?.toString() || '',
          category: record.category,
          notes: record.notes || '',
        });
        calculateLiveEMI(record.principal, record.interest_rate, record.tenure_months);
      }
    } catch (error) {
      console.error('Error loading EMI record:', error);
      Alert.alert('Error', 'Failed to load EMI record');
    }
  };

  const calculateLiveEMI = useCallback((principal: number, interestRate: number, tenureMonths: number) => {
    if (principal > 0 && tenureMonths > 0) {
      const emi = calculateEMI(principal, interestRate, tenureMonths);
      const totalAmount = emi * tenureMonths;
      const totalInterest = totalAmount - principal;
      setEMICalculation({
        emi_amount: emi,
        total_amount: totalAmount,
        total_interest: totalInterest,
      });
    } else {
      setEMICalculation(null);
    }
  }, []);

  useEffect(() => {
    const principal = parseFloat(formData.principal) || 0;
    const interestRate = parseFloat(formData.interest_rate) || 0;
    const tenureMonths = parseInt(formData.tenure_months) || 0;
    calculateLiveEMI(principal, interestRate, tenureMonths);
  }, [formData.principal, formData.interest_rate, formData.tenure_months, calculateLiveEMI]);

  const handleSave = async () => {
    // Validation
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Please enter EMI name');
      return;
    }
    if (!formData.principal || parseFloat(formData.principal) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid principal amount');
      return;
    }
    if (!formData.tenure_months || parseInt(formData.tenure_months) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid tenure in months');
      return;
    }
    if (formData.is_autopay && !formData.autopay_account_id) {
      Alert.alert('Validation Error', 'Please select an account for AutoPay');
      return;
    }

    setLoading(true);
    try {
      const principal = parseFloat(formData.principal);
      const interestRate = parseFloat(formData.interest_rate) || 0;
      const tenureMonths = parseInt(formData.tenure_months);

      const recordData: Omit<EMIRecord, 'id' | 'created_at' | 'updated_at'> = {
        name: formData.name,
        lender_name: formData.lender_name || null,
        principal,
        total_amount: emiCalculation?.total_amount || principal,
        emi_amount: emiCalculation?.emi_amount || principal / tenureMonths,
        interest_rate: interestRate,
        tenure_months: tenureMonths,
        start_date: formData.start_date.toISOString().split('T')[0],
        due_day: parseInt(formData.due_day),
        is_autopay: formData.is_autopay ? 1 : 0,
        autopay_account_id: formData.is_autopay ? parseInt(formData.autopay_account_id) : null,
        status: 'active',
        category: formData.category,
        notes: formData.notes || null,
      };

      if (isEdit && params.id) {
        await updateEMIRecord(parseInt(params.id), recordData);
        Alert.alert('Success', 'EMI updated successfully');
      } else {
        await createEMIRecord(recordData);
        Alert.alert('Success', 'EMI created successfully');
      }

      router.back();
    } catch (error) {
      console.error('Error saving EMI:', error);
      Alert.alert('Error', 'Failed to save EMI');
    } finally {
      setLoading(false);
    }
  };

  const renderDueDayOptions = () => {
    const days = Array.from({ length: 28 }, (_, i) => i + 1);
    return days.map((day) => (
      <TouchableOpacity
        key={day}
        style={[
          styles.dayOption,
          parseInt(formData.due_day) === day && styles.dayOptionSelected,
        ]}
        onPress={() => setFormData({ ...formData, due_day: day.toString() })}
      >
        <Text
          style={[
            styles.dayOptionText,
            parseInt(formData.due_day) === day && styles.dayOptionTextSelected,
          ]}
        >
          {day}
        </Text>
      </TouchableOpacity>
    ));
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit EMI' : 'Add EMI'}</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={loading}>
          <Save size={20} color={Colors.primary[600]} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* EMI Calculator Card */}
        {emiCalculation && (
          <View style={styles.calculatorCard}>
            <View style={styles.calculatorHeader}>
              <Calculator size={20} color={Colors.primary[600]} />
              <Text style={styles.calculatorTitle}>EMI Calculation</Text>
            </View>
            <View style={styles.calculatorBody}>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Monthly EMI</Text>
                <Text style={styles.calcValue}>{formatCurrency(emiCalculation.emi_amount)}</Text>
              </View>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Total Amount</Text>
                <Text style={styles.calcValue}>{formatCurrency(emiCalculation.total_amount)}</Text>
              </View>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Total Interest</Text>
                <Text style={[styles.calcValue, { color: Colors.warning[600] }]}>
                  {formatCurrency(emiCalculation.total_interest)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Form Fields */}
        <FormField
          label="EMI Name"
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
          placeholder="e.g., Home Loan, Car Loan"
          required
        />

        <FormField
          label="Lender Name (Optional)"
          value={formData.lender_name}
          onChangeText={(text) => setFormData({ ...formData, lender_name: text })}
          placeholder="e.g., HDFC Bank, SBI"
        />

        <FormField
          label="Principal Amount"
          value={formData.principal}
          onChangeText={(text) => setFormData({ ...formData, principal: text })}
          placeholder="0.00"
          keyboardType="decimal-pad"
          required
          rightElement={<DollarSign size={20} color={Colors.gray[400]} />}
        />

        <FormField
          label="Interest Rate (% per annum)"
          value={formData.interest_rate}
          onChangeText={(text) => setFormData({ ...formData, interest_rate: text })}
          placeholder="0.00"
          keyboardType="decimal-pad"
          rightElement={<Percent size={20} color={Colors.gray[400]} />}
        />

        <FormField
          label="Tenure (Months)"
          value={formData.tenure_months}
          onChangeText={(text) => setFormData({ ...formData, tenure_months: text })}
          placeholder="e.g., 12, 24, 36"
          keyboardType="number-pad"
          required
          rightElement={<Clock size={20} color={Colors.gray[400]} />}
        />

        <View style={styles.dateField}>
          <Text style={styles.fieldLabel}>Start Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Calendar size={20} color={Colors.gray[400]} />
            <Text style={styles.dateText}>
              {formData.start_date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={formData.start_date}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                setFormData({ ...formData, start_date: selectedDate });
              }
            }}
          />
        )}

        <View style={styles.dueDaySection}>
          <Text style={styles.fieldLabel}>Due Day of Month</Text>
          <View style={styles.dayOptionsContainer}>{renderDueDayOptions()}</View>
        </View>

        {/* AutoPay Section */}
        <View style={styles.autopaySection}>
          <TouchableOpacity
            style={styles.autopayToggle}
            onPress={() => setFormData({ ...formData, is_autopay: !formData.is_autopay })}
          >
            <View style={styles.autopayToggleContent}>
              <CreditCard size={20} color={formData.is_autopay ? Colors.primary[600] : Colors.gray[400]} />
              <Text style={styles.autopayToggleLabel}>Enable AutoPay</Text>
            </View>
            <View
              style={[
                styles.autopayToggleSwitch,
                { backgroundColor: formData.is_autopay ? Colors.primary[600] : Colors.gray[200] },
              ]}
            >
              <View
                style={[
                  styles.autopayToggleKnob,
                  { transform: [{ translateX: formData.is_autopay ? 20 : 0 }] },
                ]}
              />
            </View>
          </TouchableOpacity>

          {formData.is_autopay && (
            <View style={styles.autopayAccountSection}>
              <Text style={styles.autopayAccountLabel}>Select Account for AutoPay</Text>
              {accounts.map((account) => (
                <TouchableOpacity
                  key={account.id}
                  style={[
                    styles.accountOption,
                    formData.autopay_account_id === account.id.toString() && styles.accountOptionSelected,
                  ]}
                  onPress={() => setFormData({ ...formData, autopay_account_id: account.id.toString() })}
                >
                  <View style={styles.accountOptionContent}>
                    <Text style={styles.accountName}>{account.name}</Text>
                    <Text style={styles.accountBalance}>{formatCurrency(account.balance)}</Text>
                  </View>
                  {formData.autopay_account_id === account.id.toString() && (
                    <CheckCircle size={20} color={Colors.primary[600]} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <FormField
          label="Notes (Optional)"
          value={formData.notes}
          onChangeText={(text) => setFormData({ ...formData, notes: text })}
          placeholder="Add any notes..."
          multiline
        />
      </ScrollView>
    </KeyboardAvoidingView>
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
  saveButton: {
    padding: Layout.spacing.sm,
  },
  content: {
    flex: 1,
    padding: Layout.spacing.lg,
  },
  calculatorCard: {
    backgroundColor: Colors.primary[50],
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.lg,
    ...Layout.shadows.sm,
  },
  calculatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Layout.spacing.md,
  },
  calculatorTitle: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginLeft: Layout.spacing.sm,
  },
  calculatorBody: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.md,
    padding: Layout.spacing.md,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Layout.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  calcLabel: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[600],
  },
  calcValue: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  dateField: {
    marginBottom: Layout.spacing.lg,
  },
  fieldLabel: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[700],
    marginBottom: Layout.spacing.sm,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.md,
    padding: Layout.spacing.md,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  dateText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.regular,
    color: Colors.gray[900],
    marginLeft: Layout.spacing.sm,
  },
  dueDaySection: {
    marginBottom: Layout.spacing.lg,
  },
  dayOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Layout.spacing.sm,
  },
  dayOption: {
    width: 40,
    height: 40,
    borderRadius: Layout.radius.sm,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayOptionSelected: {
    backgroundColor: Colors.primary[600],
    borderColor: Colors.primary[600],
  },
  dayOptionText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  dayOptionTextSelected: {
    color: Colors.white,
  },
  autopaySection: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.lg,
    ...Layout.shadows.sm,
  },
  autopayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autopayToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  autopayToggleLabel: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginLeft: Layout.spacing.sm,
  },
  autopayToggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
  },
  autopayToggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.white,
    ...Layout.shadows.sm,
  },
  autopayAccountSection: {
    marginTop: Layout.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
    paddingTop: Layout.spacing.lg,
  },
  autopayAccountLabel: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[700],
    marginBottom: Layout.spacing.md,
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.gray[50],
    borderRadius: Layout.radius.md,
    padding: Layout.spacing.md,
    marginBottom: Layout.spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  accountOptionSelected: {
    borderColor: Colors.primary[600],
    backgroundColor: Colors.primary[50],
  },
  accountOptionContent: {
    flex: 1,
  },
  accountName: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 2,
  },
  accountBalance: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
  },
});
