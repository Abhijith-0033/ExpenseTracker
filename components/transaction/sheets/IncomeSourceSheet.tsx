import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Check, DollarSign } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { Colors, Typography, Layout } from '../../../constants/Theme';

export interface IncomeSourceSheetProps {
  visible: boolean;
  onClose: () => void;
  sources: any[];
  selectedSource?: string;
  onSelect: (sourceName: string, icon?: string) => void;
  typeColor: string;
}

export const IncomeSourceSheet: React.FC<IncomeSourceSheetProps> = ({
  visible,
  onClose,
  sources,
  selectedSource,
  onSelect,
  typeColor,
}) => {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Select Income Source" heightPercent={50}>
      <FlatList
        data={sources}
        keyExtractor={(item) => item.id?.toString() || item.name}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isSelected = item.name === selectedSource;
          return (
            <Pressable
              onPress={() => {
                onSelect(item.name, item.icon);
                onClose();
              }}
              style={({ pressed }) => [
                styles.row,
                isSelected && [styles.selectedRow, { borderColor: typeColor, backgroundColor: typeColor + '0A' }],
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.iconCircle}>
                <Text style={styles.emoji}>{item.icon || '💰'}</Text>
              </View>

              <Text style={styles.name}>{item.name}</Text>

              {isSelected && (
                <View style={[styles.checkCircle, { backgroundColor: typeColor }]}>
                  <Check size={12} color={Colors.white} />
                </View>
              )}
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
  row: {
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emoji: {
    fontSize: 18,
  },
  name: {
    flex: 1,
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
