import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TouchableWithoutFeedback 
} from 'react-native';
import { Colors, Typography, Layout } from '../constants/Theme';
import { PressableScale } from './ui/PressableScale';
import { Repeat, X } from 'lucide-react-native';

interface RecurringBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  transaction: { 
    amount: number; 
    category: string; 
    subcategory: string; 
    account_id: number; 
    description: string 
  } | null;
  onSave: (frequency: 'monthly' | 'quarterly' | 'yearly' | 'custom') => void;
}

export const RecurringBottomSheet: React.FC<RecurringBottomSheetProps> = ({
  visible,
  onClose,
  transaction,
  onSave
}) => {
  const [selectedFreq, setSelectedFreq] = useState<'monthly' | 'quarterly' | 'yearly' | 'custom'>('monthly');

  if (!transaction) return null;

  const frequencies: { label: string; value: 'monthly' | 'quarterly' | 'yearly' | 'custom' }[] = [
    { label: 'Custom/Daily', value: 'custom' },
    { label: 'Quarterly', value: 'quarterly' },
    { label: 'Monthly', value: 'monthly' },
    { label: 'Yearly', value: 'yearly' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.content}>
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <View style={styles.iconContainer}>
                    <Repeat size={20} color={Colors.primary[600]} />
                  </View>
                  <Text style={styles.title}>Repeat Transaction</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={20} color={Colors.gray[400]} />
                </TouchableOpacity>
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>TRANSACTION</Text>
                <Text style={styles.infoValue} numberOfLines={1}>
                  {transaction.description || transaction.subcategory}
                </Text>
                <Text style={styles.infoAmount}>
                   ₹{transaction.amount.toLocaleString('en-IN')}
                </Text>
              </View>

              <Text style={styles.sectionLabel}>HOW OFTEN?</Text>
              <View style={styles.freqGrid}>
                {frequencies.map((freq) => (
                  <TouchableOpacity
                    key={freq.value}
                    style={[
                      styles.freqOption,
                      selectedFreq === freq.value && styles.freqOptionActive
                    ]}
                    onPress={() => setSelectedFreq(freq.value)}
                  >
                    <Text 
                      style={[
                        styles.freqText,
                        selectedFreq === freq.value && styles.freqTextActive
                      ]}
                    >
                      {freq.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <PressableScale 
                style={styles.saveBtn}
                onPress={() => onSave(selectedFreq)}
              >
                <Text style={styles.saveBtnText}>Set Recurring</Text>
              </PressableScale>
              
              <Text style={styles.helpText}>
                This will create a new subscription entry in your recurring payments tracker.
              </Text>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  closeBtn: {
    padding: 4,
  },
  infoCard: {
    backgroundColor: Colors.gray[50],
    padding: 16,
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.gray[100],
  },
  infoLabel: {
    fontSize: 10,
    fontFamily: Typography.family.bold,
    color: Colors.gray[400],
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[800],
    marginBottom: 2,
  },
  infoAmount: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.primary[600],
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: Typography.family.bold,
    color: Colors.gray[500],
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  freqGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 32,
  },
  freqOption: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.gray[50],
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  freqOptionActive: {
    backgroundColor: Colors.primary[50],
    borderColor: Colors.primary[300],
  },
  freqText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[600],
  },
  freqTextActive: {
    color: Colors.primary[700],
    fontFamily: Typography.family.bold,
  },
  saveBtn: {
    backgroundColor: Colors.primary[600],
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 16,
    ...Layout.shadows.md,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
  },
  helpText: {
    fontSize: 12,
    fontFamily: Typography.family.regular,
    color: Colors.gray[400],
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
