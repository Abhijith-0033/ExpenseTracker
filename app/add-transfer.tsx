import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, StatusBar, ScrollView, Dimensions, DeviceEventEmitter
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useApp } from '../context/AppContext';
import { addTransfer } from '../services/database';
import { Keypad } from '../components/ui/Keypad';
import {
  Calendar as CalendarIcon, ArrowRight,
  Wallet as WalletIcon, X, ArrowDownUp, Check
} from 'lucide-react-native';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Layout, Typography } from '../constants/Theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '../utils/currency';
import { PressableScale } from '../components/ui/PressableScale';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SuccessAnimation } from '../components/SuccessAnimation';

const { width } = Dimensions.get('window');

export default function AddTransferScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { accounts, refreshData } = useApp();

    const [display, setDisplay] = useState('0');
    const [description, setDescription] = useState('');
    const [fromAccount, setFromAccount] = useState<any>(accounts[0] || null);
    const [toAccount, setToAccount] = useState<any>(accounts[1] || accounts[0] || null);
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = React.useRef(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    
    useFocusEffect(
        React.useCallback(() => {
            setShowSuccess(false);
            setDisplay('0');
            setDescription('');
        }, [])
    );

    const handleKeyPress = (key: string) => {
        if (display.length >= 12) return;
        if (display === '0' && key !== '.') {
            setDisplay(key);
        } else {
            if (key === '.' && display.includes('.')) return;
            setDisplay(display + key);
        }
    };

    const handleDelete = () => {
        if (display.length === 1) {
            setDisplay('0');
        } else {
            setDisplay(display.slice(0, -1));
        }
    };

    const handleClear = () => setDisplay('0');

    const cycleFromAccount = () => {
        const available = accounts;
        if (available.length <= 1) return;
        const idx = available.findIndex(a => a.id === fromAccount?.id);
        const next = available[(idx + 1) % available.length];
        if (next.id === toAccount?.id) {
            setFromAccount(available[(idx + 2) % available.length]);
        } else {
            setFromAccount(next);
        }
    };

    const cycleToAccount = () => {
        const available = accounts;
        if (available.length <= 1) return;
        const idx = available.findIndex(a => a.id === toAccount?.id);
        const next = available[(idx + 1) % available.length];
        if (next.id === fromAccount?.id) {
            setToAccount(available[(idx + 2) % available.length]);
        } else {
            setToAccount(next);
        }
    };

    const handleSave = async () => {
        let finalAmount = 0;
        const newErrors: Record<string, string> = {};
        try {
            let cleanDisplay = display;
            if (cleanDisplay.endsWith('.')) cleanDisplay = cleanDisplay.slice(0, -1);
            finalAmount = parseFloat(cleanDisplay);
        } catch (e) {
            finalAmount = 0;
        }

        if (finalAmount <= 0) {
            newErrors.amount = 'Please enter a valid amount';
        }
        if (!fromAccount || !toAccount) {
            newErrors.accounts = 'Select both accounts';
        } else if (fromAccount.id === toAccount.id) {
            newErrors.accounts = 'Source and destination must differ';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setErrors({});

        if (isSubmittingRef.current) return;

        try {
            setIsSubmitting(true);
            isSubmittingRef.current = true;

            await addTransfer(
                finalAmount,
                fromAccount.id,
                toAccount.id,
                date.toISOString(),
                description || 'Account Transfer'
            );
            await refreshData();
            DeviceEventEmitter.emit('RECOMPUTE_SATISFACTION');
            setShowSuccess(true);
        } catch (e: any) {
            if (e?.message === 'INSUFFICIENT_BALANCE') {
                Alert.alert('Insufficient Balance', `${fromAccount.name} doesn't have enough balance.`);
            } else if (e?.message === 'SAME_ACCOUNT') {
                Alert.alert('Invalid', 'Cannot transfer to the same account');
            } else {
                Alert.alert('Error', e?.message || 'Transfer failed.');
            }
        } finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={[Colors.primary[500], Colors.accent.peach]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.header, { paddingTop: insets.top + 10 }]}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
                        <X size={24} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Move Funds</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Main Display */}
                <View style={styles.amountContainer}>
                    <Text style={[styles.currencySymbol, errors.amount && { color: Colors.danger[200] }]}>₹</Text>
                    <Text style={[styles.amountDisplay, errors.amount && { color: Colors.danger[100] }]} numberOfLines={1} adjustsFontSizeToFit>{display}</Text>
                </View>
                {errors.amount && (
                    <Animated.Text entering={FadeIn.duration(300)} style={styles.inlineErrorTextHeader}>
                        {errors.amount}
                    </Animated.Text>
                )}

                {/* Accounts Row */}
                <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.transferFlow}>
                    <View style={styles.transferRow}>
                        <PressableScale style={[styles.pill, { flex: 1 }, errors.accounts && { borderColor: Colors.danger[300] }]} onPress={cycleFromAccount}>
                            <View style={styles.pillIconContainer}>
                                <WalletIcon size={20} color={Colors.primary[600]} />
                            </View>
                            <View style={styles.pillContent}>
                                <Text style={styles.pillLabel}>From</Text>
                                <Text style={styles.pillValue} numberOfLines={1}>{fromAccount?.name}</Text>
                            </View>
                        </PressableScale>

                        <View style={styles.arrowContainer}>
                            <ArrowRight size={20} color={Colors.gray[400]} />
                        </View>

                        <PressableScale style={[styles.pill, { flex: 1 }, errors.accounts && { borderColor: Colors.danger[300] }]} onPress={cycleToAccount}>
                            <View style={styles.pillIconContainer}>
                                <WalletIcon size={20} color={Colors.primary[600]} />
                            </View>
                            <View style={styles.pillContent}>
                                <Text style={styles.pillLabel}>To</Text>
                                <Text style={styles.pillValue} numberOfLines={1}>{toAccount?.name}</Text>
                            </View>
                        </PressableScale>
                    </View>
                    {errors.accounts && <Text style={styles.pillErrorText}>{errors.accounts}</Text>}
                </Animated.View>
            </LinearGradient>

            <View style={styles.content}>
                <View style={styles.inputSection}>
                    <View style={styles.inputRow}>
                        <CalendarIcon size={20} color={Colors.gray[400]} />
                        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.datePickerBtn}>
                            <Text style={styles.dateText}>{format(date, 'EEEE, MMM dd yyyy')}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputRow}>
                        <ArrowDownUp size={20} color={Colors.gray[400]} />
                        <TextInput
                            style={styles.noteInput}
                            placeholder="What's this transfer for?"
                            placeholderTextColor={Colors.gray[400]}
                            value={description}
                            onChangeText={setDescription}
                        />
                    </View>
                </View>

                <View style={styles.keypadSection}>
                    <Keypad
                        onPress={handleKeyPress}
                        onDelete={handleDelete}
                        onClear={handleClear}
                        onSubmit={handleSave}
                        disabled={isSubmitting}
                    />
                </View>
            </View>

            {showDatePicker && (
                <DateTimePicker
                    value={date}
                    mode="date"
                    onChange={(event, selectedDate) => {
                        setShowDatePicker(false);
                        if (selectedDate) setDate(selectedDate);
                    }}
                />
            )}

            <SuccessAnimation 
                visible={showSuccess} 
                onAnimationFinish={() => {
                    setShowSuccess(false);
                    router.back();
                }} 
                message="Transfer Successful!"
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
        paddingBottom: 30,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        color: 'white',
    },
    amountContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
    },
    currencySymbol: {
        fontSize: Typography.size.xxxl,
        fontFamily: Typography.family.medium,
        color: 'rgba(255,255,255,0.8)',
        marginRight: 8,
    },
    amountDisplay: {
        fontSize: 56,
        fontFamily: Typography.family.bold,
        color: 'white',
    },
    transferFlow: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        marginTop: 20,
    },
    transferRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    pill: {
        backgroundColor: 'white',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    pillIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    pillContent: {
        flex: 1,
    },
    pillLabel: {
        fontSize: 10,
        fontFamily: Typography.family.bold,
        color: Colors.gray[400],
    },
    pillValue: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        color: Colors.gray[800],
    },
    arrowContainer: {
        paddingHorizontal: 12,
    },
    content: {
        flex: 1,
        justifyContent: 'space-between',
    },
    inputSection: {
        padding: 24,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        gap: 12,
        ...Layout.shadows.sm,
    },
    datePickerBtn: {
        flex: 1,
    },
    dateText: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        maxWidth: width * 0.8,
    },
    inlineErrorTextHeader: {
        fontSize: Typography.size.sm,
        color: 'white',
        fontFamily: Typography.family.medium,
        marginTop: -20,
        marginBottom: 10,
        textAlign: 'center',
        backgroundColor: 'rgba(240, 68, 56, 0.3)',
        alignSelf: 'center',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
    },
    pillErrorText: {
        fontSize: 10,
        color: 'white',
        fontFamily: Typography.family.bold,
        marginTop: 6,
        textAlign: 'center',
        backgroundColor: 'rgba(240, 68, 56, 0.3)',
        alignSelf: 'center',
        paddingHorizontal: 10,
        paddingVertical: 2,
        borderRadius: 6,
    },
    noteInput: {
        flex: 1,
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        color: Colors.gray[800],
    },
    keypadSection: {
        backgroundColor: Colors.gray[50],
        paddingBottom: 20,
    },
});
