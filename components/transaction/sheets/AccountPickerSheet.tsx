import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Wallet, Check } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { Colors, Typography, Layout } from '../../../constants/Theme';
import { formatCurrency } from '../../../utils/currency';

export interface AccountPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  accounts: any[];
  selectedAccountId?: number | null;
  onSelect: (account: any) => void;
  title?: string;
  excludeAccountId?: number | null;
  typeColor: string;
}

export const AccountPickerSheet: React.FC<AccountPickerSheetProps> = ({
  visible,
  onClose,
  accounts,
  selectedAccountId,
  onSelect,
  title = 'Select Account',
  excludeAccountId,
  typeColor,
}) => {
  const filteredAccounts = excludeAccountId
    ? accounts.filter((acc) => acc.id !== excludeAccountId)
    : accounts;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} heightPercent={55}>
      <FlatList
        data={filteredAccounts}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isSelected = item.id === selectedAccountId;
          return (
            <Pressable
              onPress={() => {
                onSelect(item);
                onClose();
              }}
              style={({ pressed }) => [
                styles.accountRow,
                isSelected && [styles.selectedRow, { borderColor: typeColor, backgroundColor: typeColor + '0A' }],
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.iconCircle}>
                <Wallet size={20} color={isSelected ? typeColor : Colors.gray[500]} />
              </View>

              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.type}>{item.type || 'General'}</Text>
              </View>

              <View style={styles.right}>
                <Text style={styles.balance}>{formatCurrency(item.balance)}</Text>
                {isSelected && (
                  <View style={[styles.checkCircle, { backgroundColor: typeColor }]}>
                    <Check size={12} color={Colors.white} />
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
      />
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  list: {
    paddingVertical: 8,
    gap: 8,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.gray[100],
    ...Layout.shadows.sm,
  },
  selectedRow: {
    borderWidth: 1.5,
  },
  pressed: {
    opacity: 0.8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  type: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.gray[400],
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  balance: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
