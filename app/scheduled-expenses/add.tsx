import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert, ActivityIndicator, Modal, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Clock, ChevronDown, Check, Tag } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { getDatabase, getScheduledExpenseById, insertScheduledExpense, updateScheduledExpense } from '../../services/database';
import { useSubscription } from '../../src/subscription/useSubscription';
import PaywallScreen from '../../src/subscription/PaywallScreen';
import { scheduleNotificationsForExpense, cancelNotificationsForExpense } from '../../src/scheduled/ScheduledExpenseEngine';
import DateTimePicker from '@react-native-community/datetimepicker';

const DAYS_OF_WEEK = [
  { label: 'S', value: 1, name: 'Sunday' },
  { label: 'M', value: 2, name: 'Monday' },
  { label: 'T', value: 3, name: 'Tuesday' },
  { label: 'W', value: 4, name: 'Wednesday' },
  { label: 'T', value: 5, name: 'Thursday' },
  { label: 'F', value: 6, name: 'Friday' },
  { label: 'S', value: 7, name: 'Saturday' },
];

export default function AddEditScheduledExpense() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const editId = params.id ? parseInt(params.id as string) : null;

  const { isPremium, isTrialActive } = useSubscription();

  // Form State
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [time, setTime] = useState(new Date());
  const [autoCreate, setAutoCreate] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Meta State
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    loadMeta();
  }, []);

  if (!isPremium && !isTrialActive) {
    return <PaywallScreen showClose={true} />;
  }
  const isFreeUser = !isPremium && !isTrialActive;

  const loadMeta = async () => {
    try {
      const db = getDatabase();
      const accs = await db.getAllAsync('SELECT * FROM accounts');
      setAccounts(accs);
      
      const cats = await db.getAllAsync("SELECT * FROM categories WHERE name NOT IN ('Transfer')");
      setCategories(cats);

      const subCats = await db.getAllAsync('SELECT * FROM category_subcategories');
      setSubcategories(subCats);

      if (editId) {
        const item = await getScheduledExpenseById(editId);
        if (item) {
          setName(item.name);
          setAmount(item.amount.toString());
          setSelectedCategoryId(item.category_id);
          setSelectedSubcategoryId(item.subcategory_id ?? null);
          setSelectedAccountId(item.account_id);
          setDescription(item.description || '');
          setAutoCreate(item.auto_create === 1);
          setIsActive(item.is_active === 1);

          try {
            setSelectedDays(JSON.parse(item.days_of_week));
          } catch {
            setSelectedDays([]);
          }

          const [h, m] = item.scheduled_time.split(':').map(Number);
          const tDate = new Date();
          tDate.setHours(h);
          tDate.setMinutes(m);
          setTime(tDate);
        }
      } else {
        // Defaults
        if (accs.length > 0) {
          setSelectedAccountId(accs[0].id); // Free user default cash / first account
        }
      }
    } catch (e) {
      console.error('Failed to load metadata:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (val: number) => {
    if (selectedDays.includes(val)) {
      setSelectedDays(selectedDays.filter(d => d !== val));
    } else {
      setSelectedDays([...selectedDays, val].sort());
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name for the schedule');
      return;
    }
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!selectedCategoryId) {
      Alert.alert('Error', 'Please select a category');
      return;
    }
    if (!selectedAccountId) {
      Alert.alert('Error', 'Please select an account');
      return;
    }
    if (selectedDays.length === 0) {
      Alert.alert('Error', 'Please select at least one day of the week');
      return;
    }

    setSaving(true);
    const hour = time.getHours().toString().padStart(2, '0');
    const minute = time.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hour}:${minute}`;

    const payload = {
      name,
      amount: amtNum,
      category_id: selectedCategoryId,
      subcategory_id: selectedSubcategoryId,
      account_id: selectedAccountId,
      description: description || null,
      days_of_week: JSON.stringify(selectedDays),
      scheduled_time: timeStr,
      auto_create: autoCreate ? 1 : 0,
      is_active: isActive ? 1 : 0,
    };

    try {
      if (editId) {
        await updateScheduledExpense(editId, payload);
        const itemJoined = { id: editId, ...payload } as any;
        if (isActive) {
          await scheduleNotificationsForExpense(itemJoined);
        } else {
          await cancelNotificationsForExpense(editId);
        }
      } else {
        const newId = await insertScheduledExpense(payload);
        const itemJoined = { id: newId, ...payload } as any;
        if (isActive) {
          await scheduleNotificationsForExpense(itemJoined);
        }
      }
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save scheduled expense');
    } finally {
      setSaving(false);
    }
  };

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const selectedSubcategory = subcategories.find(s => s.id === selectedSubcategoryId);
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);



  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editId ? 'Edit Schedule' : 'New Schedule'}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Name input */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Broadband Bill"
            value={name}
            onChangeText={setName}
            placeholderTextColor={Colors.gray[400]}
          />
        </View>

        {/* Amount input */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Amount (₹) *</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            placeholderTextColor={Colors.gray[400]}
          />
        </View>

        {/* Category Picker */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Category & Subcategory *</Text>
          <TouchableOpacity style={styles.pickerTrigger} onPress={() => setShowCategoryModal(true)}>
            <Tag size={18} color={Colors.gray[400]} style={{ marginRight: 12 }} />
            <Text style={[styles.pickerText, !selectedCategory && { color: Colors.gray[400] }]}>
              {selectedCategory ? `${selectedCategory.name}${selectedSubcategory ? ` / ${selectedSubcategory.name}` : ''}` : 'Select Category'}
            </Text>
            <ChevronDown size={18} color={Colors.gray[400]} />
          </TouchableOpacity>
        </View>

        {/* Account Picker */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Account *</Text>
          <TouchableOpacity 
            style={[styles.pickerTrigger, isFreeUser && styles.disabledPicker]} 
            onPress={() => !isFreeUser && setShowAccountModal(true)}
            disabled={isFreeUser}
          >
            <View style={[styles.pickerIconContainer, isFreeUser && { opacity: 0.5 }]}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary[500] }} />
            </View>
            <Text style={[styles.pickerText, isFreeUser && { color: Colors.gray[500] }]}>
              {selectedAccount ? selectedAccount.name : 'Select Account'}
            </Text>
            {!isFreeUser && <ChevronDown size={18} color={Colors.gray[400]} />}
          </TouchableOpacity>
          {isFreeUser && (
            <Text style={styles.freeUserWarning}>Free accounts are locked to the default account. Upgrade to Premium for multi-account management.</Text>
          )}
        </View>

        {/* Schedule Days */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Repeats On (Days of Week) *</Text>
          <View style={styles.daysContainer}>
            {DAYS_OF_WEEK.map(day => {
              const active = selectedDays.includes(day.value);
              return (
                <TouchableOpacity
                  key={day.value}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                  onPress={() => toggleDay(day.value)}
                >
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{day.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Time Picker */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Scheduled Time *</Text>
          <TouchableOpacity style={styles.pickerTrigger} onPress={() => setShowTimePicker(true)}>
            <Clock size={18} color={Colors.gray[400]} style={{ marginRight: 12 }} />
            <Text style={styles.pickerText}>
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <ChevronDown size={18} color={Colors.gray[400]} />
          </TouchableOpacity>
        </View>

        {/* Description */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Add notes..."
            multiline
            value={description}
            onChangeText={setDescription}
            placeholderTextColor={Colors.gray[400]}
          />
        </View>

        {/* Auto Create toggle */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.toggleTitle}>Auto-Create Transaction</Text>
            </View>
            <Text style={styles.toggleDesc}>{"If enabled, transactions are created automatically. If disabled, you'll receive a push notification to approve/reject."}</Text>
          </View>
          <Switch
            value={autoCreate}
            onValueChange={setAutoCreate}
            trackColor={{ false: Colors.gray[200], true: Colors.primary[500] }}
            thumbColor={Colors.white}
          />
        </View>

        {/* Save button */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>{editId ? 'Save Changes' : 'Create Schedule'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Date/Time Picker Modal */}
      {showTimePicker && (
        <DateTimePicker
          value={time}
          mode="time"
          display="default"
          onChange={(event, selectedDate) => {
            setShowTimePicker(false);
            if (selectedDate) setTime(selectedDate);
          }}
        />
      )}

      {/* Account Modal */}
      <Modal visible={showAccountModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Account</Text>
              <TouchableOpacity onPress={() => setShowAccountModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {accounts.map(acc => (
                <TouchableOpacity
                  key={acc.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedAccountId(acc.id);
                    setShowAccountModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, selectedAccountId === acc.id && { fontFamily: Typography.family.bold, color: Colors.primary[600] }]}>
                    {acc.name} ({acc.type})
                  </Text>
                  {selectedAccountId === acc.id && <Check size={18} color={Colors.primary[600]} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Category Picker Modal */}
      <Modal visible={showCategoryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {categories.map(cat => {
                const subCats = subcategories.filter(s => s.category_id === cat.id);
                return (
                  <View key={cat.id} style={styles.categoryGroup}>
                    <TouchableOpacity
                      style={styles.categoryHeader}
                      onPress={() => {
                        setSelectedCategoryId(cat.id);
                        setSelectedSubcategoryId(null);
                        setShowCategoryModal(false);
                      }}
                    >
                      <Text style={[styles.categoryHeaderPrefix]}>📦</Text>
                      <Text style={[styles.categoryHeaderText, selectedCategoryId === cat.id && { fontFamily: Typography.family.bold, color: Colors.primary[600] }]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.subCategoryList}>
                      {subCats.map(sub => (
                        <TouchableOpacity
                          key={sub.id}
                          style={styles.subcategoryItem}
                          onPress={() => {
                            setSelectedCategoryId(cat.id);
                            setSelectedSubcategoryId(sub.id);
                            setShowCategoryModal(false);
                          }}
                        >
                          <Text style={[styles.subcategoryItemText, selectedSubcategoryId === sub.id && { fontFamily: Typography.family.bold, color: Colors.primary[600] }]}>
                            {sub.name}
                          </Text>
                          {selectedSubcategoryId === sub.id && <Check size={14} color={Colors.primary[600]} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.gray[50] },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    ...Layout.shadows.sm
  },
  backBtn: { 
    padding: 10, 
    backgroundColor: Colors.white, 
    borderRadius: 12,
    ...Layout.shadows.sm
  },
  headerTitle: { fontSize: 20, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  scrollContent: { padding: 20, paddingBottom: 100 },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontFamily: Typography.family.bold, color: Colors.gray[700], marginBottom: 8 },
  input: { 
    backgroundColor: Colors.white, 
    borderRadius: 16, 
    paddingHorizontal: 16, 
    height: 56,
    fontSize: 16, 
    fontFamily: Typography.family.medium, 
    color: Colors.gray[900],
    borderWidth: 1,
    borderColor: Colors.gray[200],
    ...Layout.shadows.sm
  },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    ...Layout.shadows.sm
  },
  disabledPicker: {
    backgroundColor: Colors.gray[100],
    borderColor: Colors.gray[200]
  },
  pickerText: {
    flex: 1,
    fontSize: 16,
    fontFamily: Typography.family.medium,
    color: Colors.gray[900]
  },
  pickerIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  freeUserWarning: {
    fontSize: 11,
    color: Colors.primary[600],
    fontFamily: Typography.family.medium,
    marginTop: 6,
    lineHeight: 16
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4
  },
  dayChip: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
    ...Layout.shadows.sm
  },
  dayChipActive: {
    backgroundColor: Colors.primary[500],
    borderColor: Colors.primary[500]
  },
  dayChipText: {
    fontSize: 14,
    fontFamily: Typography.family.bold,
    color: Colors.gray[600]
  },
  dayChipTextActive: {
    color: Colors.white
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.gray[200],
    marginBottom: 32
  },
  toggleTitle: {
    fontSize: 15,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 4
  },
  toggleDesc: {
    fontSize: 12,
    color: Colors.gray[400],
    lineHeight: 18,
    fontFamily: Typography.family.regular
  },
  saveBtn: {
    backgroundColor: Colors.primary[500],
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...Layout.shadows.md
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: Typography.family.bold
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: Dimensions.get('window').height * 0.8
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900]
  },
  modalCloseText: {
    fontSize: 20,
    color: Colors.gray[400],
    padding: 4
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100]
  },
  modalItemText: {
    fontSize: 16,
    fontFamily: Typography.family.medium,
    color: Colors.gray[800]
  },
  categoryGroup: {
    marginBottom: 16
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8
  },
  categoryHeaderPrefix: {
    fontSize: 18,
    marginRight: 10
  },
  categoryHeaderText: {
    fontSize: 16,
    fontFamily: Typography.family.bold,
    color: Colors.gray[800]
  },
  subCategoryList: {
    paddingLeft: 28,
    marginTop: 4
  },
  subcategoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[50]
  },
  subcategoryItemText: {
    fontSize: 14,
    fontFamily: Typography.family.medium,
    color: Colors.gray[600]
  }
});
