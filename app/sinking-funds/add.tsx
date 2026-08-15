import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { formatCurrency } from '../../utils/currency';
import { addSinkingFund } from '../../services/sinkingfunds/sinkingFundService';
import { calculateMonthlyContribution } from '../../services/sinkingfunds/SinkingFundEngine';
import { Snackbar } from '../../components/Snackbar';
export default function AddSinkingFundScreen() {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const monthlyContrib = useMemo(() => {
    const ta = parseFloat(targetAmount);
    if (!ta || !targetDate || !startDate) return 0;
    return calculateMonthlyContribution(ta, startDate, targetDate);
  }, [targetAmount, targetDate, startDate]);

  const handleSave = async () => {
    const ta = parseFloat(targetAmount);
    if (!name.trim()) { return; }
    if (!ta || ta <= 0) { return; }
    if (!targetDate) { return; }

    await addSinkingFund({
      name: name.trim(),
      target_amount: ta,
      target_date: targetDate,
      start_date: startDate,
      monthly_contribution: monthlyContrib,
      current_saved: 0,
      status: 'active',
      is_recurring_annual: isRecurring ? 1 : 0,
      notes: notes || undefined,
    } as any);
    setSnackbarVisible(true);
    setTimeout(() => router.back(), 800);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Sinking Fund</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>Fund Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Annual Insurance, Diwali Shopping" />

          <Text style={styles.label}>Target Amount (₹) *</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={targetAmount} onChangeText={setTargetAmount} placeholder="e.g. 50000" />

          <Text style={styles.label}>Target Date *</Text>
          <TextInput style={styles.input} value={targetDate} onChangeText={setTargetDate} placeholder="YYYY-MM-DD" />

          <Text style={styles.label}>Start Date</Text>
          <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />

          {monthlyContrib > 0 && (
            <View style={styles.contributionPreview}>
              <Text style={styles.contributionLabel}>Monthly Contribution Required</Text>
              <Text style={styles.contributionAmount}>{formatCurrency(monthlyContrib)}/month</Text>
            </View>
          )}

          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes} multiline placeholder="e.g. LIC renewal, school fees..." />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Recurring Annual?</Text>
              <Text style={styles.toggleSub}>Auto-recreate next year after target date</Text>
            </View>
            <Switch value={isRecurring} onValueChange={setIsRecurring} trackColor={{ true: Colors.primary[500], false: Colors.gray[200] }} thumbColor={Colors.white} />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Create Fund</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 60 }} />
      </ScrollView>

      <Snackbar visible={snackbarVisible} message="Sinking fund created" onDismiss={() => setSnackbarVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: Colors.white },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  scroll: { flex: 1, padding: 16 },
  card: { backgroundColor: Colors.white, borderRadius: Layout.radius.lg, padding: 20, ...Layout.shadows.sm },
  label: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.gray[700], marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: Colors.gray[50], padding: 16, borderRadius: Layout.radius.lg, marginBottom: 4, fontSize: Typography.size.md, borderWidth: 1, borderColor: Colors.gray[200] },
  textArea: { height: 80, textAlignVertical: 'top' },
  contributionPreview: { backgroundColor: Colors.primary[50], borderRadius: Layout.radius.md, padding: 16, marginVertical: 12, alignItems: 'center' },
  contributionLabel: { fontSize: Typography.size.sm, color: Colors.primary[600], fontFamily: Typography.family.medium },
  contributionAmount: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.primary[700], marginTop: 4 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  toggleSub: { fontSize: Typography.size.xs, color: Colors.gray[400] },
  saveBtn: { backgroundColor: Colors.primary[600], padding: 16, borderRadius: Layout.radius.lg, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: Colors.white, fontSize: Typography.size.md, fontFamily: Typography.family.bold },
});
