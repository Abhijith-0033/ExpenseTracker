import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, Modal, TextInput
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { Colors, Typography, Layout, SemanticColors } from '../../constants/Theme';
import { formatCurrency } from '../../utils/currency';
import { Snackbar } from '../../components/Snackbar';
import { BarChart } from 'react-native-gifted-charts';
import {
  getTaxProfile, saveTaxProfile, getTaxDeductions, deleteTaxDeduction, getCurrentFY
} from '../../services/taxplanner/taxPlannerService';
import {
  compareRegimes, suggestRemainingInvestment, TaxProfile, TaxDeduction
} from '../../services/taxplanner/TaxEngine';

export default function TaxPlannerScreen() {
  const router = useRouter();
  const currentFY = getCurrentFY();

  const [selectedFY, _setSelectedFY] = useState(currentFY);
  const [profile, setProfile] = useState<TaxProfile | null>(null);
  const [deductions, setDeductions] = useState<TaxDeduction[]>([]);
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [breakdownRegime, setBreakdownRegime] = useState<'old' | 'new'>('new');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Profile form state
  const [formIncome, setFormIncome] = useState('');
  const [formIsSalaried, setFormIsSalaried] = useState(true);
  const [formBasicSalary, setFormBasicSalary] = useState('');
  const [formHra, setFormHra] = useState('');
  const [formRent, setFormRent] = useState('');
  const [formIsMetro, setFormIsMetro] = useState(false);
  const [formAge, setFormAge] = useState<'below60' | '60to80' | 'above80'>('below60');

  const loadData = useCallback(async () => {
    const [p, d] = await Promise.all([
      getTaxProfile(selectedFY),
      getTaxDeductions(selectedFY),
    ]);
    setProfile(p);
    setDeductions(d);
    if (p) {
      setFormIncome(String(p.annual_income));
      setFormIsSalaried(!!p.is_salaried);
      setFormBasicSalary(String(p.basic_salary));
      setFormHra(String(p.hra_received));
      setFormRent(String(p.rent_paid));
      setFormIsMetro(!!p.is_metro_city);
      setFormAge(p.age_category);
    }
  }, [selectedFY]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const comparison = useMemo(() => {
    if (!profile) return null;
    return compareRegimes(profile, deductions);
  }, [profile, deductions]);

  const suggestion = useMemo(() => {
    if (!profile) return null;
    return suggestRemainingInvestment(profile, deductions);
  }, [profile, deductions]);

  const handleSaveProfile = async () => {
    const income = parseFloat(formIncome);
    if (!income || income <= 0) {
      Alert.alert('Error', 'Please enter a valid annual income');
      return;
    }
    const newProfile: Omit<TaxProfile, 'id'> = {
      financial_year: selectedFY,
      annual_income: income,
      is_salaried: formIsSalaried ? 1 : 0,
      tax_regime: 'new',
      age_category: formAge,
      hra_received: parseFloat(formHra) || 0,
      rent_paid: parseFloat(formRent) || 0,
      is_metro_city: formIsMetro ? 1 : 0,
      basic_salary: parseFloat(formBasicSalary) || 0,
    };
    await saveTaxProfile(newProfile);
    setShowSetupForm(false);
    setSnackbarMessage('Tax profile saved');
    setSnackbarVisible(true);
    loadData();
  };

  const handleDeleteDeduction = (id: number) => {
    Alert.alert('Delete Deduction', 'Remove this investment?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteTaxDeduction(id);
        loadData();
        setSnackbarMessage('Deduction removed');
        setSnackbarVisible(true);
      }},
    ]);
  };

  // Days until March 31
  const now = new Date();
  const marchEnd = new Date(now.getMonth() < 3 ? now.getFullYear() : now.getFullYear() + 1, 2, 31);
  const daysUntilMarch = Math.max(0, Math.ceil((marchEnd.getTime() - now.getTime()) / 86400000));
  const isJanToMarch = now.getMonth() >= 0 && now.getMonth() <= 2; // Jan-Mar

  // Group deductions by section
  const deductionsBySection = useMemo(() => {
    const groups: Record<string, TaxDeduction[]> = {};
    deductions.forEach(d => {
      if (!groups[d.section]) groups[d.section] = [];
      groups[d.section].push(d);
    });
    return groups;
  }, [deductions]);

  const chartData = useMemo(() => {
    if (!comparison) return [];
    return [
      { value: comparison.oldRegimeTax, label: 'Old', frontColor: comparison.recommendedRegime === 'old' ? SemanticColors.income : SemanticColors.expense },
      { value: comparison.newRegimeTax, label: 'New', frontColor: comparison.recommendedRegime === 'new' ? SemanticColors.income : SemanticColors.expense },
    ];
  }, [comparison]);

  const render80CProgress = () => {
    if (!comparison) return null;
    const bd = comparison.oldResult.deductionBreakdown;
    if (!bd) return null;
    const used80C = bd.section80C;
    const pct = Math.min(1, used80C / 150000);
    const color = pct < 0.5 ? '#F59E0B' : pct < 0.9 ? Colors.primary[500] : SemanticColors.income;
    return (
      <View style={styles.progressRow}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Section 80C</Text>
          <Text style={styles.progressValue}>{formatCurrency(used80C)} / ₹1,50,000</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        </View>
        <Text style={styles.progressSub}>₹{(150000 - used80C).toLocaleString('en-IN')} left to invest</Text>
      </View>
    );
  };

  const render80DProgress = () => {
    if (!comparison) return null;
    const bd = comparison.oldResult.deductionBreakdown;
    if (!bd) return null;
    const limit = profile?.age_category === 'below60' ? 25000 : 50000;
    const used = bd.section80D;
    const pct = Math.min(1, used / limit);
    const color = pct < 0.5 ? '#F59E0B' : pct < 0.9 ? Colors.primary[500] : SemanticColors.income;
    return (
      <View style={styles.progressRow}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Section 80D</Text>
          <Text style={styles.progressValue}>{formatCurrency(used)} / {formatCurrency(limit)}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        </View>
        <Text style={styles.progressSub}>₹{(limit - used).toLocaleString('en-IN')} left to invest</Text>
      </View>
    );
  };

  const renderBreakdownModal = () => {
    const result = breakdownRegime === 'old' ? comparison?.oldResult : comparison?.newResult;
    if (!result || !comparison) return null;
    const bd = result.deductionBreakdown;
    return (
      <Modal visible={showBreakdownModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{breakdownRegime === 'old' ? 'Old' : 'New'} Regime Breakdown</Text>
              <TouchableOpacity onPress={() => setShowBreakdownModal(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Income breakdown */}
              <Text style={styles.modalSection}>Income Breakdown</Text>
              <View style={styles.tableRow}><Text style={styles.tableLabel}>Gross Income</Text><Text style={styles.tableValue}>{formatCurrency(result.grossIncome)}</Text></View>
              <View style={styles.tableRow}><Text style={styles.tableLabel}>Standard Deduction</Text><Text style={[styles.tableValue, { color: SemanticColors.income }]}>-{formatCurrency(bd?.standardDeduction || (profile?.is_salaried ? 75000 : 0))}</Text></View>
              {bd && bd.hraExemption > 0 && <View style={styles.tableRow}><Text style={styles.tableLabel}>HRA Exemption</Text><Text style={[styles.tableValue, { color: SemanticColors.income }]}>-{formatCurrency(bd.hraExemption)}</Text></View>}
              {bd && bd.section80C > 0 && <View style={styles.tableRow}><Text style={styles.tableLabel}>Section 80C</Text><Text style={[styles.tableValue, { color: SemanticColors.income }]}>-{formatCurrency(bd.section80C)}</Text></View>}
              {bd && bd.section80D > 0 && <View style={styles.tableRow}><Text style={styles.tableLabel}>Section 80D</Text><Text style={[styles.tableValue, { color: SemanticColors.income }]}>-{formatCurrency(bd.section80D)}</Text></View>}
              {bd && bd.section80CCD1B > 0 && <View style={styles.tableRow}><Text style={styles.tableLabel}>80CCD(1B) NPS</Text><Text style={[styles.tableValue, { color: SemanticColors.income }]}>-{formatCurrency(bd.section80CCD1B)}</Text></View>}
              {bd && bd.section80E > 0 && <View style={styles.tableRow}><Text style={styles.tableLabel}>Section 80E</Text><Text style={[styles.tableValue, { color: SemanticColors.income }]}>-{formatCurrency(bd.section80E)}</Text></View>}
              <View style={[styles.tableRow, styles.tableDivider]}><Text style={[styles.tableLabel, { fontFamily: Typography.family.bold }]}>Taxable Income</Text><Text style={[styles.tableValue, { fontFamily: Typography.family.bold }]}>{formatCurrency(result.taxableIncome)}</Text></View>

              {/* Slab breakdown */}
              <Text style={[styles.modalSection, { marginTop: 16 }]}>Tax Slab Breakdown</Text>
              {result.slabBreakdown.map((slab, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.tableLabel, { flex: 2 }]}>{slab.label} @ {slab.rate}</Text>
                  <Text style={styles.tableValue}>{formatCurrency(slab.tax)}</Text>
                </View>
              ))}
              <View style={styles.tableRow}><Text style={styles.tableLabel}>Slab Tax</Text><Text style={styles.tableValue}>{formatCurrency(result.slabTax)}</Text></View>
              {result.rebate87A > 0 && <View style={styles.tableRow}><Text style={styles.tableLabel}>87A Rebate</Text><Text style={[styles.tableValue, { color: SemanticColors.income }]}>-{formatCurrency(result.rebate87A)}</Text></View>}
              <View style={styles.tableRow}><Text style={styles.tableLabel}>Health & Education Cess (4%)</Text><Text style={styles.tableValue}>+{formatCurrency(result.cess)}</Text></View>
              <View style={[styles.tableRow, styles.tableDivider]}><Text style={[styles.tableLabel, { fontFamily: Typography.family.bold }]}>Total Tax Payable</Text><Text style={[styles.tableValue, { fontFamily: Typography.family.bold, color: SemanticColors.expense }]}>{formatCurrency(result.totalTax)}</Text></View>
              <View style={styles.tableRow}><Text style={styles.tableLabel}>Monthly TDS Estimate</Text><Text style={styles.tableValue}>{formatCurrency(result.monthlyTDS)}</Text></View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ─── RENDER ─────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Tax Planner</Text>
          <Text style={styles.headerSubtitle}>FY {selectedFY}</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/tax-planner/add-deduction' as any)}
        >
          <Plus size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Setup prompt or dashboard */}
        {!profile || showSetupForm ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tax Profile</Text>
            {/* Annual Income */}
            <Text style={styles.fieldLabel}>Gross Annual Income (₹) *</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={formIncome} onChangeText={setFormIncome} placeholder="e.g. 1000000" />

            {/* Salaried toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.fieldLabel}>Salaried Employee?</Text>
              <Switch value={formIsSalaried} onValueChange={setFormIsSalaried} trackColor={{ true: Colors.primary[500], false: Colors.gray[200] }} thumbColor={Colors.white} />
            </View>

            {formIsSalaried && (
              <>
                <Text style={styles.fieldLabel}>Basic Salary (Annual) (₹)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={formBasicSalary} onChangeText={setFormBasicSalary} placeholder="e.g. 500000" />
                <Text style={styles.fieldLabel}>HRA Received Annually (₹)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={formHra} onChangeText={setFormHra} placeholder="e.g. 200000" />
                <Text style={styles.fieldLabel}>Annual Rent Paid (₹)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={formRent} onChangeText={setFormRent} placeholder="e.g. 180000" />
                <View style={styles.toggleRow}>
                  <Text style={styles.fieldLabel}>Metro City?</Text>
                  <Switch value={formIsMetro} onValueChange={setFormIsMetro} trackColor={{ true: Colors.primary[500], false: Colors.gray[200] }} thumbColor={Colors.white} />
                </View>
              </>
            )}

            {/* Age category */}
            <Text style={styles.fieldLabel}>Age Category</Text>
            <View style={styles.segmented}>
              {(['below60', '60to80', 'above80'] as const).map(age => (
                <TouchableOpacity
                  key={age}
                  style={[styles.segmentOption, formAge === age && styles.segmentOptionActive]}
                  onPress={() => setFormAge(age)}
                >
                  <Text style={[styles.segmentText, formAge === age && styles.segmentTextActive]}>
                    {age === 'below60' ? 'Below 60' : age === '60to80' ? '60–80' : 'Above 80'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
              <Text style={styles.saveBtnText}>Save Profile</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* REGIME COMPARISON HERO */}
            {comparison && (
              <View style={styles.regimeCard}>
                <Text style={styles.regimeCardTitle}>Regime Comparison</Text>
                <View style={styles.regimeCols}>
                  {(['old', 'new'] as const).map(regime => {
                    const isRecommended = comparison.recommendedRegime === regime;
                    const tax = regime === 'old' ? comparison.oldRegimeTax : comparison.newRegimeTax;
                    return (
                      <TouchableOpacity
                        key={regime}
                        style={[styles.regimeCol, isRecommended && styles.regimeColRecommended]}
                        onPress={() => { setBreakdownRegime(regime); setShowBreakdownModal(true); }}
                      >
                        <Text style={[styles.regimeLabel, isRecommended && { color: Colors.white }]}>
                          {regime === 'old' ? 'Old Regime' : 'New Regime'}
                        </Text>
                        <Text style={[styles.regimeTax, isRecommended && { color: Colors.white }]}>
                          {formatCurrency(tax)}
                        </Text>
                        {isRecommended && (
                          <View style={styles.recommendedBadge}>
                            <Text style={styles.recommendedText}>✓ Recommended</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.savingsText}>
                  You save {formatCurrency(comparison.savings)} with {comparison.recommendedRegime === 'old' ? 'Old' : 'New'} Regime
                </Text>

                {/* Bar chart */}
                <View style={{ marginTop: 16, alignItems: 'center' }}>
                  <BarChart
                    data={chartData}
                    height={120}
                    barWidth={60}
                    spacing={40}
                    initialSpacing={30}
                    backgroundColor={Colors.white}
                    yAxisTextStyle={{ color: Colors.gray[500], fontSize: 10 }}
                    noOfSections={3}
                  />
                </View>
              </View>
            )}

            {/* DEDUCTION PROGRESS (old regime only) */}
            {comparison && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Deduction Utilization (Old Regime)</Text>
                {render80CProgress()}
                {render80DProgress()}
                {/* 80CCD1B */}
                {(() => {
                  const bd = comparison.oldResult.deductionBreakdown;
                  if (!bd) return null;
                  const pct = Math.min(1, bd.section80CCD1B / 50000);
                  const color = pct < 0.5 ? '#F59E0B' : pct < 0.9 ? Colors.primary[500] : SemanticColors.income;
                  return (
                    <View style={styles.progressRow}>
                      <View style={styles.progressHeader}>
                        <Text style={styles.progressLabel}>80CCD(1B) NPS</Text>
                        <Text style={styles.progressValue}>{formatCurrency(bd.section80CCD1B)} / ₹50,000</Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
                      </View>
                      <Text style={styles.progressSub}>₹{(50000 - bd.section80CCD1B).toLocaleString('en-IN')} left to invest</Text>
                    </View>
                  );
                })()}
              </View>
            )}

            {/* DEADLINE COUNTDOWN */}
            {isJanToMarch && suggestion && suggestion.section80CRemaining > 0 && (
              <View style={[styles.deadlineCard, { backgroundColor: daysUntilMarch < 30 ? '#FDF1F1' : Colors.primary[50] }]}>
                <Text style={styles.deadlineTitle}>⏰ {daysUntilMarch} days until March 31</Text>
                <Text style={styles.deadlineBody}>
                  Invest {formatCurrency(suggestion.section80CRemaining + suggestion.section80DRemaining + suggestion.section80CCD1BRemaining)} more to maximize deductions and save {formatCurrency(suggestion.totalPotentialSavings)} in tax.
                </Text>
                <TouchableOpacity
                  style={styles.deadlineBtn}
                  onPress={() => router.push('/tax-planner/add-deduction' as any)}
                >
                  <Text style={styles.deadlineBtnText}>Add Investment</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* DEDUCTION LIST */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Your Investments This Year</Text>
                <TouchableOpacity onPress={() => router.push('/tax-planner/add-deduction' as any)}>
                  <Plus size={20} color={Colors.primary[600]} />
                </TouchableOpacity>
              </View>

              {deductions.length === 0 ? (
                <Text style={styles.emptyText}>No investments added yet. Add 80C, 80D, or NPS contributions.</Text>
              ) : (
                Object.entries(deductionsBySection).map(([section, items]) => {
                  const total = items.reduce((s, d) => s + d.amount, 0);
                  const limit = section === '80C' ? 150000 : section === '80D' ? (profile?.age_category === 'below60' ? 25000 : 50000) : section === '80CCD1B' ? 50000 : null;
                  return (
                    <View key={section} style={styles.deductionGroup}>
                      <Text style={styles.deductionGroupTitle}>Section {section}</Text>
                      {items.map(item => (
                        <View key={item.id} style={styles.deductionItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.deductionName}>{item.instrument_type || item.section}</Text>
                            <Text style={styles.deductionDate}>{item.date_invested}</Text>
                          </View>
                          <Text style={styles.deductionAmount}>{formatCurrency(item.amount)}</Text>
                          <TouchableOpacity onPress={() => handleDeleteDeduction(item.id!)}>
                            <Text style={styles.deductionDelete}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                      <View style={styles.deductionGroupTotal}>
                        <Text style={styles.deductionGroupTotalText}>
                          Total {section}: {formatCurrency(total)}{limit ? ` / ${formatCurrency(limit)}` : ''}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* EDIT PROFILE */}
            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={() => setShowSetupForm(true)}
            >
              <Text style={styles.editProfileText}>Edit Tax Profile</Text>
            </TouchableOpacity>

            {/* EDUCATION CARD */}
            <View style={styles.educationCard}>
              <Text style={styles.educationTitle}>💡 Understanding Tax Regimes</Text>
              <Text style={styles.educationBody}>
                The old regime allows deductions (80C, 80D, HRA) but has higher slab rates. The new regime has lower rates but no deductions except the standard deduction. Choose based on which gives lower tax.
              </Text>
              <Text style={styles.disclaimer}>
                This is an estimate for FY {selectedFY}. Consult a tax professional for exact filing. Tax laws may change.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {renderBreakdownModal()}
      <Snackbar visible={snackbarVisible} message={snackbarMessage} onDismiss={() => setSnackbarVisible(false)} />
    </View>
  );
}

// ── STYLES (match existing app patterns) ─────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: Colors.white },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  headerSubtitle: { fontSize: Typography.size.sm, color: Colors.gray[500], fontFamily: Typography.family.regular },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary[600], justifyContent: 'center', alignItems: 'center' },
  section: { backgroundColor: Colors.white, borderRadius: Layout.radius.lg, margin: 16, padding: 20, ...Layout.shadows.sm },
  sectionTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.gray[900], marginBottom: 16 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  fieldLabel: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.gray[700], marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: Colors.gray[50], padding: 16, borderRadius: Layout.radius.lg, marginBottom: 4, fontSize: Typography.size.md, borderWidth: 1, borderColor: Colors.gray[200] },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  segmented: { flexDirection: 'row', backgroundColor: Colors.gray[100], borderRadius: Layout.radius.md, padding: 4, marginBottom: 16 },
  segmentOption: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Layout.radius.sm },
  segmentOptionActive: { backgroundColor: Colors.white, ...Layout.shadows.sm },
  segmentText: { fontSize: Typography.size.sm, color: Colors.gray[500], fontFamily: Typography.family.medium },
  segmentTextActive: { color: Colors.primary[600], fontFamily: Typography.family.bold },
  saveBtn: { backgroundColor: Colors.primary[600], padding: 16, borderRadius: Layout.radius.lg, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: Colors.white, fontSize: Typography.size.md, fontFamily: Typography.family.bold },
  regimeCard: { backgroundColor: Colors.white, borderRadius: Layout.radius.lg, margin: 16, padding: 20, ...Layout.shadows.md },
  regimeCardTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.gray[900], marginBottom: 16 },
  regimeCols: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  regimeCol: { flex: 1, backgroundColor: Colors.gray[50], borderRadius: Layout.radius.md, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.gray[200] },
  regimeColRecommended: { backgroundColor: Colors.primary[600], borderColor: Colors.primary[600] },
  regimeLabel: { fontSize: Typography.size.sm, fontFamily: Typography.family.medium, color: Colors.gray[600], marginBottom: 8 },
  regimeTax: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  recommendedBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Layout.radius.full, marginTop: 8 },
  recommendedText: { color: Colors.white, fontSize: Typography.size.xs, fontFamily: Typography.family.bold },
  savingsText: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: SemanticColors.income, textAlign: 'center', marginTop: 4 },
  progressRow: { marginBottom: 16 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: Typography.size.sm, fontFamily: Typography.family.medium, color: Colors.gray[700] },
  progressValue: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  progressTrack: { height: 8, backgroundColor: Colors.gray[200], borderRadius: Layout.radius.full, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', borderRadius: Layout.radius.full },
  progressSub: { fontSize: Typography.size.xs, color: Colors.gray[400] },
  deadlineCard: { marginHorizontal: 16, borderRadius: Layout.radius.lg, padding: 20, marginBottom: 4 },
  deadlineTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.gray[900], marginBottom: 8 },
  deadlineBody: { fontSize: Typography.size.md, color: Colors.gray[600], lineHeight: 22, marginBottom: 16 },
  deadlineBtn: { backgroundColor: Colors.primary[600], paddingVertical: 12, paddingHorizontal: 20, borderRadius: Layout.radius.md, alignSelf: 'flex-start' },
  deadlineBtnText: { color: Colors.white, fontSize: Typography.size.sm, fontFamily: Typography.family.bold },
  deductionGroup: { marginBottom: 16 },
  deductionGroupTitle: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.gray[500], textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  deductionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  deductionName: { fontSize: Typography.size.md, fontFamily: Typography.family.medium, color: Colors.gray[900] },
  deductionDate: { fontSize: Typography.size.xs, color: Colors.gray[400] },
  deductionAmount: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[900], marginRight: 12 },
  deductionDelete: { fontSize: 18, color: Colors.danger[500], padding: 4 },
  deductionGroupTotal: { paddingTop: 8 },
  deductionGroupTotalText: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.primary[600] },
  emptyText: { fontSize: Typography.size.md, color: Colors.gray[400], textAlign: 'center', paddingVertical: 20 },
  editProfileBtn: { marginHorizontal: 16, marginBottom: 8, alignItems: 'center', paddingVertical: 12 },
  editProfileText: { fontSize: Typography.size.sm, color: Colors.primary[600], fontFamily: Typography.family.medium },
  educationCard: { margin: 16, backgroundColor: Colors.primary[50], borderRadius: Layout.radius.lg, padding: 20 },
  educationTitle: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[900], marginBottom: 8 },
  educationBody: { fontSize: Typography.size.sm, color: Colors.gray[600], lineHeight: 20, marginBottom: 12 },
  disclaimer: { fontSize: Typography.size.xs, color: Colors.gray[400], lineHeight: 16, fontStyle: 'italic' },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  modalClose: { fontSize: 28, color: Colors.gray[500] },
  modalSection: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.gray[500], textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  tableLabel: { fontSize: Typography.size.sm, color: Colors.gray[600], flex: 1, flexWrap: 'wrap' },
  tableValue: { fontSize: Typography.size.sm, color: Colors.gray[900], fontFamily: Typography.family.bold },
  tableDivider: { borderTopWidth: 2, borderTopColor: Colors.gray[300], paddingTop: 12, marginTop: 4 },
});
