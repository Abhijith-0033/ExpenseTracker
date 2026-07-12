import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { addTaxDeduction, getCurrentFY } from '../../services/taxplanner/taxPlannerService';
import { TaxDeduction } from '../../services/taxplanner/TaxEngine';
import { Snackbar } from '../../components/Snackbar';

const SECTION_OPTIONS = ['80C', '80D', '80CCD1B', '80E', '80G', 'other'] as const;
type Section = typeof SECTION_OPTIONS[number];

const INSTRUMENTS: Record<string, string[]> = {
  '80C':    ['PPF', 'ELSS', 'LIC Premium', 'EPF', 'NSC', 'Tax-Saver FD', 'Other'],
  '80D':    ['Health Insurance Premium', 'Preventive Health Checkup'],
  '80CCD1B': ['NPS Contribution'],
  '80E':    ['Education Loan Interest'],
  '80G':    ['Donation'],
  'other':  ['Other'],
};

export default function AddDeductionScreen() {
  const router = useRouter();
  const [section, setSection] = useState<Section>('80C');
  const [instrument, setInstrument] = useState(INSTRUMENTS['80C'][0]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const handleSectionChange = (s: Section) => {
    setSection(s);
    setInstrument(INSTRUMENTS[s][0]);
  };

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    const deduction: Omit<TaxDeduction, 'id'> = {
      financial_year: getCurrentFY(),
      section: section === '80CCD1B' ? '80CCD1B' : section as any,
      instrument_type: instrument,
      amount: amt,
      date_invested: date,
      notes: notes || undefined,
    };
    await addTaxDeduction(deduction);
    setSnackbarVisible(true);
    setTimeout(() => router.back(), 800);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Investment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {/* Section picker */}
          <Text style={styles.label}>Section</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {SECTION_OPTIONS.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.sectionChip, section === s && styles.sectionChipActive]}
                onPress={() => handleSectionChange(s)}
              >
                <Text style={[styles.sectionChipText, section === s && styles.sectionChipTextActive]}>
                  {s === '80CCD1B' ? '80CCD(1B)' : s}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Instrument picker */}
          <Text style={styles.label}>Instrument Type</Text>
          <View style={{ marginBottom: 16 }}>
            {INSTRUMENTS[section].map(inst => (
              <TouchableOpacity
                key={inst}
                style={[styles.instrumentOption, instrument === inst && styles.instrumentOptionActive]}
                onPress={() => setInstrument(inst)}
              >
                <Text style={[styles.instrumentText, instrument === inst && styles.instrumentTextActive]}>{inst}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount */}
          <Text style={styles.label}>Amount (₹) *</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="0" />

          {/* Date */}
          <Text style={styles.label}>Date Invested</Text>
          <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />

          {/* Notes */}
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes} placeholder="e.g. PPF account number..." multiline />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Investment</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 60 }} />
      </ScrollView>

      <Snackbar visible={snackbarVisible} message="Investment saved" onDismiss={() => setSnackbarVisible(false)} />
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
  sectionChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Layout.radius.full, backgroundColor: Colors.gray[100], marginRight: 8 },
  sectionChipActive: { backgroundColor: Colors.primary[600] },
  sectionChipText: { fontSize: Typography.size.sm, color: Colors.gray[600], fontFamily: Typography.family.medium },
  sectionChipTextActive: { color: Colors.white, fontFamily: Typography.family.bold },
  instrumentOption: { padding: 14, borderRadius: Layout.radius.md, backgroundColor: Colors.gray[50], marginBottom: 6, borderWidth: 1, borderColor: Colors.gray[200] },
  instrumentOptionActive: { backgroundColor: Colors.primary[100], borderColor: Colors.primary[500] },
  instrumentText: { fontSize: Typography.size.md, color: Colors.gray[700], fontFamily: Typography.family.medium },
  instrumentTextActive: { color: Colors.primary[700], fontFamily: Typography.family.bold },
  saveBtn: { backgroundColor: Colors.primary[600], padding: 16, borderRadius: Layout.radius.lg, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: Colors.white, fontSize: Typography.size.md, fontFamily: Typography.family.bold },
});
