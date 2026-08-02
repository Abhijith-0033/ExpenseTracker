import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '../../constants/Theme';
import { formatCurrency } from '../../utils/currency';
import { getTodayExpenseTotal, getMonthIncomeTotal } from '../../services/smartSuggestionQueries';

export interface RunningTotalProps {
  type: 'expense' | 'income' | 'transfer';
  accountBalance?: number;
}

export const RunningTotal: React.FC<RunningTotalProps> = ({
  type,
  accountBalance,
}) => {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        if (type === 'expense') {
          const val = await getTodayExpenseTotal();
          if (isMounted) setTotal(val);
        } else if (type === 'income') {
          const val = await getMonthIncomeTotal();
          if (isMounted) setTotal(val);
        }
      } catch (_e) {}
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [type]);

  let subtitle = '';
  if (type === 'expense' && total !== null) {
    subtitle = `Today's total spend: ${formatCurrency(total)}`;
  } else if (type === 'income' && total !== null) {
    subtitle = `This month's total income: ${formatCurrency(total)}`;
  } else if (type === 'transfer' && accountBalance !== undefined) {
    subtitle = `Available balance: ${formatCurrency(accountBalance)}`;
  }

  if (!subtitle) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{subtitle}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 6,
  },
  text: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: Colors.gray[400],
  },
});
