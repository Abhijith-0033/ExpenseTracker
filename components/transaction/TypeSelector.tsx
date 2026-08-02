import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, Typography } from '../../constants/Theme';

export type TransactionType = 'expense' | 'income' | 'transfer';

export interface TypeSelectorProps {
  activeType: TransactionType;
  onTypeChange: (type: TransactionType) => void;
  typeColor: string;
}

const TYPES: { type: TransactionType; label: string; emoji: string }[] = [
  { type: 'expense', label: 'Expense', emoji: '💸' },
  { type: 'income', label: 'Income', emoji: '💰' },
  { type: 'transfer', label: 'Transfer', emoji: '↔' },
];

export const TypeSelector: React.FC<TypeSelectorProps> = ({
  activeType,
  onTypeChange,
  typeColor,
}) => {
  return (
    <View style={styles.container}>
      {TYPES.map((t) => {
        const isActive = t.type === activeType;
        return (
          <Pressable
            key={t.type}
            onPress={() => onTypeChange(t.type)}
            style={({ pressed }) => [
              styles.pill,
              isActive && { backgroundColor: typeColor },
              pressed && !isActive && styles.pressed,
            ]}
          >
            <Text style={styles.emoji}>{t.emoji}</Text>
            <Text
              style={[
                styles.label,
                isActive ? styles.activeLabel : styles.inactiveLabel,
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 16,
    padding: 3,
    alignSelf: 'center',
    width: '88%',
    marginVertical: 8,
  },
  pill: {
    flex: 1,
    height: 36,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pressed: {
    opacity: 0.7,
  },
  emoji: {
    fontSize: 14,
  },
  label: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
  },
  activeLabel: {
    color: Colors.white,
  },
  inactiveLabel: {
    color: Colors.gray[500],
  },
});
