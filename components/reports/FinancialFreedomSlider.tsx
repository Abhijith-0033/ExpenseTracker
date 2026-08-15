import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { safeDivide } from '../../utils/mathUtils';
import { formatCurrency } from '../../utils/currency';

interface FinancialFreedomSliderProps {
  currentSavingsRate: number;    // 0-100
  annualExpense: number;
  annualSavings: number;
}

export function FinancialFreedomSlider({ currentSavingsRate, annualExpense, annualSavings }: FinancialFreedomSliderProps) {
  const [savingsRateBoost, setSavingsRateBoost] = useState(0);

  const freedomNumber = annualExpense * 25;
  const effectiveRate = Math.min(99, currentSavingsRate + savingsRateBoost);
  const additionalAnnualSavings = annualExpense * (savingsRateBoost / 100);
  const adjustedAnnualSavings = Math.max(1, annualSavings + additionalAnnualSavings);
  const yearsToFreedom = freedomNumber > 0 && adjustedAnnualSavings > 0
    ? Math.round(safeDivide(freedomNumber, adjustedAnnualSavings, 999))
    : 999;

  const boostOptions = [0, 5, 10, 15, 20, 30];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        What if I saved {savingsRateBoost > 0 ? `${savingsRateBoost}% more` : 'more'}?
      </Text>

      {/* Button Stepper */}
      <View style={styles.boostRow}>
        {boostOptions.map(boost => (
          <TouchableOpacity
            key={boost}
            style={[styles.boostBtn, savingsRateBoost === boost && styles.boostBtnActive]}
            onPress={() => setSavingsRateBoost(boost)}
            activeOpacity={0.7}
          >
            <Text style={[styles.boostBtnText, savingsRateBoost === boost && styles.boostBtnTextActive]}>
              +{boost}%
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.resultCard}>
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Effective Savings Rate:</Text>
          <Text style={[styles.resultValue, { color: Colors.primary[500] }]}>
            {effectiveRate.toFixed(0)}%
          </Text>
        </View>
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Financial Freedom In:</Text>
          <Text style={[styles.resultValue, { color: Colors.success[600] }]}>
            {yearsToFreedom > 100 ? '100+ years' : `${yearsToFreedom} years`}
          </Text>
        </View>
        {savingsRateBoost > 0 && (
          <Text style={styles.impactText}>
            💡 Saving {savingsRateBoost}% more = +{formatCurrency(Math.round(additionalAnnualSavings))} per year
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8 },
  title: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[800],
    marginBottom: 12,
  },
  boostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 4,
  },
  boostBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
  },
  boostBtnActive: {
    backgroundColor: Colors.primary[500],
  },
  boostBtnText: {
    fontSize: 11,
    fontFamily: Typography.family.bold,
    color: Colors.gray[600],
  },
  boostBtnTextActive: {
    color: Colors.white,
  },
  resultCard: {
    backgroundColor: Colors.gray[50],
    borderRadius: Layout.radius.md,
    padding: 12,
    gap: 8,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[600],
  },
  resultValue: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
  },
  impactText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.primary[600],
    marginTop: 4,
  },
});
