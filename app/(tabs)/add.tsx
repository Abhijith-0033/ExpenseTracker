
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, StatusBar, ScrollView, Dimensions, Modal, DeviceEventEmitter } from 'react-native';
import { useFocusEffect, useRouter , useLocalSearchParams } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { addTransaction, addRechargeMeta, CategoryNode } from '../../services/database';
import { schedulePaymentNotifications } from '../../services/paymentNotifications';
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



export default function AddTransactionScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { accounts, refreshData, soundEnabled, categories } = useApp();

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

    // Initial Account Setup
    useEffect(() => {
        if (accounts.length > 0 && !selectedAccount) {
            setSelectedAccount(null); // Explicit text "Select Account"
        }
    }, [accounts, selectedAccount]);

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
        try {
             
            const result = new Function(`return (${safe})`)();
            return typeof result === 'number' && isFinite(result) ? result : 0;
        } catch {
            const tokens = safe.match(/(\d+\.?\d*)|([-+*/])/g);
            if (!tokens) return parseFloat(safe) || 0;
            let result = parseFloat(tokens[0]);
            for (let i = 1; i < tokens.length; i += 2) {
                const op = tokens[i];
                const val = parseFloat(tokens[i + 1]);
                if (isNaN(val)) continue;
                if (op === '+') result += val;
                else if (op === '-') result -= val;
                else if (op === '*') result *= val;
                else if (op === '/') result = val !== 0 ? result / val : 0;
            }
            return result;
        }
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

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" />

            {/* Subtle top gradient */}
            <LinearGradient
                colors={['rgba(15, 23, 42, 0.05)', 'rgba(255, 255, 255, 0)']}
                style={StyleSheet.absoluteFill}
            />

            {/* Header */}
            <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
                <PressableScale onPress={() => router.back()} style={styles.closeBtn}>
                    <X size={24} color={Colors.gray[800]} />
                </PressableScale>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerSubtitle}>Money Out</Text>
                    <Text style={styles.headerTitle}>New Transaction</Text>
                </View>
                <TouchableOpacity 
                    onPress={() => setShowSMSModal(true)}
                    style={styles.smsBtn}
                >
                    <Sparkles size={20} color={Colors.primary[600]} />
                </TouchableOpacity>
            </Animated.View>

            {/* Main Display */}
            <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.displayContainer}>
                <View style={styles.amountWrapper}>
                    <Text style={[styles.currencySymbol, errors.amount && { color: Colors.danger[400] }]}>₹</Text>
                    <Text style={[styles.amountDisplay, errors.amount && { color: Colors.danger[600] }]} numberOfLines={1} adjustsFontSizeToFit>{display}</Text>
                </View>
                {errors.amount && (
                    <Animated.Text entering={FadeIn.duration(300)} style={styles.inlineErrorText}>
                        {errors.amount}
                    </Animated.Text>
                )}
            </Animated.View>

            <ScrollView
                style={styles.formContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Suggestions Section */}
                {suggestions.length > 0 && (
                    <Animated.View entering={FadeInDown.duration(400)} style={styles.suggestionsContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
                            {suggestions.map((sugg, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={styles.suggestionChip}
                                    onPress={() => {
                                        setCategory(sugg.category);
                                        setSubcategory(sugg.subcategory);
                                        const acc = accounts.find(a => a.id === sugg.accountId);
                                        if (acc) setSelectedAccount(acc);
                                    }}
                                >
                                    <Text style={styles.suggestionChipText}>
                                        ✨ {sugg.category} • {sugg.subcategory || 'General'} • {sugg.accountName}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </Animated.View>
                )}

                {/* Row 1: Date & Account */}
                <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.selectorsRow}>
                    <PressableScale style={[styles.pill, { flex: 1 }]} onPress={() => setShowDatePicker(true)}>
                        <View style={styles.pillIconContainer}>
                            <CalendarIcon size={20} color={Colors.primary[600]} />
                        </View>
                        <View style={styles.pillContent}>
                            <Text style={styles.pillLabel}>Date</Text>
                            <Text style={styles.pillValue}>{format(date, 'MMM dd, yyyy')}</Text>
                        </View>
                    </PressableScale>

                    <View style={{ flex: 1 }}>
                        <PressableScale style={[styles.pill, errors.account && { borderColor: Colors.danger[300] }]} onPress={cycleAccount}>
                            <View style={[styles.pillIconContainer, errors.account && { backgroundColor: Colors.danger[50] }]}>
                                <WalletIcon size={20} color={errors.account ? Colors.danger[600] : Colors.primary[600]} />
                            </View>
                            <View style={styles.pillContent}>
                                <Text style={[styles.pillLabel, errors.account && { color: Colors.danger[400] }]}>Account</Text>
                                <Text style={[styles.pillValue, errors.account && { color: Colors.danger[600] }]} numberOfLines={1}>
                                    {selectedAccount ? selectedAccount.name : 'Select'}
                                </Text>
                            </View>
                        </PressableScale>
                        {errors.account && <Text style={styles.pillErrorText}>{errors.account}</Text>}
                    </View>
                </Animated.View>

                {/* Category Selector */}
                <Animated.View entering={FadeInDown.delay(300).duration(600)} style={{ marginBottom: 16 }}>
                    <PressableScale 
                        style={[styles.pill, styles.widePill, { marginBottom: 0 }, errors.category && { borderColor: Colors.danger[300] }]} 
                        onPress={() => setShowCategoryPicker(true)}
                    >
                        <View style={[styles.pillIconContainer, errors.category && { backgroundColor: Colors.danger[50] }]}>
                            <TagIcon size={20} color={errors.category ? Colors.danger[600] : (category ? Colors.primary[600] : Colors.gray[400])} />
                        </View>
                        <View style={styles.pillContent}>
                            <Text style={[styles.pillLabel, errors.category && { color: Colors.danger[400] }]}>Category</Text>
                            <Text style={[styles.pillValue, !category && { color: Colors.gray[400] }, errors.category && { color: Colors.danger[600] }]}>
                                {category ? (subcategory ? `${category}  •  ${subcategory}` : category) : 'Select Category'}
                            </Text>
                        </View>
                        <View style={styles.cycleIcon}>
                            <ChevronDown size={14} color={errors.category ? Colors.danger[400] : Colors.gray[400]} />
                        </View>
                    </PressableScale>
                    {errors.category && <Text style={styles.pillErrorText}>{errors.category}</Text>}
                    {lastUsedHint && !errors.category && (
                        <Text style={styles.hintText}>{lastUsedHint}</Text>
                    )}
                </Animated.View>

                {/* Note Input */}
                <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.noteWrapper}>
                    <TextInput
                        placeholder="What was this for? (optional)"
                        placeholderTextColor={Colors.gray[400]}
                        value={description}
                        onChangeText={handleDescriptionChange}
                        style={styles.input}
                    />
                </Animated.View>

                {/* Repetitive Status & Validity Options */}
                {isRecharge && (
                    <Animated.View entering={FadeInDown.duration(400)} style={styles.rechargeContainer}>
                        <View style={styles.repetitiveHeader}>
                            <View style={styles.clockIconContainer}>
                                <Clock size={16} color={Colors.primary[700]} />
                            </View>
                            <Text style={styles.repetitiveHeaderText}>Recurring Expense</Text>
                            <CheckCircle2 size={16} color={Colors.primary[500]} style={{ marginLeft: 'auto' }} />
                        </View>

                        <View style={styles.validityOptions}>
                            <Text style={styles.validityLabel}>Set Validity (Days):</Text>
                            <View style={styles.validityButtons}>
                                {[28, 56, 84].map(v => (
                                    <PressableScale
                                        key={v}
                                        style={[styles.vButton, validity === v && styles.vButtonActive]}
                                        onPress={() => {
                                            setValidity(v);
                                            setCustomValidity('');
                                        }}
                                    >
                                        <Text style={[styles.vButtonText, validity === v && styles.vButtonTextActive]}>{v}</Text>
                                    </PressableScale>
                                ))}
                                <PressableScale
                                    style={[styles.vButton, validity === 0 && styles.vButtonActive]}
                                    onPress={() => setValidity(0)}
                                >
                                    <Text style={[styles.vButtonText, validity === 0 && styles.vButtonTextActive]}>Custom</Text>
                                </PressableScale>
                            </View>
                            {validity === 0 && (
                                <TextInput
                                    style={styles.customInput}
                                    placeholder="Enter days"
                                    keyboardType="numeric"
                                    value={customValidity}
                                    onChangeText={setCustomValidity}
                                />
                            )}
                        </View>
                    </Animated.View>
                )}
            </ScrollView>


            <Animated.View entering={FadeInUp.delay(500).duration(600)}>
                <Keypad
                    onPress={handleKeyPress}
                    onDelete={handleDelete}
                    onClear={handleClear}
                    onSubmit={handleSave}
                    onEvaluate={handleEvaluate}
                    disabled={isSubmitting}
                />
            </Animated.View>

            {/* Date Picker Modal */}
            {showDatePicker && (
                <DateTimePicker
                    value={date}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                        setShowDatePicker(false);
                        if (selectedDate) setDate(selectedDate);
                    }}
                />
            )}

            {/* Category Modal */}
            <CategoryPicker
                visible={showCategoryPicker}
                onClose={() => setShowCategoryPicker(false)}
                onSelect={(cat, sub) => {
                    setCategory(cat);
                    setSubcategory(sub);

                    // Check if category is repetitive
                    const catData = categories.find((c: CategoryNode) => c.name === cat);

                    // Check subcategory override first
                    const subSetting = catData?.subcategory_settings?.[sub];

                    if (subSetting) {
                        setIsRecharge(subSetting.is_recurring);
                        if (subSetting.is_recurring) {
                            setValidity(subSetting.default_validity || 28);
                        }
                    } else if (catData?.is_recurring) {
                        setIsRecharge(true);
                        setValidity(catData.default_validity || 28);
                    } else {
                        setIsRecharge(false);
                    }
                }}
            />

            <SuccessAnimation 
                visible={showSuccess} 
                onAnimationFinish={() => {
                    setShowSuccess(false);
                    router.back();
                }} 
                message="Expense Saved!"
            />

            {/* SMS Detection Modal */}
            <Modal visible={showSMSModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.smsModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Quick Fill from SMS</Text>
                            <TouchableOpacity onPress={() => setShowSMSModal(false)}>
                                <X size={24} color={Colors.gray[500]} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.smsHelp}>Paste your bank SMS here to auto-detect amount and description.</Text>
                        <TextInput
                            multiline
                            style={styles.smsInput}
                            placeholder="Example: Your a/c no. XX1234 is debited for Rs. 500.00 at AMAZON on 23-04-20..."
                            value={smsText}
                            onChangeText={setSmsText}
                        />
                        <TouchableOpacity 
                            style={[styles.parseBtn, !smsText && styles.parseBtnDisabled]} 
                            onPress={handleSMSParse}
                            disabled={!smsText}
                        >
                            <Sparkles size={20} color="white" />
                            <Text style={styles.parseBtnText}>Detect Details</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <DuplicateWarningSheet 
                visible={showDuplicateWarning}
                existingTransaction={duplicateTransaction}
                onCancel={() => {
                    setShowDuplicateWarning(false);
                    setDuplicateTransaction(null);
                    pendingSaveDataRef.current = null;
                }}
                onSaveAnyway={() => {
                    setShowDuplicateWarning(false);
                    if (pendingSaveDataRef.current !== null) {
                        executeSave(pendingSaveDataRef.current);
                        pendingSaveDataRef.current = null;
                    }
                }}
            />
        </View>
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

