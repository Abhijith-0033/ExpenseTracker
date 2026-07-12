import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Alert, ActivityIndicator, Modal 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, ChevronDown, Check } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { getDatabase } from '../../services/database';
import { addUpcomingBill, updateUpcomingBill, UpcomingBill } from '../../services/upcomingBills';
import { useSubscription } from '../../src/subscription/useSubscription';
import PaywallScreen from '../../src/subscription/PaywallScreen';
import { format, parseISO } from 'date-fns';
import { formatCurrency } from '../../utils/currency';
import { CategoryPicker } from '../../components/CategoryPicker';

const EMOJI_ICONS = ['📄', '🔌', '🏠', '🍔', '🚗', '✈️', '💻', '🛍️', '📦', '📶', '💸', '💡', '🏥', '🎓', '🛡️', '🍿'];
const THEME_COLORS = ['#2563EB', '#E11D48', '#059669', '#D97706', '#7C3AED', '#0BA5EC', '#14B8A6', '#8B5CF6', '#F43F5E', '#10B981'];

export default function AddEditUpcomingBill() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const editId = params.id ? parseInt(params.id as string) : null;

  const { isPremium, isTrialActive } = useSubscription();

  // Form State
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Bills');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState(new Date());
  const [recurrence, setRecurrence] = useState<'once' | 'weekly' | 'monthly' | 'yearly'>('once');
  const [icon, setIcon] = useState('📄');
  const [color, setColor] = useState('#2563EB');
  const [notes, setNotes] = useState('');

  // Meta State
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Picker Modals
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    loadMeta();
  }, []);

  // Hook rules require early returns below hooks
  if (!isPremium && !isTrialActive) {
    return <PaywallScreen showClose={true} />;
  }

  const loadMeta = async () => {
    try {
      const db = getDatabase();
      
      // Load accounts
      const accs = await db.getAllAsync('SELECT * FROM accounts');
      setAccounts(accs);
      
      // Load categories is no longer needed here as CategoryPicker uses AppContext categories
      if (editId) {
        const bill = await db.getFirstAsync<UpcomingBill>(
          'SELECT * FROM upcoming_bills WHERE id = ?',
          [editId]
        );
        if (bill) {
          setName(bill.name);
          setAmount(bill.amount.toString());
          setSelectedCategory(bill.category);
          setSelectedAccountId(bill.account_id);
          setDueDate(parseISO(bill.due_date));
          setRecurrence(bill.recurrence);
          setIcon(bill.icon);
          setColor(bill.color);
          setNotes(bill.notes || '');
        }
      } else {
        // Set default account
        if (accs.length > 0) {
          setSelectedAccountId(accs[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load form metadata:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name for the bill');
      return;
    }
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }
    if (!selectedAccountId) {
      Alert.alert('Error', 'Please select an account');
      return;
    }

    try {
      setSaving(true);
      const dateStr = dueDate.toISOString().split('T')[0];

      const payload = {
        name: name.trim(),
        amount: amtNum,
        category: selectedCategory,
        due_date: dateStr,
        recurrence,
        account_id: selectedAccountId,
        notes: notes.trim() || null,
        icon,
        color
      };

      if (editId) {
        await updateUpcomingBill(editId, payload);
      } else {
        await addUpcomingBill(payload);
      }

      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save upcoming bill.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  const activeAccount = accounts.find(a => a.id === selectedAccountId);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editId ? 'Edit Bill' : 'Add New Bill'}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formContainer}>
        {/* Name Input */}
        <Text style={styles.label}>Bill Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Electric Bill, Rent, Netflix"
          placeholderTextColor={Colors.gray[400]}
        />

        {/* Amount Input */}
        <Text style={styles.label}>Amount (INR)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="0.00"
          placeholderTextColor={Colors.gray[400]}
        />

        {/* Category Selector */}
        <Text style={styles.label}>Category</Text>
        <TouchableOpacity 
          style={styles.selectorBtn} 
          onPress={() => setShowCategoryPicker(true)}
        >
          <Text style={styles.selectorText}>{selectedCategory}</Text>
          <ChevronDown size={20} color={Colors.gray[500]} />
        </TouchableOpacity>

        {/* Account Selector */}
        <Text style={styles.label}>Pay From (Account)</Text>
        <TouchableOpacity 
          style={styles.selectorBtn} 
          onPress={() => setShowAccountModal(true)}
        >
          <Text style={styles.selectorText}>
            {activeAccount ? `${activeAccount.name} (Bal: ${activeAccount.balance})` : 'Select Account'}
          </Text>
          <ChevronDown size={20} color={Colors.gray[500]} />
        </TouchableOpacity>

        {/* Due Date Picker */}
        <Text style={styles.label}>Due Date</Text>
        <TouchableOpacity 
          style={styles.selectorBtn} 
          onPress={() => setShowDatePicker(true)}
        >
          <Calendar size={18} color={Colors.gray[500]} style={{ marginRight: 8 }} />
          <Text style={styles.selectorText}>{format(dueDate, 'MMMM dd, yyyy')}</Text>
          <ChevronDown size={20} color={Colors.gray[500]} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* Recurrence Selector */}
        <Text style={styles.label}>Recurrence</Text>
        <View style={styles.recurrenceContainer}>
          {(['once', 'weekly', 'monthly', 'yearly'] as const).map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.recurrenceOption, recurrence === r && styles.activeRecurrenceOption]}
              onPress={() => setRecurrence(r)}
            >
              <Text style={[styles.recurrenceText, recurrence === r && styles.activeRecurrenceText]}>
                {r.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Icon Emoji Picker */}
        <Text style={styles.label}>Choose Icon</Text>
        <View style={styles.emojiGrid}>
          {EMOJI_ICONS.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.emojiItem, icon === item && styles.activeEmojiItem]}
              onPress={() => setIcon(item)}
            >
              <Text style={{ fontSize: 22 }}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Theme Color Picker */}
        <Text style={styles.label}>Choose Accent Color</Text>
        <View style={styles.colorGrid}>
          {THEME_COLORS.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.colorItem, { backgroundColor: item }, color === item && styles.activeColorItem]}
              onPress={() => setColor(item)}
            >
              {color === item && <Check size={16} color="white" />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Notes */}
        <Text style={styles.label}>Notes (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add reminders, account numbers, or details..."
          placeholderTextColor={Colors.gray[400]}
          multiline
          numberOfLines={4}
        />

        {/* Save Button */}
        <TouchableOpacity 
          style={[styles.saveBtn, saving && { opacity: 0.7 }]} 
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.saveBtnText}>{editId ? 'Update Bill' : 'Create Bill'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <CategoryPicker
        visible={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        onSelect={(cat, sub) => {
          setSelectedCategory(sub ? `${cat} - ${sub}` : cat);
        }}
      />

      {/* Account Selection Modal */}
      <Modal visible={showAccountModal} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setShowAccountModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Payment Account</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {accounts.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={styles.modalOption}
                  onPress={() => {
                    setSelectedAccountId(a.id);
                    setShowAccountModal(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{a.name} (Bal: {formatCurrency(a.balance)})</Text>
                  {selectedAccountId === a.id && <Check size={18} color={Colors.primary[600]} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={dueDate}
          mode="date"
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) setDueDate(date);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    backgroundColor: Colors.white,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  formContainer: {
    padding: 20,
    paddingBottom: 60,
  },
  label: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
    color: Colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: Layout.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: Typography.size.md,
    fontFamily: Typography.family.medium,
    color: Colors.gray[900],
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: Layout.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectorText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.medium,
    color: Colors.gray[900],
  },
  recurrenceContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  recurrenceOption: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: Layout.radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activeRecurrenceOption: {
    borderColor: Colors.primary[500],
    backgroundColor: Colors.primary[50],
  },
  recurrenceText: {
    fontSize: 9,
    fontFamily: Typography.family.bold,
    color: Colors.gray[500],
  },
  activeRecurrenceText: {
    color: Colors.primary[600],
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  emojiItem: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  activeEmojiItem: {
    borderColor: Colors.primary[500],
    backgroundColor: Colors.primary[50],
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  colorItem: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeColorItem: {
    borderWidth: 2,
    borderColor: Colors.white,
    elevation: 3,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
  },
  saveBtn: {
    backgroundColor: Colors.primary[600],
    paddingVertical: 16,
    borderRadius: Layout.radius.lg,
    alignItems: 'center',
    marginTop: 32,
    ...Layout.shadows.md,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  modalOptionText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.medium,
    color: Colors.gray[800],
  },
});
