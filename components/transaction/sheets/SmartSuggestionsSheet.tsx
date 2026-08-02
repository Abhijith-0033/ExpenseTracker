import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Sparkles, ArrowRight } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { Colors, Typography, Layout } from '../../../constants/Theme';
import { formatCurrency } from '../../../utils/currency';
import { getRecentTransactions, RecentTx } from '../../../services/smartSuggestionQueries';

export interface SmartSuggestionsSheetProps {
  visible: boolean;
  onClose: () => void;
  typeColor: string;
  onApplySuggestion: (tx: {
    category: string;
    subcategory?: string;
    amount: number;
    accountId?: number;
    description?: string;
  }) => void;
  onApplyAmount: (amount: string) => void;
}

export const SmartSuggestionsSheet: React.FC<SmartSuggestionsSheetProps> = ({
  visible,
  onClose,
  typeColor,
  onApplySuggestion,
  onApplyAmount,
}) => {
  const [recentList, setRecentList] = useState<RecentTx[]>([]);

  useEffect(() => {
    if (visible) {
      getRecentTransactions(5).then(setRecentList).catch(() => {});
    }
  }, [visible]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Smart Suggestions ✨" heightPercent={55}>
      <View style={styles.container}>
        {/* Quick Amount Section */}
        <Text style={styles.sectionTitle}>QUICK AMOUNTS</Text>
        <View style={styles.amountRow}>
          {['50', '100', '200', '500', '1000'].map((amt) => (
            <Pressable
              key={amt}
              onPress={() => {
                onApplyAmount(amt);
                onClose();
              }}
              style={({ pressed }) => [
                styles.amountChip,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.amountChipText}>₹{amt}</Text>
            </Pressable>
          ))}
        </View>

        {/* Past Records Section */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
          BASED ON PAST RECORDS
        </Text>

        {recentList.length === 0 ? (
          <Text style={styles.emptyText}>No past transactions found yet.</Text>
        ) : (
          <FlatList
            data={recentList}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onApplySuggestion({
                    category: item.category,
                    subcategory: item.subcategory,
                    amount: item.amount,
                    accountId: item.account_id,
                    description: item.description,
                  });
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.cardLeft}>
                  <Text style={styles.catName}>
                    {item.category}
                    {item.subcategory ? ` › ${item.subcategory}` : ''}
                  </Text>
                  {!!item.account_name && (
                    <Text style={styles.accName}>{item.account_name}</Text>
                  )}
                </View>

                <View style={styles.cardRight}>
                  <Text style={[styles.amount, { color: typeColor }]}>
                    {formatCurrency(item.amount)}
                  </Text>
                  <View style={[styles.useBtn, { backgroundColor: typeColor + '15' }]}>
                    <Text style={[styles.useBtnText, { color: typeColor }]}>Use This</Text>
                    <ArrowRight size={12} color={typeColor} />
                  </View>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 4,
  },
  sectionTitle: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
    color: Colors.gray[400],
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    gap: 8,
  },
  amountChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountChipText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
    color: Colors.gray[800],
  },
  list: {
    gap: 8,
    paddingBottom: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.gray[50],
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  pressed: {
    opacity: 0.75,
  },
  cardLeft: {
    flex: 1,
  },
  catName: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  accName: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amount: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
  },
  useBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  useBtnText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
  },
  emptyText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: Colors.gray[400],
    marginTop: 8,
  },
});
