import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save, Eye, EyeOff, TrendingUp, Calendar } from 'lucide-react-native';
import { Colors, Layout, Typography, SemanticColors } from '../../constants/Theme';
import { addDebtRecord } from '../../services/debttracker/debtService';
import { calculateInterestPreview, DebtRecord } from '../../services/debttracker/DebtEngine';
import { Snackbar } from '../../components/Snackbar';
import { FormField } from '../../components/FormField';

export default function AddDebtScreen() {
  const router = useRouter();
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('0');
  const [interestType, setInterestType] = useState<DebtRecord['interest_type']>('none');
  const [repaymentFreq, setRepaymentFreq] = useState<DebtRecord['repayment_freq']>('monthly');
  const [customFreqDays, setCustomFreqDays] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedEndDate, setExpectedEndDate] = useState('');
  const [direction, setDirection] = useState<DebtRecord['direction']>('borrowed');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Calculate interest preview
  const principalAmount = parseFloat(principal) || 0;
  const rate = parseFloat(interestRate) || 0;
  const interestPreview = calculateInterestPreview(principalAmount, rate, interestType, 1);

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a debt name');
      return;
    }
    
    if (!principal || parseFloat(principal) <= 0) {
      Alert.alert('Required', 'Please enter a valid principal amount');
      return;
    }
    
    if (!startDate) {
      Alert.alert('Required', 'Please enter a start date');
      return;
    }
    
    if (repaymentFreq === 'custom' && (!customFreqDays || parseInt(customFreqDays) <= 0)) {
      Alert.alert('Required', 'Please enter valid custom frequency days');
      return;
    }

    setLoading(true);
    
    try {
      await addDebtRecord({
        name: name.trim(),
        description: description.trim() || undefined,
        principal: parseFloat(principal),
        interest_rate: rate,
        interest_type: interestType,
        repayment_freq: repaymentFreq,
        custom_freq_days: repaymentFreq === 'custom' ? parseInt(customFreqDays) : undefined,
        start_date: startDate,
        expected_end_date: expectedEndDate.trim() || undefined,
        status: 'active',
        direction: direction,
      });

      setSnackbarMessage('Debt added successfully');
      setSnackbarVisible(true);
      
      setTimeout(() => {
        router.push('/debt-tracker' as any);
      }, 1500);
      
    } catch (error) {
      console.error('Failed to add debt:', error);
      Alert.alert('Error', 'Failed to add debt. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderInterestTypeOption = (type: DebtRecord['interest_type'], label: string) => (
    <TouchableOpacity
      key={type}
      style={[
        styles.optionButton,
        interestType === type && styles.optionButtonSelected
      ]}
      onPress={() => setInterestType(type)}
    >
      <Text style={[
        styles.optionButtonText,
        interestType === type && styles.optionButtonTextSelected
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderRepaymentFreqOption = (freq: DebtRecord['repayment_freq'], label: string) => (
    <TouchableOpacity
      key={freq}
      style={[
        styles.optionButton,
        repaymentFreq === freq && styles.optionButtonSelected
      ]}
      onPress={() => setRepaymentFreq(freq)}
    >
      <Text style={[
        styles.optionButtonText,
        repaymentFreq === freq && styles.optionButtonTextSelected
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderDirectionOption = (dir: DebtRecord['direction'], label: string, color: string) => (
    <TouchableOpacity
      key={dir}
      style={[
        styles.directionOption,
        direction === dir && { backgroundColor: color, borderColor: color }
      ]}
      onPress={() => setDirection(dir)}
    >
      <Text style={[
        styles.directionOptionText,
        direction === dir && { color: 'white' }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Debt</Text>
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
        {/* Direction Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Debt Direction</Text>
          <View style={styles.directionOptions}>
            {renderDirectionOption('borrowed', 'I borrowed money', SemanticColors.expense)}
            {renderDirectionOption('lent', 'I lent money', SemanticColors.income)}
          </View>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <FormField
            label="Person/Entity Name *"
            placeholder="e.g. John Doe, Bank Name"
            value={name}
            onChangeText={setName}
          />

          <FormField
            label="Description (Optional)"
            placeholder="Add notes about this debt"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <FormField
            label="Principal Amount *"
            placeholder="0.00"
            value={principal}
            onChangeText={setPrincipal}
            keyboardType="numeric"
          />

          <FormField
            label="Start Date *"
            placeholder="YYYY-MM-DD"
            value={startDate}
            onChangeText={setStartDate}
          />

          <FormField
            label="Expected End Date (Optional)"
            placeholder="YYYY-MM-DD"
            value={expectedEndDate}
            onChangeText={setExpectedEndDate}
          />
        </View>

        {/* Interest Settings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Interest Settings</Text>
            <TouchableOpacity 
              onPress={() => setShowPreview(!showPreview)}
              style={styles.previewToggle}
            >
              {showPreview ? <EyeOff size={20} color={Colors.gray[500]} /> : <Eye size={20} color={Colors.gray[500]} />}
            </TouchableOpacity>
          </View>

          <FormField
            label="Interest Rate (%)"
            placeholder="0"
            value={interestRate}
            onChangeText={setInterestRate}
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>Interest Type</Text>
          <View style={styles.optionsContainer}>
            {renderInterestTypeOption('none', 'No Interest')}
            {renderInterestTypeOption('simple', 'Simple Interest')}
            {renderInterestTypeOption('compound_monthly', 'Compound Monthly')}
            {renderInterestTypeOption('compound_quarterly', 'Compound Quarterly')}
            {renderInterestTypeOption('compound_half_yearly', 'Compound Half-Yearly')}
            {renderInterestTypeOption('compound_yearly', 'Compound Yearly')}
          </View>

          {/* Interest Preview */}
          {showPreview && rate > 0 && (
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <TrendingUp size={16} color={Colors.primary[600]} />
                <Text style={styles.previewTitle}>1-Year Interest Preview</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Principal:</Text>
                <Text style={styles.previewValue}>{formatCurrency(principalAmount)}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Interest (1 year):</Text>
                <Text style={styles.previewValue}>{formatCurrency(interestPreview.interestAmount)}</Text>
              </View>
              <View style={[styles.previewRow, styles.previewRowTotal]}>
                <Text style={styles.previewLabel}>Total after 1 year:</Text>
                <Text style={styles.previewValue}>{formatCurrency(interestPreview.totalAmount)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Repayment Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Repayment Settings</Text>
          
          <Text style={styles.fieldLabel}>Repayment Frequency</Text>
          <View style={styles.optionsContainer}>
            {renderRepaymentFreqOption('daily', 'Daily')}
            {renderRepaymentFreqOption('weekly', 'Weekly')}
            {renderRepaymentFreqOption('monthly', 'Monthly')}
            {renderRepaymentFreqOption('custom', 'Custom')}
          </View>

          {repaymentFreq === 'custom' && (
            <FormField
              label="Custom Frequency (days)"
              placeholder="e.g. 14 for bi-weekly"
              value={customFreqDays}
              onChangeText={setCustomFreqDays}
              keyboardType="numeric"
            />
          )}
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
  fieldLabel: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    marginBottom: 8,
    color: Colors.gray[700],
  },
  directionOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  directionOption: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: Layout.radius.lg,
    borderWidth: 2,
    borderColor: Colors.gray[200],
    alignItems: 'center',
  },
  directionOptionText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[700],
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.gray[100],
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  optionButtonSelected: {
    backgroundColor: Colors.primary[100],
    borderColor: Colors.primary[500],
  },
  optionButtonText: {
    fontSize: Typography.size.sm,
    color: Colors.gray[600],
    fontFamily: Typography.family.medium,
  },
  optionButtonTextSelected: {
    color: Colors.primary[600],
    fontFamily: Typography.family.bold,
  },
  previewToggle: {
    padding: 8,
  },
  previewCard: {
    backgroundColor: Colors.primary[50],
    borderRadius: Layout.radius.lg,
    padding: 16,
    marginTop: 16,
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
  },
  previewValue: {
    fontSize: Typography.size.sm,
    color: Colors.gray[900],
    fontFamily: Typography.family.bold,
  },
});

// Helper function for currency formatting (moved outside component to avoid recreation)
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
