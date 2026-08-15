
import React, { useState, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { TabErrorFallback } from '../../components/ErrorBoundary';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, StatusBar, ScrollView, Dimensions, Modal, DeviceEventEmitter, ActivityIndicator, InteractionManager } from 'react-native';
import { useFocusEffect, useRouter , useLocalSearchParams } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { addTransaction, addRechargeMeta, CategoryNode } from '../../services/database';
import { Clock, Calendar as CalendarIcon, Wallet as WalletIcon, Tag as TagIcon, X, ChevronDown, CheckCircle2 , Sparkles } from 'lucide-react-native';
import { format, addDays } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Colors, Layout, Typography } from '../../constants/Theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Keypad } from '../../components/ui/Keypad';
import { CategoryPicker } from '../../components/CategoryPicker';
import { PressableScale } from '../../components/ui/PressableScale';
import { LinearGradient } from 'expo-linear-gradient';
import { SuccessAnimation } from '../../components/SuccessAnimation';
import { parseBankSMS } from '../../services/smsParser';
import { playIncomeSound, playExpenseSound } from '../../services/SoundService';
import { addSubscription } from '../../services/subscriptions';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { checkDuplicate, getSmartSuggestions, getLastUsedForCategory, SmartSuggestion } from '../../services/duplicateCheck';
import { DuplicateWarningSheet } from '../../components/DuplicateWarningSheet';
import { useSubscription } from '../../src/subscription/useSubscription';
import { safeBack } from '../../utils/navigation';
import { TransactionForm } from '../../components/transaction/TransactionForm';



function AddTransactionContent() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { accounts, refreshData, soundEnabled, categories } = useApp();
    const { isPremium, isTrialActive } = useSubscription();
    const isFreeUser = !isPremium && !isTrialActive;

    const [display, setDisplay] = useState('0');
    const [description, setDescription] = useState('');
    const [selectedAccount, setSelectedAccount] = useState<any>(null);
    const [category, setCategory] = useState('');
    const [subcategory, setSubcategory] = useState('');
    const [date, setDate] = useState(new Date());

    // Duplicate Guard State
    const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
    const [duplicateTransaction, setDuplicateTransaction] = useState<any>(null);
    const pendingSaveDataRef = React.useRef<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = React.useRef(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Recharge Specific State
    const [isRecharge, setIsRecharge] = useState(false);
    const [validity, setValidity] = useState(28);
    const [customValidity, setCustomValidity] = useState('');

    const [_showValidityPicker, _setShowValidityPicker] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showSMSModal, setShowSMSModal] = useState(false);
    const [smsText, setSmsText] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
    const [lastUsedHint, setLastUsedHint] = useState<string>('');

    const [initializing, setInitializing] = useState(true);
    useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => {
            setInitializing(false);
        });
        return () => task.cancel();
    }, []);

    // Initial Account Setup
    useEffect(() => {
        if (accounts.length > 0 && !selectedAccount) {
            if (isFreeUser) {
                setSelectedAccount(accounts[0]);
            } else {
                setSelectedAccount(null); // Explicit text "Select Account"
            }
        }
    }, [accounts, selectedAccount, isFreeUser]);

    // Smart Suggestions for Amount
    useEffect(() => {
        const fetchSuggestions = async () => {
            const parsed = evaluateExpression(display);
            if (parsed > 0) {
                const suggs = await getSmartSuggestions(parsed);
                setSuggestions(suggs);
            } else {
                setSuggestions([]);
            }
        };
        fetchSuggestions();
    }, [display]);

    // Last Used Hint for Category
    useEffect(() => {
        const fetchLastUsed = async () => {
            if (category) {
                const lastUsed = await getLastUsedForCategory(category);
                if (lastUsed) {
                    setLastUsedHint(`Last used: ${lastUsed.subcategory || 'General'} • ${lastUsed.accountName}`);
                    
                    if (lastUsed.subcategory) {
                        setSubcategory(lastUsed.subcategory);
                    }
                    const matchedAccount = accounts.find(a => a.id === lastUsed.accountId);
                    if (matchedAccount) {
                        setSelectedAccount(matchedAccount);
                    }
                } else {
                    setLastUsedHint('');
                }
            } else {
                setLastUsedHint('');
            }
        };
        fetchLastUsed();
    }, [category, accounts]);

    // Extract primitive params to avoid re-renders due to object reference changes
    const prefill_amount = params.prefill_amount as string;
    const prefill_description = params.prefill_description as string;
    const prefill_category = params.prefill_category as string;
    const prefill_account_id = params.prefill_account_id as string;
    const from_notification = params.from_notification as string;
    const sched_log_id = params.sched_log_id as string;

    // Handle Prefill from Notifications
    useEffect(() => {
        if (prefill_amount) setDisplay(prefill_amount);
        if (prefill_description) setDescription(prefill_description);
        if (prefill_category) {
            setCategory(prefill_category);
            
            if (categories.length > 0) {
                const catData = categories.find((c: CategoryNode) => c.name === prefill_category);
                if (catData?.is_recurring) {
                    setIsRecharge(true);
                    setValidity(catData.default_validity || 28);
                }
            }
        }
        if (prefill_account_id && accounts.length > 0) {
            const acc = accounts.find(a => a.id.toString() === prefill_account_id);
            // Only update if it's different to prevent infinite loops
            if (acc && (!selectedAccount || selectedAccount.id !== acc.id)) {
                setSelectedAccount(acc);
            }
        }
    }, [prefill_amount, prefill_description, prefill_category, prefill_account_id, accounts, categories, selectedAccount]);

    // Handle Prefill from Scheduled Expenses log
    useEffect(() => {
        const fetchScheduledLog = async () => {
            if (sched_log_id) {
                try {
                    const { getDatabase } = await import('../../services/database');
                    const db = getDatabase();
                    const log = await db.getFirstAsync<any>(
                        'SELECT * FROM scheduled_expense_log WHERE id = ?', [parseInt(sched_log_id)]
                    );
                    if (log) {
                        setDisplay(log.amount.toString());
                        const se = await db.getFirstAsync<any>(`
                            SELECT se.*, c.name as category_name, cs.name as subcategory_name
                            FROM scheduled_expenses se
                            LEFT JOIN categories c ON se.category_id = c.id
                            LEFT JOIN category_subcategories cs ON se.subcategory_id = cs.id
                            WHERE se.id = ?
                        `, [log.scheduled_expense_id]);
                        
                        if (se) {
                            setDescription(se.description || se.name);
                            setCategory(se.category_name);
                            if (se.subcategory_name) setSubcategory(se.subcategory_name);
                            
                            const matchedAccount = accounts.find(a => a.id === se.account_id);
                            if (matchedAccount) {
                                setSelectedAccount(matchedAccount);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error pre-filling scheduled log:', e);
                }
            }
        };
        fetchScheduledLog();
    }, [sched_log_id, accounts]);

    // Reset Form on Focus (but skip if params are present)
    useFocusEffect(
        React.useCallback(() => {
            if (prefill_amount || from_notification) return;
            
            // Reset all state to default
            setDisplay('0');
            setDescription('');
            setCategory('');
            setSubcategory('');
            setDate(new Date());
            setSelectedAccount(null); // Force user to re-select
            setShowCategoryPicker(false);
            setShowDatePicker(false);
            setIsRecharge(false);
            setValidity(28);
            setCustomValidity('');
            setShowSuccess(false);
        }, [prefill_amount, from_notification])
    );

    const evaluateExpression = (expr: string): number => {
        const safe = expr.replace(/[^0-9+\-*/.]/g, '');
        if (!safe) return 0;

        // Tokenize into numbers and operators
        const tokens = safe.match(/(\d+\.?\d*)|([-+*/])/g);
        if (!tokens) return parseFloat(safe) || 0;

        // Parse and evaluate with operator precedence: * and / first, then + and -
        const values: number[] = [];
        const ops: string[] = [];

        let i = 0;
        let currentNum = parseFloat(tokens[i]);
        if (isNaN(currentNum)) currentNum = 0;
        values.push(currentNum);
        i++;

        while (i < tokens.length) {
            const op = tokens[i];
            const nextValStr = tokens[i + 1];
            let nextVal = nextValStr ? parseFloat(nextValStr) : NaN;
            if (isNaN(nextVal)) nextVal = 0;

            if (op === '*' || op === '/') {
                const prevVal = values.pop() ?? 0;
                if (op === '*') {
                    values.push(prevVal * nextVal);
                } else {
                    values.push(nextVal !== 0 ? prevVal / nextVal : 0);
                }
            } else {
                ops.push(op);
                values.push(nextVal);
            }
            i += 2;
        }

        // Second pass: handle + and -
        let result = values[0] ?? 0;
        for (let j = 0; j < ops.length; j++) {
            const op = ops[j];
            const val = values[j + 1] ?? 0;
            if (op === '+') {
                result += val;
            } else if (op === '-') {
                result -= val;
            }
        }

        return isFinite(result) ? result : 0;
    };

    const handleKeyPress = (val: string) => {
        const operators = ['+', '-', '*', '/'];
        if (val === '.') {
            const segments = display.split(/[+\-*/]/);
            const lastSeg = segments[segments.length - 1];
            if (!lastSeg.includes('.')) setDisplay(prev => prev + val);
        } else if (operators.includes(val)) {
            setDisplay(prev => {
                const trimmed = prev.replace(/[+\-*/]+$/, '');
                return trimmed + val;
            });
        } else {
            setDisplay(prev => (prev === '0' ? val : prev + val));
        }
    };

    const handleDescriptionChange = (text: string) => {
        setDescription(text);
    };

    const handleDelete = () => {
        setDisplay(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    };

    const handleClear = () => setDisplay('0');

    const handleEvaluate = () => {
        setDisplay(evaluateExpression(display).toString());
    };

    const handleSave = async () => {
        let finalAmount = evaluateExpression(display);
        const newErrors: Record<string, string> = {};

        if (!finalAmount || finalAmount <= 0) {
            newErrors.amount = 'Please enter a valid amount';
        }
        if (!category) {
            newErrors.category = 'Please select a category';
        }
        if (!selectedAccount) {
            newErrors.account = 'Please select an account';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setErrors({});

        if (isSubmittingRef.current) return;

        const duplicate = await checkDuplicate(finalAmount, category, date.toISOString(), 'expense');
        if (duplicate) {
            setDuplicateTransaction(duplicate);
            setShowDuplicateWarning(true);
            pendingSaveDataRef.current = finalAmount;
            return;
        }

        await executeSave(finalAmount);
    };

    const executeSave = async (finalAmount: number) => {
        try {
            setIsSubmitting(true);
            isSubmittingRef.current = true;

            const txId = await addTransaction({
                amount: finalAmount,
                category,
                subcategory,
                account_id: selectedAccount.id,
                date: date.toISOString(),
                description
            });

            // Handle Recharge Meta
            if (isRecharge) {
                const days = validity === 0 ? parseInt(customValidity || '0') : validity;
                if (days > 0) {
                    const expiryDate = addDays(date, days);
                    const reminderDate = addDays(expiryDate, -2); // 2 days before

                    // Schedule Multi-tier Notifications
                    const { schedulePaymentNotifications } = await import('../../services/paymentNotifications');
                    await schedulePaymentNotifications({
                        id: txId, // Using transaction ID as temporary unique ID for recharges
                        type: 'recharge',
                        name: description || subcategory || category || 'Recharge',
                        amount: finalAmount,
                        dueDate: expiryDate.toISOString().split('T')[0],
                        category: category,
                        accountId: selectedAccount.id,
                    });

                    await addRechargeMeta({
                        expense_id: txId,
                        validity_days: days,
                        expiry_date: expiryDate.toISOString(),
                        reminder_date: reminderDate.toISOString(),
                        notification_id: 'MULTI_TIER_MANAGED'
                    });

                    // Auto-add to subscriptions
                    let billing_cycle = 'monthly';
                    if (days >= 80) billing_cycle = 'quarterly';
                    if (days >= 360) billing_cycle = 'yearly';

                    await addSubscription({
                        name: description || subcategory || category || 'Recurring Expense',
                        amount: finalAmount,
                        billing_cycle: billing_cycle as any,
                        next_renewal_date: expiryDate.toISOString().split('T')[0],
                        category: category,
                        account_id: selectedAccount.id,
                        icon: '🔄',
                        color: Colors.danger[500],
                        is_active: 1,
                        notes: 'Auto-added from new transaction'
                    });
                }
            }

            // Auto-add to subscriptions when category is "Subscription"
            if (category === 'Subscription' && !isRecharge) {
                const nextRenewal = addDays(date, 30); // Default monthly cycle
                await addSubscription({
                    name: description || subcategory || 'Subscription',
                    amount: finalAmount,
                    billing_cycle: 'monthly',
                    next_renewal_date: nextRenewal.toISOString().split('T')[0],
                    category: 'Subscription',
                    sub_category: subcategory || undefined,
                    account_id: selectedAccount.id,
                    icon: '📦',
                    color: '#7C3AED',
                    is_active: 1,
                    notes: `Auto-added from expense • ${subcategory || 'General'}`,
                });
            }

            // Handle Mark as Paid from notification
            if (params.from_notification === 'mark_paid' && params.item_id) {
                const itemId = parseInt(params.item_id as string);
                if (params.item_type === 'subscription') {
                    const { advanceRenewalDate } = await import('../../services/subscriptions');
                    await advanceRenewalDate(itemId);
                } else if (params.item_type === 'recharge') {
                    // Clean up the old recharge_meta since the user just saved a new entry for it
                    const { deleteRechargeMeta } = await import('../../services/database');
                    const { cancelPaymentNotifications } = await import('../../services/paymentNotifications');
                    await cancelPaymentNotifications(itemId, 'recharge');
                    await deleteRechargeMeta(itemId);
                }
            }

            // Handle Scheduled Expense approval from UI
            if (sched_log_id) {
                const logId = parseInt(sched_log_id);
                const { getDatabase } = await import('../../services/database');
                const db = getDatabase();
                
                await db.runAsync(
                    `UPDATE scheduled_expense_log SET action = 'approved', transaction_id = ? WHERE id = ?`,
                    [txId, logId]
                );
                
                const log = await db.getFirstAsync<any>(
                    'SELECT scheduled_expense_id, scheduled_date FROM scheduled_expense_log WHERE id = ?',
                    [logId]
                );
                if (log) {
                    await db.runAsync(
                        `UPDATE scheduled_expenses SET last_created_date = ?, updated_at = datetime('now') WHERE id = ?`,
                        [log.scheduled_date, log.scheduled_expense_id]
                    );
                }
            }

            await refreshData();
            DeviceEventEmitter.emit('RECOMPUTE_SATISFACTION');

            // Trigger Daily Report Update
            try {
                const { scheduleOrUpdateDailyReport } = await import('../../services/dailyReportNotification');
                await scheduleOrUpdateDailyReport();
            } catch (e) {
                console.warn("Daily report trigger failed", e);
            }

            // Sound Feedback
            if (category === 'Income') {
                playIncomeSound(soundEnabled);
            } else {
                playExpenseSound(soundEnabled);
            }

            // Explicit reset (safety)
            setDisplay('0');
            setDescription('');
            setCategory('');
            setSubcategory('');
            setSelectedAccount(null);

            setShowSuccess(true);
        } catch (_e) {
            Alert.alert('Error', 'Failed to save transaction.');
        } finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    const cycleAccount = () => {
        if (isFreeUser) {
            if (accounts.length > 0) {
                setSelectedAccount(accounts[0]);
            }
            return;
        }
        if (accounts.length > 1) {
            const idx = accounts.findIndex(a => a.id === selectedAccount?.id);
            const next = accounts[(idx + 1) % accounts.length];
            setSelectedAccount(next);
        }
    };

    const handleSMSParse = () => {
        const parsed = parseBankSMS(smsText);
        if (parsed) {
            setDisplay(parsed.amount.toString());
            if (parsed.merchant) setDescription(parsed.merchant);
            // Optionally auto-select category based on merchant? 
            // For now just fill amount and desc.
            setShowSMSModal(false);
            setSmsText('');
        } else {
            Alert.alert('Parser Error', 'Could not find transaction details in this SMS.');
        }
    };

    if (initializing) {
        return (
            <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.primary[500]} />
            </View>
        );
    }

    return (
        <TransactionForm
            initialType="expense"
            allowTypeSwitch={true}
            accounts={accounts}
            categories={categories}
            display={display}
            setDisplay={setDisplay}
            description={description}
            setDescription={setDescription}
            selectedAccount={selectedAccount}
            setSelectedAccount={setSelectedAccount}
            category={category}
            setCategory={setCategory}
            subcategory={subcategory}
            setSubcategory={setSubcategory}
            date={date}
            setDate={setDate}
            errors={errors}
            onSave={handleSave}
            onClose={() => safeBack(router)}
            isSubmitting={isSubmitting}
            showSuccess={showSuccess}
            onSuccessFinish={() => {
                setShowSuccess(false);
                safeBack(router);
            }}
            successMessage="Expense Saved!"
            showDuplicateWarning={showDuplicateWarning}
            duplicateTransaction={duplicateTransaction}
            onDuplicateCancel={() => {
                setShowDuplicateWarning(false);
                setDuplicateTransaction(null);
                pendingSaveDataRef.current = null;
            }}
            onDuplicateSaveAnyway={() => {
                setShowDuplicateWarning(false);
                if (pendingSaveDataRef.current !== null) {
                    executeSave(pendingSaveDataRef.current);
                    pendingSaveDataRef.current = null;
                }
            }}
            onCategorySelected={(cat, sub) => {
                setCategory(cat);
                setSubcategory(sub);
                const catData = categories.find((c) => c.name === cat);
                const subSetting = catData?.subcategory_settings?.[sub];
                if (subSetting) {
                    setIsRecharge(subSetting.is_recurring);
                    if (subSetting.is_recurring) setValidity(subSetting.default_validity || 28);
                } else if (catData?.is_recurring) {
                    setIsRecharge(true);
                    setValidity(catData.default_validity || 28);
                } else {
                    setIsRecharge(false);
                }
            }}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.gray[50],
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    closeBtn: {
        padding: 10,
        backgroundColor: Colors.gray[100],
        borderRadius: 14,
    },
    smsBtn: {
        padding: 10,
        backgroundColor: Colors.primary[50],
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.primary[100],
    },
    headerTitleContainer: {
        alignItems: 'center',
    },
    headerSubtitle: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
        color: Colors.gray[400],
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 2,
    },
    headerTitle: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    displayContainer: {
        height: 160,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    amountWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    currencySymbol: {
        fontSize: Typography.size.xxxl,
        color: Colors.gray[400],
        marginRight: 6,
        fontFamily: Typography.family.bold,
    },
    amountDisplay: {
        fontSize: 72,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        maxWidth: Dimensions.get('window').width * 0.8,
    },
    inlineErrorText: {
        fontSize: Typography.size.sm,
        color: Colors.danger[600],
        fontFamily: Typography.family.medium,
        marginTop: 8,
    },
    pillErrorText: {
        fontSize: 10,
        color: Colors.danger[600],
        fontFamily: Typography.family.bold,
        marginTop: 4,
        marginLeft: 4,
    },
    formContainer: {
        paddingHorizontal: 16,
    },
    selectorsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 12,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        paddingHorizontal: 16,
        paddingVertical: 18,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: Colors.gray[100],
        ...Layout.shadows.sm,
    },
    pillIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: Colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    pillContent: {
        flex: 1,
    },
    pillLabel: {
        fontSize: Typography.size.xs,
        color: Colors.gray[400],
        fontFamily: Typography.family.bold,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    pillValue: {
        fontSize: Typography.size.lg,
        color: Colors.gray[900],
        fontFamily: Typography.family.bold,
    },
    widePill: {
        width: '100%',
        marginBottom: 16,
    },
    cycleIcon: {
        marginLeft: 'auto',
    },
    noteWrapper: {
        backgroundColor: Colors.gray[50],
        borderRadius: 20,
        padding: 4,
        marginBottom: 20,
    },
    input: {
        padding: 16,
        fontSize: Typography.size.md,
        color: Colors.gray[800],
        fontFamily: Typography.family.medium,
    },
    // Recharge Styles
    rechargeContainer: {
        padding: 16,
        backgroundColor: Colors.primary[50],
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.primary[100],
        marginBottom: 24,
    },
    repetitiveHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    clockIconContainer: {
        padding: 6,
        backgroundColor: Colors.primary[100],
        borderRadius: 8,
    },
    repetitiveHeaderText: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.primary[800],
    },
    validityOptions: {
        marginTop: 4,
    },
    validityLabel: {
        fontSize: Typography.size.xs,
        color: Colors.primary[700],
        marginBottom: 10,
        fontFamily: Typography.family.bold,
        textTransform: 'uppercase',
    },
    validityButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    vButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: Colors.white,
        alignItems: 'center',
        ...Layout.shadows.sm,
    },
    vButtonActive: {
        backgroundColor: Colors.primary[600],
    },
    vButtonText: {
        fontSize: Typography.size.sm,
        color: Colors.primary[800],
        fontFamily: Typography.family.bold,
    },
    vButtonTextActive: {
        color: Colors.white,
    },
    customInput: {
        marginTop: 12,
        backgroundColor: Colors.white,
        borderRadius: 12,
        padding: 12,
        fontSize: Typography.size.sm,
        color: Colors.gray[800],
        fontFamily: Typography.family.bold,
        ...Layout.shadows.sm,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    smsModalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: Typography.size.xl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    smsHelp: {
        fontSize: Typography.size.sm,
        color: Colors.gray[500],
        marginBottom: 20,
        lineHeight: 20,
        fontFamily: Typography.family.regular,
    },
    smsInput: {
        backgroundColor: Colors.gray[50],
        borderRadius: 20,
        padding: 16,
        height: 120,
        textAlignVertical: 'top',
        fontSize: Typography.size.md,
        color: Colors.gray[800],
        fontFamily: Typography.family.medium,
        borderWidth: 1,
        borderColor: Colors.gray[200],
        marginBottom: 24,
    },
    parseBtn: {
        backgroundColor: Colors.primary[600],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 20,
        gap: 10,
    },
    parseBtnDisabled: {
        backgroundColor: Colors.gray[300],
    },
    parseBtnText: {
        color: 'white',
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
    },
    hintText: {
        fontSize: 11,
        color: Colors.gray[500],
        fontFamily: Typography.family.medium,
        marginTop: 6,
        marginLeft: 16,
    },
    suggestionsContainer: {
        marginBottom: 16,
    },
    suggestionsScroll: {
        gap: 8,
        paddingHorizontal: 4,
    },
    suggestionChip: {
        backgroundColor: Colors.primary[50],
        borderWidth: 1,
        borderColor: Colors.primary[100],
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    suggestionChipText: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        color: Colors.primary[700],
    },
});

export default function AddTransactionScreen() {
    return (
        <ErrorBoundary FallbackComponent={TabErrorFallback}>
            <AddTransactionContent />
        </ErrorBoundary>
    );
}

