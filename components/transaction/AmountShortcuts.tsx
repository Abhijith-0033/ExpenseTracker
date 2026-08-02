import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, Typography } from '../../constants/Theme';

export interface AmountShortcutsProps {
  visible: boolean;
  onSelect: (amount: string) => void;
}

const SHORTCUTS = [
  { label: '₹50', value: '50' },
  { label: '₹100', value: '100' },
  { label: '₹200', value: '200' },
  { label: '₹500', value: '500' },
  { label: '₹1k', value: '1000' },
];

export const AmountShortcuts: React.FC<AmountShortcutsProps> = ({
  visible,
  onSelect,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      {SHORTCUTS.map((item) => (
        <Pressable
          key={item.value}
          onPress={() => onSelect(item.value)}
          style={({ pressed }) => [
            styles.chip,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.chipText}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.gray[100],
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  pressed: {
    opacity: 0.7,
    backgroundColor: Colors.gray[200],
  },
  chipText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
    color: Colors.gray[600],
  },
});
