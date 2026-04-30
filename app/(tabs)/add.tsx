
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, StatusBar, ScrollView, Dimensions, Modal, DeviceEventEmitter } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { addTransaction, addRechargeMeta, CategoryNode } from '../../services/database';
import { scheduleRechargeReminder } from '../../services/notifications';
import { Clock, Calendar as CalendarIcon, Wallet as WalletIcon, Tag as TagIcon, X, ChevronDown, CheckCircle2 } from 'lucide-react-native';
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
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Sparkles, Clipboard } from 'lucide-react-native';



export default function AddTransactionScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { accounts, refreshData, soundEnabled, categories } = useApp();

    const [display, setDisplay] = useState('0');
    const [description, setDescription] = useState('');
    const [selectedAccount, setSelectedAccount] = useState<any>(null);
    const [category, setCategory] = useState('');
    const [subcategory, setSubcategory] = useState('');
    const [date, setDate] = useState(new Date());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = React.useRef(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Recharge Specific State
    const [isRecharge, setIsRecharge] = useState(false);
    const [validity, setValidity] = useState(28);
    const [customValidity, setCustomValidity] = useState('');
    const [showValidityPicker, setShowValidityPicker] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showSMSModal, setShowSMSModal] = useState(false);
    const [smsText, setSmsText] = useState('');

    // Initial Account Setup
    useEffect(() => {
        if (accounts.length > 0 && !selectedAccount) {
            setSelectedAccount(null); // Explicit text "Select Account"
        }
    }, [accounts]);

    // Reset Form on Focus
    useFocusEffect(
        React.useCallback(() => {
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
        }, [])
    );

    const handleKeyPress = (val: string) => {
        setDisplay(prev => {
            if (prev === '0' && !['+', '-', '*', '/', '.'].includes(val)) return val;
            // Basic prevention of multiple operators
            if (['+', '-', '*', '/', '.'].includes(val) && ['+', '-', '*', '/', '.'].includes(prev.slice(-1))) return prev;
            return prev + val;
        });
    };

    const handleDelete = () => {
        setDisplay(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    };

    const handleClear = () => setDisplay('0');

    const handleSave = async () => {
        // Determine the amount with basic eval logic
        const safeCalculate = (input: string): number => {
            try {
                // Sanitize: allow only numbers and basic operators
                const sanitized = input.replace(/[^-+*/.0-9]/g, '');
                if (!sanitized) return 0;

                // Use a safer way to evaluate simple math expressions
                // This approach splits by operators but respects some order
                // For a truly "safe" version without eval/Function, we use this:
                const tokens = sanitized.match(/(\d+\.?\d*)|([-+*/])/g);
                if (!tokens) return 0;

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
            } catch (e) {
                return 0;
            }
        };

        let finalAmount = safeCalculate(display);

        if (!finalAmount || finalAmount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount');
            return;
        }
        if (!category) {
            Alert.alert('Category Required', 'Please select a category');
            return;
        }
        if (!selectedAccount) {
            Alert.alert('Account Required', 'Please select an account');
            return;
        }

        if (isSubmittingRef.current) return;

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

                    // Schedule Notification
                    const notificationId = await scheduleRechargeReminder(
                        "Recharge Expiring Soon",
                        `Your ${subcategory || 'mobile'} recharge expires in 2 days.`,
                        reminderDate
                    );

                    await addRechargeMeta({
                        expense_id: txId,
                        validity_days: days,
                        expiry_date: expiryDate.toISOString(),
                        reminder_date: reminderDate.toISOString(),
                        notification_id: notificationId
                    });
                }
            }

            await refreshData();
            DeviceEventEmitter.emit('RECOMPUTE_SATISFACTION');

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
        } catch (e) {
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
                    <Text style={styles.currencySymbol}>₹</Text>
                    <Text style={styles.amountDisplay} numberOfLines={1} adjustsFontSizeToFit>{display}</Text>
                </View>
            </Animated.View>

            <ScrollView
                style={styles.formContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
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

                    <PressableScale style={[styles.pill, { flex: 1 }]} onPress={cycleAccount}>
                        <View style={styles.pillIconContainer}>
                            <WalletIcon size={20} color={Colors.primary[600]} />
                        </View>
                        <View style={styles.pillContent}>
                            <Text style={styles.pillLabel}>Account</Text>
                            <Text style={styles.pillValue} numberOfLines={1}>
                                {selectedAccount ? selectedAccount.name : 'Select'}
                            </Text>
                        </View>
                    </PressableScale>
                </Animated.View>

                {/* Category Selector */}
                <Animated.View entering={FadeInDown.delay(300).duration(600)}>
                    <PressableScale style={[styles.pill, styles.widePill]} onPress={() => setShowCategoryPicker(true)}>
                        <View style={styles.pillIconContainer}>
                            <TagIcon size={20} color={category ? Colors.primary[600] : Colors.gray[400]} />
                        </View>
                        <View style={styles.pillContent}>
                            <Text style={styles.pillLabel}>Category</Text>
                            <Text style={[styles.pillValue, !category && { color: Colors.gray[400] }]}>
                                {category ? (subcategory ? `${category}  •  ${subcategory}` : category) : 'Select Category'}
                            </Text>
                        </View>
                        <View style={styles.cycleIcon}>
                            <ChevronDown size={14} color={Colors.gray[400]} />
                        </View>
                    </PressableScale>
                </Animated.View>

                {/* Note Input */}
                <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.noteWrapper}>
                    <TextInput
                        placeholder="What was this for? (optional)"
                        placeholderTextColor={Colors.gray[400]}
                        value={description}
                        onChangeText={setDescription}
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
    }
});

