import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TextInput, Pressable } from 'react-native';
import { Colors, Layout, Typography } from '../constants/Theme';
import { Keypad } from './ui/Keypad';
import { X, ChevronDown } from 'lucide-react-native';
import { getDatabase, initDatabase } from '../services/database';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { BookItem } from '../services/books';

const COMMON_SECTIONS = ['Travel', 'Hotel', 'Food', 'Shopping', 'Transport', 'Activities', 'Misc'];

interface AddEntrySheetProps {
  visible: boolean;
  bookId: number;
  bookColor: string;
  existingSections: string[];
  editingItem?: BookItem | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

export function AddEntrySheet({ visible, bookId, bookColor, existingSections, editingItem, onSave, onClose }: AddEntrySheetProps) {
  const [sectionName, setSectionName] = useState('');
  const [description, setDescription] = useState('');
  const [amountDisplay, setAmountDisplay] = useState('0');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadAccounts();
    setErrorMsg('');
    if (editingItem) {
      setSectionName(editingItem.section_name || '');
      setDescription(editingItem.name);
      setAmountDisplay(editingItem.amount.toString());
      setSelectedAccountId(editingItem.account_id ?? null);
      setNotes(editingItem.notes || '');
      setDate(new Date(editingItem.date));
    } else {
      resetForm();
    }
  }, [editingItem, visible]);

  const loadAccounts = async () => {
    await initDatabase();
    const db = getDatabase();
    const accs = await db.getAllAsync<any>('SELECT * FROM accounts WHERE type != ? ORDER BY balance DESC', ['meta_categories']);
    setAccounts(accs);
    if (accs.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accs[0].id);
    }
  };

  const resetForm = () => {
    setSectionName('');
    setDescription('');
    setAmountDisplay('0');
    setNotes('');
    setDate(new Date());
    setErrorMsg('');
  };

  const sectionSuggestions = Array.from(new Set([
    ...existingSections,
    ...COMMON_SECTIONS.filter(s => !existingSections.includes(s)),
  ])).slice(0, 8);

  const handleSave = async () => {
    const amount = parseFloat(amountDisplay);
    if (!amount || amount <= 0) {
      setErrorMsg('Please enter a valid amount');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Description is mandatory. Please describe this expense.');
      return;
    }
    setErrorMsg('');
    setSaving(true);
    try {
      await onSave({
        name: description.trim(),
        amount,
        section_name: sectionName.trim() || null,
        account_id: selectedAccountId,
        notes,
        date: date.getTime(),
      });
      resetForm();
      onClose();
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyPress = (val: string) => {
    setAmountDisplay(prev => {
      if (val === '.') return prev.includes('.') ? prev : prev + '.';
      return prev === '0' ? val : prev + val;
    });
  };

  const handleDelete = () => {
    setAmountDisplay(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
  };

  const handleClear = () => setAmountDisplay('0');

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{editingItem ? 'Edit Entry' : 'Add Entry'}</Text>
            <Pressable onPress={onClose} hitSlop={10}><X size={24} color={Colors.gray[500]} /></Pressable>
          </View>

          {errorMsg ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠️ {errorMsg}</Text>
            </View>
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: 380 }}>
            {/* Section Name with autocomplete */}
            <Text style={styles.label}>Section</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Travel, Hotel, Food..."
              value={sectionName}
              onChangeText={setSectionName}
              placeholderTextColor={Colors.gray[400]}
            />
            {/* Section suggestion chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, paddingHorizontal: 20 }}>
              {sectionSuggestions.map(s => (
                <Pressable key={s} style={[styles.suggestionChip, sectionName === s && { backgroundColor: bookColor }]} onPress={() => setSectionName(s)}>
                  <Text style={[styles.suggestionChipText, sectionName === s && { color: 'white' }]}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Description */}
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Cab to airport, Hotel night 1..."
              value={description}
              onChangeText={setDescription}
              placeholderTextColor={Colors.gray[400]}
            />

            {/* Amount Display */}
            <Text style={styles.label}>Amount *</Text>
            <View style={styles.amountDisplay}>
              <Text style={styles.amountCurrency}>₹</Text>
              <Text style={styles.amountValue}>{amountDisplay}</Text>
            </View>

            {/* Account Picker */}
            <Text style={styles.label}>Account</Text>
            <Pressable style={styles.pickerBtn} onPress={() => setShowAccountPicker(!showAccountPicker)}>
              <Text style={styles.pickerText}>
                {accounts.find(a => a.id === selectedAccountId)?.name ?? 'Select Account'}
              </Text>
              <ChevronDown size={16} color={Colors.gray[400]} />
            </Pressable>
            {showAccountPicker && accounts.map(acc => (
              <Pressable key={acc.id} style={styles.pickerOption}
                onPress={() => { setSelectedAccountId(acc.id); setShowAccountPicker(false); }}>
                <Text style={styles.pickerOptionText}>{acc.name} — ₹{acc.balance.toLocaleString()}</Text>
              </Pressable>
            ))}

            {/* Date */}
            <Text style={styles.label}>Date</Text>
            <Pressable style={styles.pickerBtn} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.pickerText}>{format(date, 'dd MMM yyyy')}</Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker value={date} mode="date" display="default"
                onChange={(_, d) => { setShowDatePicker(false); if (d) setDate(d); }} />
            )}

            {/* Notes */}
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, { height: 60 }]}
              placeholder="Any additional details..."
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholderTextColor={Colors.gray[400]}
            />
          </ScrollView>

          {/* NumPad */}
          <Keypad
            onPress={handleKeyPress}
            onDelete={handleDelete}
            onClear={handleClear}
            onSubmit={handleSave}
            disabled={saving}
            submitColor={bookColor || Colors.primary[600]}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.gray[100], marginBottom: 8 },
  sheetTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  errorBanner: { marginHorizontal: 20, marginBottom: 12, padding: 12, backgroundColor: Colors.danger[50], borderRadius: Layout.radius.lg, borderWidth: 1, borderColor: Colors.danger[200] },
  errorBannerText: { color: Colors.danger[700], fontSize: Typography.size.sm, fontFamily: Typography.family.bold },
  label: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.gray[700], marginBottom: 6, paddingHorizontal: 20 },
  input: {
    marginHorizontal: 20, backgroundColor: Colors.gray[50],
    padding: 14, borderRadius: Layout.radius.lg, marginBottom: 12,
    fontSize: Typography.size.md, fontFamily: Typography.family.medium,
    borderWidth: 1, borderColor: Colors.gray[200],
    color: Colors.gray[900],
  },
  suggestionChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Layout.radius.full,
    backgroundColor: Colors.gray[100], marginRight: 8,
  },
  suggestionChipText: { fontSize: Typography.size.sm, fontFamily: Typography.family.medium, color: Colors.gray[600] },
  amountDisplay: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: Colors.gray[50], borderRadius: Layout.radius.lg,
    padding: 14, borderWidth: 1, borderColor: Colors.gray[200],
  },
  amountCurrency: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[400], marginRight: 4 },
  amountValue: { fontSize: Typography.size.xxl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  pickerBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 12, backgroundColor: Colors.gray[50],
    padding: 14, borderRadius: Layout.radius.lg, borderWidth: 1, borderColor: Colors.gray[200],
  },
  pickerText: { fontSize: Typography.size.md, fontFamily: Typography.family.medium, color: Colors.gray[800] },
  pickerOption: {
    marginHorizontal: 20, padding: 12, backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
  },
  pickerOptionText: { fontSize: Typography.size.sm, fontFamily: Typography.family.medium, color: Colors.gray[700] },
});
