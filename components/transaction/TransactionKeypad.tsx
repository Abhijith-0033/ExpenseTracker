import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Delete, Check } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';

export interface TransactionKeypadProps {
  onPress: (val: string) => void;
  onDelete: () => void;
  onClear: () => void;
  onEvaluate: () => void;
  onSubmit: () => void;
  typeColor: string;
  submitLabel?: string;
  disabled?: boolean;
  canSave: boolean;
  activeOperator?: string | null;
}

export const TransactionKeypad: React.FC<TransactionKeypadProps> = ({
  onPress,
  onDelete,
  onClear,
  onEvaluate,
  onSubmit,
  typeColor,
  submitLabel = 'Save',
  disabled = false,
  canSave,
  activeOperator,
}) => {
  const renderKey = (label: string, value: string, isOperator = false, isDanger = false) => {
    const isActiveOp = activeOperator === value;

    return (
      <Pressable
        key={value}
        onPress={() => onPress(value)}
        style={({ pressed }) => [
          styles.key,
          isOperator && [
            styles.operatorKey,
            { backgroundColor: typeColor + '1A' },
            isActiveOp && { backgroundColor: typeColor + '40', borderWidth: 1.5, borderColor: typeColor },
          ],
          isDanger && styles.dangerKey,
          pressed && styles.keyPressed,
        ]}
      >
        <Text
          style={[
            styles.keyText,
            isOperator && { color: typeColor, fontFamily: Typography.family.bold },
            isDanger && styles.dangerKeyText,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* 4x4 Grid */}
      <View style={styles.gridRow}>
        {renderKey('7', '7')}
        {renderKey('8', '8')}
        {renderKey('9', '9')}
        {renderKey('÷', '/', true)}
      </View>

      <View style={styles.gridRow}>
        {renderKey('4', '4')}
        {renderKey('5', '5')}
        {renderKey('6', '6')}
        {renderKey('×', '*', true)}
      </View>

      <View style={styles.gridRow}>
        {renderKey('1', '1')}
        {renderKey('2', '2')}
        {renderKey('3', '3')}
        {renderKey('-', '-', true)}
      </View>

      <View style={styles.gridRow}>
        {renderKey('.', '.')}
        {renderKey('0', '0')}
        <Pressable
          onPress={onClear}
          style={({ pressed }) => [styles.key, styles.dangerKey, pressed && styles.keyPressed]}
        >
          <Text style={[styles.keyText, styles.dangerKeyText]}>C</Text>
        </Pressable>
        {renderKey('+', '+', true)}
      </View>

      {/* Action Row */}
      <View style={styles.actionRow}>
        {/* Backspace */}
        <Pressable
          onPress={onDelete}
          onLongPress={onClear}
          style={({ pressed }) => [styles.actionBtn, styles.backspaceBtn, pressed && styles.keyPressed]}
        >
          <Delete size={20} color={Colors.gray[600]} />
        </Pressable>

        {/* Equals (=) */}
        <Pressable
          onPress={onEvaluate}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.equalsBtn,
            { borderColor: typeColor + '60' },
            pressed && styles.keyPressed,
          ]}
        >
          <Text style={[styles.equalsText, { color: typeColor }]}>=</Text>
        </Pressable>

        {/* Save Button */}
        <Pressable
          onPress={canSave && !disabled ? onSubmit : undefined}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: canSave ? typeColor : Colors.gray[300] },
            canSave && Layout.shadows.md,
            pressed && canSave && styles.keyPressed,
          ]}
          disabled={!canSave || disabled}
        >
          <Check size={18} color={Colors.white} />
          <Text style={styles.saveBtnText}>{submitLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 16,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 6,
  },
  key: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.gray[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorKey: {
    borderRadius: 14,
  },
  dangerKey: {
    backgroundColor: Colors.danger[50],
  },
  keyPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  keyText: {
    fontSize: 20,
    fontFamily: Typography.family.medium,
    color: Colors.gray[900],
  },
  dangerKeyText: {
    color: Colors.danger[600],
    fontFamily: Typography.family.bold,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    width: 52,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backspaceBtn: {
    backgroundColor: Colors.gray[100],
  },
  equalsBtn: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
  },
  equalsText: {
    fontSize: 22,
    fontFamily: Typography.family.bold,
  },
  saveBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: {
    color: Colors.white,
    fontFamily: Typography.family.bold,
    fontSize: Typography.size.md,
  },
});
