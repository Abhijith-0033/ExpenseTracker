import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';

// Subcomponents
import { TypeSelector, TransactionType } from './TypeSelector';
import { AmountDisplay } from './AmountDisplay';
import { AmountShortcuts } from './AmountShortcuts';
import { InlineAmountSuggestions } from './InlineAmountSuggestions';
import { RunningTotal } from './RunningTotal';
import { FieldChips } from './FieldChips';
import { FieldCompletionBar } from './FieldCompletionBar';
import { TransactionKeypad } from './TransactionKeypad';

// Sheets
import { DatePickerSheet } from './sheets/DatePickerSheet';
import { AccountPickerSheet } from './sheets/AccountPickerSheet';
import { NoteSheet } from './sheets/NoteSheet';
import { IncomeSourceSheet } from './sheets/IncomeSourceSheet';
import { SmartSuggestionsSheet } from './sheets/SmartSuggestionsSheet';
import { CategoryPicker } from '../CategoryPicker';
import { SuccessAnimation } from '../SuccessAnimation';
import { ConfirmActionSheet } from '../ConfirmActionSheet';

import { Colors, Typography, Layout } from '../../constants/Theme';

export interface TransactionFormProps {
  initialType: TransactionType;
  allowTypeSwitch?: boolean;

  // Data from parent
  accounts: any[];
  categories?: any[];
  incomeSources?: any[];

  // State
  display: string;
  setDisplay: (val: string | ((prev: string) => string)) => void;
  description: string;
  setDescription: (val: string) => void;
  selectedAccount?: any | null;
  setSelectedAccount?: (val: any) => void;
  fromAccount?: any | null;
  setFromAccount?: (val: any) => void;
  toAccount?: any | null;
  setToAccount?: (val: any) => void;
  category?: string;
  setCategory?: (val: string) => void;
  subcategory?: string;
  setSubcategory?: (val: string) => void;
  date: Date;
  setDate: (val: Date) => void;
  errors?: Record<string, string>;

  // Callbacks
  onSave: () => void;
  onClose: () => void;
  onTypeChange?: (type: TransactionType) => void;
  onCategorySelected?: (category: string, subcategory: string) => void;

  // Modals & Overlay state from parent
  isSubmitting?: boolean;
  showSuccess?: boolean;
  onSuccessFinish?: () => void;
  successMessage?: string;

  // Duplicate Warning State
  showDuplicateWarning?: boolean;
  duplicateTransaction?: any;
  onDuplicateCancel?: () => void;
  onDuplicateSaveAnyway?: () => void;

  // Income source
  selectedSourceIcon?: string;
  setSelectedSourceIcon?: (val: string) => void;
  incomeSubcategory?: string;
  setIncomeSubcategory?: (val: string | undefined) => void;
}

const TYPE_COLORS: Record<TransactionType, string> = {
  expense: Colors.danger[600] || '#E03131',
  income: Colors.success[600] || '#2F9E44',
  transfer: Colors.primary[600] || '#1C7ED6',
};

const SCREEN_TINT: Record<TransactionType, string> = {
  expense: 'rgba(224, 49, 49, 0.03)',
  income: 'rgba(47, 158, 68, 0.03)',
  transfer: 'rgba(28, 126, 214, 0.03)',
};

export const TransactionForm: React.FC<TransactionFormProps> = ({
  initialType,
  allowTypeSwitch = true,
  accounts,
  categories = [],
  incomeSources = [],
  display,
  setDisplay,
  description,
  setDescription,
  selectedAccount,
  setSelectedAccount,
  fromAccount,
  setFromAccount,
  toAccount,
  setToAccount,
  category = '',
  setCategory,
  subcategory = '',
  setSubcategory,
  date,
  setDate,
  errors = {},
  onSave,
  onClose,
  onTypeChange,
  onCategorySelected,
  isSubmitting = false,
  showSuccess = false,
  onSuccessFinish,
  successMessage = 'Transaction Saved!',
  showDuplicateWarning = false,
  duplicateTransaction,
  onDuplicateCancel,
  onDuplicateSaveAnyway,
  incomeSubcategory,
  setIncomeSubcategory,
}) => {
  const router = useRouter();
  const activeType = initialType;
  const typeColor = TYPE_COLORS[activeType];

  // Sheet Visibilities
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showFromAccountPicker, setShowFromAccountPicker] = useState(false);
  const [showToAccountPicker, setShowToAccountPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showNoteSheet, setShowNoteSheet] = useState(false);
  const [showIncomeSourceSheet, setShowIncomeSourceSheet] = useState(false);
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(false);

  // Expression evaluation state
  const [expressionText, setExpressionText] = useState('');
  const [activeOperator, setActiveOperator] = useState<string | null>(null);

  // -------------------------------------------------------------
  // Keypad Handlers
  // -------------------------------------------------------------
  const evaluateExpression = (val: string): number => {
    try {
      const sanitized = val.replace(/×/g, '*').replace(/÷/g, '/');
      const result = Function(`'use strict'; return (${sanitized})`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return Math.max(0, Math.round(result * 100) / 100);
      }
    } catch (_e) {}
    return 0;
  };

  const handleKeyPress = (val: string) => {
    if (['+', '-', '*', '/'].includes(val)) {
      setActiveOperator(val);
      setDisplay((prev) => {
        if (!prev || prev === '0') return prev;
        const lastChar = prev.slice(-1);
        if (['+', '-', '*', '/'].includes(lastChar)) {
          return prev.slice(0, -1) + val;
        }
        return prev + val;
      });
      return;
    }

    setDisplay((prev) => {
      if (prev === '0') return val;
      return prev + val;
    });

    if (activeOperator) {
      setExpressionText(display + val);
    }
  };

  const handleDelete = () => {
    setDisplay((prev) => {
      if (prev.length <= 1) return '0';
      const next = prev.slice(0, -1);
      if (!['+', '-', '*', '/'].some((op) => next.includes(op))) {
        setActiveOperator(null);
        setExpressionText('');
      }
      return next;
    });
  };

  const handleClear = () => {
    setDisplay('0');
    setActiveOperator(null);
    setExpressionText('');
  };

  const handleEvaluate = () => {
    if (['+', '-', '*', '/'].some((op) => display.includes(op))) {
      const evaluated = evaluateExpression(display);
      setDisplay(evaluated.toString());
      setActiveOperator(null);
      setExpressionText('');
    }
  };

  const handleSwapAccounts = React.useCallback(() => {
    if (setFromAccount && setToAccount) {
      const temp = fromAccount;
      setFromAccount(toAccount);
      setToAccount(temp);
    }
  }, [fromAccount, toAccount, setFromAccount, setToAccount]);

  // -------------------------------------------------------------
  // Validation / Completion Check
  // -------------------------------------------------------------
  const numericAmount = parseFloat(display);
  const isAmountValid = !isNaN(numericAmount) && numericAmount > 0;

  let filledCount = 0;
  let totalRequired = 3;

  if (activeType === 'expense') {
    totalRequired = 3;
    if (isAmountValid) filledCount++;
    if (selectedAccount) filledCount++;
    if (category) filledCount++;
  } else if (activeType === 'income') {
    totalRequired = 2;
    if (isAmountValid) filledCount++;
    if (selectedAccount) filledCount++;
  } else if (activeType === 'transfer') {
    totalRequired = 3;
    if (isAmountValid) filledCount++;
    if (fromAccount) filledCount++;
    if (toAccount) filledCount++;
  }

  const canSave = filledCount >= totalRequired;

  // -------------------------------------------------------------
  // Type Switch Handler
  // -------------------------------------------------------------
  const handleTypeChange = (newType: TransactionType) => {
    if (newType === activeType) return;
    if (onTypeChange) {
      onTypeChange(newType);
    } else {
      if (newType === 'expense') router.replace('/(tabs)/add');
      else if (newType === 'income') router.replace('/add-income');
      else if (newType === 'transfer') router.replace('/add-transfer');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: SCREEN_TINT[activeType] }]}>
      <View style={styles.container}>
        {/* Header Row */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <X size={22} color={Colors.gray[700]} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {activeType === 'expense' ? 'Add Expense' : activeType === 'income' ? 'Add Income' : 'Transfer Money'}
          </Text>
          <Pressable
            onPress={() => setShowSmartSuggestions(true)}
            style={styles.sparkleBtn}
            hitSlop={10}
          >
            <Sparkles size={20} color={typeColor} />
          </Pressable>
        </View>

        {/* Scrollable Context (Top Section) */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Type Selector */}
          <TypeSelector
            activeType={activeType}
            onTypeChange={handleTypeChange}
            typeColor={typeColor}
          />

          {/* Amount Display */}
          <AmountDisplay
            display={display}
            typeColor={typeColor}
            expressionText={expressionText}
            hasError={!!errors.amount}
            errorMessage={errors.amount}
          />

          {/* Amount Shortcuts (visible when amount === 0) */}
          <AmountShortcuts
            visible={display === '0'}
            onSelect={(val) => setDisplay(val)}
          />

          {/* Inline Amount Suggestions (visible when user enters amount) */}
          <InlineAmountSuggestions
            display={display}
            typeColor={typeColor}
            onApplySuggestion={(sug) => {
              setDisplay(sug.amount.toString());
              if (sug.category && setCategory) setCategory(sug.category);
              if (sug.subcategory && setSubcategory) setSubcategory(sug.subcategory);
              if (sug.accountId && accounts.length > 0) {
                const matchedAcc = accounts.find((a) => a.id === sug.accountId);
                if (matchedAcc && setSelectedAccount) setSelectedAccount(matchedAcc);
              }
              if (sug.description) setDescription(sug.description);
            }}
          />

          {/* Running Total */}
          <RunningTotal
            type={activeType}
            accountBalance={fromAccount?.balance ?? selectedAccount?.balance}
          />

          {/* Field Chips */}
          <FieldChips
            type={activeType}
            typeColor={typeColor}
            date={date}
            account={selectedAccount}
            fromAccount={fromAccount}
            toAccount={toAccount}
            category={category}
            subcategory={subcategory}
            description={description}
            incomeSource={subcategory}
            incomeSubcategory={incomeSubcategory}
            errors={errors}
            onDatePress={() => setShowDatePicker(true)}
            onAccountPress={() => setShowAccountPicker(true)}
            onFromAccountPress={() => setShowFromAccountPicker(true)}
            onToAccountPress={() => setShowToAccountPicker(true)}
            onSwapAccounts={handleSwapAccounts}
            onCategoryPress={() => setShowCategoryPicker(true)}
            onNotePress={() => setShowNoteSheet(true)}
            onIncomeSourcePress={() => setShowIncomeSourceSheet(true)}
          />

          {/* Progress / Completion Dots */}
          <FieldCompletionBar
            typeColor={typeColor}
            filledCount={filledCount}
            totalRequired={totalRequired}
          />
        </ScrollView>

        {/* Bottom Keypad */}
        <TransactionKeypad
          onPress={handleKeyPress}
          onDelete={handleDelete}
          onClear={handleClear}
          onEvaluate={handleEvaluate}
          onSubmit={() => {
            handleEvaluate();
            onSave();
          }}
          typeColor={typeColor}
          canSave={canSave}
          disabled={isSubmitting}
          activeOperator={activeOperator}
        />

        {/* ------------------------------------------------------------- */}
        {/* Sheets & Overlays */}
        {/* ------------------------------------------------------------- */}
        <DatePickerSheet
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          selectedDate={date}
          onSelectDate={setDate}
          typeColor={typeColor}
        />

        {/* Account Pickers */}
        {setSelectedAccount && (
          <AccountPickerSheet
            visible={showAccountPicker}
            onClose={() => setShowAccountPicker(false)}
            accounts={accounts}
            selectedAccountId={selectedAccount?.id}
            onSelect={setSelectedAccount}
            typeColor={typeColor}
          />
        )}

        {setFromAccount && (
          <AccountPickerSheet
            visible={showFromAccountPicker}
            onClose={() => setShowFromAccountPicker(false)}
            accounts={accounts}
            selectedAccountId={fromAccount?.id}
            onSelect={setFromAccount}
            title="Select From Account"
            excludeAccountId={toAccount?.id}
            typeColor={typeColor}
          />
        )}

        {setToAccount && (
          <AccountPickerSheet
            visible={showToAccountPicker}
            onClose={() => setShowToAccountPicker(false)}
            accounts={accounts}
            selectedAccountId={toAccount?.id}
            onSelect={setToAccount}
            title="Select To Account"
            excludeAccountId={fromAccount?.id}
            typeColor={typeColor}
          />
        )}

        {/* Category Picker (Expense) */}
        {setCategory && setSubcategory && (
          <CategoryPicker
            visible={showCategoryPicker}
            onClose={() => setShowCategoryPicker(false)}
            onSelect={(cat, sub) => {
              if (onCategorySelected) {
                onCategorySelected(cat, sub);
              } else {
                setCategory(cat);
                setSubcategory(sub);
              }
              setShowCategoryPicker(false);
            }}
            type="expense"
          />
        )}

        {/* Note Sheet */}
        <NoteSheet
          visible={showNoteSheet}
          onClose={() => setShowNoteSheet(false)}
          value={description}
          onSave={setDescription}
          typeColor={typeColor}
        />

        {/* Income Source Sheet */}
        {setSubcategory && (
          <IncomeSourceSheet
            visible={showIncomeSourceSheet}
            onClose={() => setShowIncomeSourceSheet(false)}
            sources={incomeSources}
            selectedSource={subcategory}
            selectedSubcategory={incomeSubcategory}
            onSelect={(srcName, subName) => {
              setSubcategory(srcName);
              if (setIncomeSubcategory) setIncomeSubcategory(subName);
              setShowIncomeSourceSheet(false);
            }}
            typeColor={typeColor}
          />
        )}

        {/* Smart Suggestions Sheet */}
        <SmartSuggestionsSheet
          visible={showSmartSuggestions}
          onClose={() => setShowSmartSuggestions(false)}
          typeColor={typeColor}
          onApplyAmount={(amt) => setDisplay(amt)}
          onApplySuggestion={(sug) => {
            setDisplay(sug.amount.toString());
            if (sug.category && setCategory) setCategory(sug.category);
            if (sug.subcategory && setSubcategory) setSubcategory(sug.subcategory);
            if (sug.accountId && accounts.length > 0) {
              const matchedAcc = accounts.find((a) => a.id === sug.accountId);
              if (matchedAcc && setSelectedAccount) setSelectedAccount(matchedAcc);
            }
            if (sug.description) setDescription(sug.description);
          }}
        />

        {/* Success Overlay */}
        <SuccessAnimation
          visible={showSuccess}
          onAnimationFinish={onSuccessFinish || (() => {})}
          message={successMessage}
        />

        {/* Duplicate Warning Sheet */}
        {showDuplicateWarning && onDuplicateCancel && onDuplicateSaveAnyway && (
          <ConfirmActionSheet
            visible={showDuplicateWarning}
            title="Duplicate Transaction?"
            description={`A transaction of ₹${display} was recently added. Save anyway?`}
            confirmLabel="Save Anyway"
            actionType="warning"
            onConfirm={onDuplicateSaveAnyway}
            onCancel={onDuplicateCancel}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: Colors.white,
    ...Layout.shadows.sm,
  },
  headerTitle: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  sparkleBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    ...Layout.shadows.sm,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
});
