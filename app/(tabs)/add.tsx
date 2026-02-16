
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, StatusBar, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { addTransaction, addRechargeMeta, CategoryNode } from '../../services/database';
import { scheduleRechargeReminder } from '../../services/notifications';
import { Clock, Calendar as CalendarIcon, Wallet as WalletIcon, Tag as TagIcon, X } from 'lucide-react-native';
import { format, addDays } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Layout } from '../../constants/Theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Keypad } from '../../components/ui/Keypad';
import { CategoryPicker } from '../../components/CategoryPicker';

import { playExpenseSound } from '../../services/SoundService';

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
        let finalAmount = 0;
        try {
            const sanitized = display.replace(/[^-+*/.0-9]/g, '');
            // Safer alternative to eval for simple math
            // eslint-disable-next-line no-new-func
            finalAmount = new Function('return ' + sanitized)();
        } catch (e) {
            Alert.alert('Invalid', 'Amount is not a valid number');
            return;
        }

        if (!finalAmount || finalAmount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount');
            return;
        }
        if (!category || !subcategory) {
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

            // Sound Feedback
            playExpenseSound(soundEnabled);

            // Explicit reset (safety)
            setDisplay('0');
            setDescription('');
            setCategory('');
            setSubcategory('');
            setSelectedAccount(null);

            router.back();
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

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
                    <X size={24} color={Colors.gray[600]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>New Transaction</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Main Display */}
            <View style={styles.displayContainer}>
                <Text style={styles.currencySymbol}>₹</Text>
                <Text style={styles.amountDisplay} numberOfLines={1} adjustsFontSizeToFit>{display}</Text>
            </View>

            <ScrollView
                style={styles.formContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Row 1: Date & Account */}
                <View style={styles.selectorsRow}>
                    <TouchableOpacity style={styles.pill} onPress={() => setShowDatePicker(true)}>
                        <CalendarIcon size={18} color={Colors.primary[600]} />
                        <Text style={styles.pillText}>{format(date, 'MMM dd, yyyy')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.pill} onPress={cycleAccount}>
                        <WalletIcon size={18} color={Colors.primary[600]} />
                        <Text style={styles.pillText}>
                            {selectedAccount ? selectedAccount.name : 'Select Account'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Category Selector */}
                <TouchableOpacity style={[styles.pill, styles.widePill]} onPress={() => setShowCategoryPicker(true)}>
                    <TagIcon size={20} color={category ? Colors.primary[600] : Colors.gray[400]} />
                    <Text style={[styles.pillText, !category && { color: Colors.gray[400] }]}>
                        {category ? `${category}  •  ${subcategory}` : 'Select Category'}
                    </Text>
                </TouchableOpacity>

                {/* Note Input */}
                <TextInput
                    placeholder="Add a note (optional)"
                    placeholderTextColor={Colors.gray[400]}
                    value={description}
                    onChangeText={setDescription}
                    style={styles.input}
                />

                {/* Repetitive Status & Validity Options */}
                {isRecharge && (
                    <View style={[styles.rechargeContainer, { marginBottom: 20 }]}>
                        <View style={styles.repetitiveHeader}>
                            <Clock size={16} color={Colors.primary[600]} />
                            <Text style={styles.repetitiveHeaderText}>Repetitive Expense detected</Text>
                        </View>

                        <View style={styles.validityOptions}>
                            <Text style={styles.validityLabel}>Set Validity (Days):</Text>
                            <View style={styles.validityButtons}>
                                {[28, 56, 84].map(v => (
                                    <TouchableOpacity
                                        key={v}
                                        style={[styles.vButton, validity === v && styles.vButtonActive]}
                                        onPress={() => {
                                            setValidity(v);
                                            setCustomValidity('');
                                        }}
                                    >
                                        <Text style={[styles.vButtonText, validity === v && styles.vButtonTextActive]}>{v}</Text>
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity
                                    style={[styles.vButton, validity === 0 && styles.vButtonActive]}
                                    onPress={() => setValidity(0)}
                                >
                                    <Text style={[styles.vButtonText, validity === 0 && styles.vButtonTextActive]}>Custom</Text>
                                </TouchableOpacity>
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
                    </View>
                )}
            </ScrollView>

            <View style={{ flex: 1 }} />

            <Keypad
                onPress={handleKeyPress}
                onDelete={handleDelete}
                onClear={handleClear}
                onSubmit={handleSave}
                disabled={isSubmitting}
            />

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
        paddingHorizontal: Layout.spacing.md,
        paddingBottom: Layout.spacing.sm,
    },
    closeBtn: {
        padding: 8,
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.full,
        ...Layout.shadows.sm,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.gray[800],
    },
    displayContainer: {
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        marginBottom: Layout.spacing.md,
    },
    currencySymbol: {
        fontSize: 32,
        color: Colors.gray[400],
        marginRight: 8,
        fontWeight: '500',
    },
    amountDisplay: {
        fontSize: 64,
        fontWeight: '700',
        color: Colors.gray[900],
        maxWidth: '80%',
    },
    formContainer: {
        paddingHorizontal: Layout.spacing.lg,
    },
    selectorsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: Layout.radius.lg,
        flex: 0.48,
        ...Layout.shadows.sm,
    },
    widePill: {
        flex: 0,
        width: '100%',
        marginBottom: 16,
        justifyContent: 'center',
    },
    pillText: {
        marginLeft: 10,
        fontSize: 15,
        color: Colors.gray[800],
        fontWeight: '600',
    },
    input: {
        backgroundColor: Colors.white,
        padding: 16,
        borderRadius: Layout.radius.lg,
        fontSize: 16,
        color: Colors.gray[800],
        ...Layout.shadows.sm,
    },
    // Recharge Styles
    rechargeContainer: {
        marginTop: 16,
        padding: 12,
        backgroundColor: Colors.primary[50], // Light blue theme for repetitive
        borderRadius: Layout.radius.lg,
        borderWidth: 1,
        borderColor: Colors.primary[100],
    },
    repetitiveHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    repetitiveHeaderText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.primary[700],
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: Colors.gray[300],
        marginLeft: 'auto',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxActive: {
        borderColor: Colors.white,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    checkboxInner: {
        width: 10,
        height: 10,
        borderRadius: 2,
        backgroundColor: Colors.white,
    },
    validityOptions: {
        marginTop: 8,
    },
    validityLabel: {
        fontSize: 13,
        color: Colors.gray[500],
        marginBottom: 8,
        fontWeight: '600',
    },
    validityButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    vButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: Layout.radius.md,
        backgroundColor: Colors.gray[100],
        alignItems: 'center',
    },
    vButtonActive: {
        backgroundColor: Colors.primary[600],
    },
    vButtonText: {
        fontSize: 14,
        color: Colors.gray[600],
        fontWeight: '600',
    },
    vButtonTextActive: {
        color: Colors.white,
    },
    customInput: {
        marginTop: 10,
        borderWidth: 1,
        borderColor: Colors.gray[200],
        borderRadius: Layout.radius.md,
        padding: 10,
        fontSize: 14,
        color: Colors.gray[800],
    }
});
