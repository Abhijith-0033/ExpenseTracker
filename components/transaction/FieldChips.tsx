import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { ArrowLeftRight } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';

export interface FieldChipsProps {
  type: 'expense' | 'income' | 'transfer';
  typeColor: string;
  date: Date;
  account?: any | null;
  fromAccount?: any | null;
  toAccount?: any | null;
  category?: string;
  subcategory?: string;
  description?: string;
  incomeSource?: string;
  incomeSubcategory?: string;
  errors?: Record<string, string>;
  onDatePress: () => void;
  onAccountPress?: () => void;
  onFromAccountPress?: () => void;
  onToAccountPress?: () => void;
  onSwapAccounts?: () => void;
  onCategoryPress?: () => void;
  onNotePress: () => void;
  onIncomeSourcePress?: () => void;
}

export const FieldChips: React.FC<FieldChipsProps> = ({
  type,
  typeColor,
  date,
  account,
  fromAccount,
  toAccount,
  category,
  subcategory,
  description,
  incomeSource,
  incomeSubcategory,
  errors = {},
  onDatePress,
  onAccountPress,
  onFromAccountPress,
  onToAccountPress,
  onSwapAccounts,
  onCategoryPress,
  onNotePress,
  onIncomeSourcePress,
}) => {
  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const dateLabel = isToday ? 'Today' : format(date, 'MMM dd');

  const renderChip = (
    label: string,
    value: string | undefined,
    emoji: string,
    onPress: (() => void) | undefined,
    hasError = false,
    placeholder = 'Select'
  ) => {
    const isSet = !!value;
    return (
      <Pressable
        key={label}
        onPress={onPress}
        style={({ pressed }) => [
          styles.chip,
          isSet ? [styles.filledChip, { borderColor: typeColor + '60' }] : styles.unsetChip,
          hasError && styles.errorChip,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={[styles.chipText, isSet ? styles.filledText : styles.unsetText]}>
          {value || `${label}`}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Date Chip */}
        {renderChip('Date', dateLabel, '📅', onDatePress)}

        {/* Account / From / To Chips */}
        {type !== 'transfer' &&
          renderChip(
            'Account',
            account?.name,
            '🏦',
            onAccountPress,
            !!errors.account
          )}

        {type === 'transfer' && (
          <>
            {renderChip(
              'From',
              fromAccount?.name,
              '📤',
              onFromAccountPress,
              !!errors.fromAccount
            )}
            <TouchableOpacity
              onPress={onSwapAccounts}
              style={styles.swapBtn}
              activeOpacity={0.7}
            >
              <ArrowLeftRight size={15} color={typeColor} />
            </TouchableOpacity>
            {renderChip(
              'To',
              toAccount?.name,
              '📥',
              onToAccountPress,
              !!errors.toAccount
            )}
          </>
        )}

        {/* Category Chip (Expense) */}
        {type === 'expense' &&
          renderChip(
            'Category',
            category ? (subcategory ? `${category} › ${subcategory}` : category) : undefined,
            '🏷️',
            onCategoryPress,
            !!errors.category
          )}

        {/* Income Source Chip (Income) */}
        {type === 'income' &&
          renderChip(
            'Source',
            incomeSource
              ? incomeSubcategory
                ? `${incomeSource} › ${incomeSubcategory}`
                : incomeSource
              : undefined,
            '💼',
            onIncomeSourcePress
          )}

        {/* Note / Description Chip */}
        {renderChip(
          'Note',
          description ? (description.length > 14 ? `${description.slice(0, 14)}...` : description) : undefined,
          '📝',
          onNotePress
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 6,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    height: 38,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 6,
  },
  unsetChip: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.gray[200],
    borderStyle: 'dashed',
  },
  filledChip: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderStyle: 'solid',
    ...Layout.shadows.sm,
  },
  errorChip: {
    borderColor: Colors.danger[400],
    borderStyle: 'solid',
    backgroundColor: Colors.danger[50],
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  emoji: {
    fontSize: 14,
  },
  chipText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
  },
  filledText: {
    color: Colors.gray[900],
  },
  unsetText: {
    color: Colors.gray[400],
  },
  swapBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.gray[200],
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
