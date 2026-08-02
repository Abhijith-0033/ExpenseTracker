import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
} from 'react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { formatCurrency } from '../../utils/currency';
import { getRecentTransactions, RecentTx } from '../../services/smartSuggestionQueries';

export interface InlineAmountSuggestionsProps {
  display: string;
  typeColor: string;
  onApplySuggestion: (tx: {
    category: string;
    subcategory?: string;
    amount: number;
    accountId?: number;
    description?: string;
  }) => void;
}

export const InlineAmountSuggestions: React.FC<InlineAmountSuggestionsProps> = ({
  display,
  typeColor,
  onApplySuggestion,
}) => {
  const [allTransactions, setAllTransactions] = useState<RecentTx[]>([]);
  const [visible, setVisible] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // Load past transactions once on mount
  useEffect(() => {
    getRecentTransactions(30).then(setAllTransactions).catch(() => {});
  }, []);

  // Filter by prefix match on amount
  const suggestions = useMemo(() => {
    if (!display || display === '0') return [];
    const prefix = display.replace(/[^0-9.]/g, '');
    if (!prefix) return [];

    // Find transactions whose amount starts with the typed prefix
    return allTransactions
      .filter((tx) => tx.amount.toString().startsWith(prefix))
      // Deduplicate by amount so we don't show ₹500 five times
      .filter((tx, index, self) => self.findIndex((t) => t.amount === tx.amount) === index)
      .slice(0, 5); // Show at most 5 chips
  }, [display, allTransactions]);

  // Animate in/out
  useEffect(() => {
    const shouldShow = suggestions.length > 0;
    if (shouldShow && !visible) {
      setVisible(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (!shouldShow && visible) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [suggestions.length, visible, fadeAnim]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {suggestions.map((tx) => (
          <Pressable
            key={tx.id}
            onPress={() => onApplySuggestion({
              category: tx.category,
              subcategory: tx.subcategory,
              amount: tx.amount,
              accountId: tx.account_id,
              description: tx.description,
            })}
            style={({ pressed }) => [
              styles.chip,
              { borderColor: typeColor + '40' },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipAmount, { color: typeColor }]}>
              {formatCurrency(tx.amount)}
            </Text>
            {!!tx.category && (
              <Text style={styles.chipCategory} numberOfLines={1}>
                {tx.category}
              </Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    ...Layout.shadows.sm,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  chipAmount: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
  },
  chipCategory: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.gray[400],
    maxWidth: 80,
  },
});
