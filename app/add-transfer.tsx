import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, Dimensions, DeviceEventEmitter, ActivityIndicator, InteractionManager
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useApp } from '../context/AppContext';
import { addTransfer } from '../services/database';
import { Keypad } from '../components/ui/Keypad';
import {
  Calendar as CalendarIcon, ArrowRight,
  Wallet as WalletIcon, X, ArrowDownUp
} from 'lucide-react-native';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Layout, Typography } from '../constants/Theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../components/ui/PressableScale';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SuccessAnimation } from '../components/SuccessAnimation';
import { safeBack } from '../utils/navigation';
import { TransactionForm } from '../components/transaction/TransactionForm';
import { ConfirmActionSheet } from '../components/ConfirmActionSheet';

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

    // Warning sheet state (replaces Alert.alert)
    const [warningSheet, setWarningSheet] = useState<{
        title: string;
        description: string;
    } | null>(null);

    const [initializing, setInitializing] = useState(true);
    React.useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => {
            setInitializing(false);
        });
        return () => task.cancel();
    }, []);
    
    useFocusEffect(
        React.useCallback(() => {
            setShowSuccess(false);
            setDisplay('0');
            setDescription('');
        }, [])
    );

    // Ensure accounts are initialized if they load after mount
    React.useEffect(() => {
        if (accounts.length > 0) {
            if (!fromAccount) {
                setFromAccount(accounts[0]);
                if (accounts.length > 1) {
                    setToAccount(accounts[1]);
                } else {
                    setToAccount(accounts[0]);
                }
            } else if (!toAccount) {
                if (accounts.length > 1) {
                    const other = accounts.find(a => a.id !== fromAccount.id);
                    setToAccount(other || accounts[0]);
                } else {
                    setToAccount(accounts[0]);
                }
            }
        }
    }, [accounts, fromAccount, toAccount]);

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
        if (accounts.length <= 1) return;
        const idx = accounts.findIndex(a => a.id === fromAccount?.id);
        let nextIdx = (idx + 1) % accounts.length;
        let next = accounts[nextIdx];

        if (next.id === toAccount?.id) {
            if (accounts.length === 2) {
                // Swap
                setFromAccount(toAccount);
                setToAccount(fromAccount);
                return;
            } else {
                // Skip the selected "toAccount"
                nextIdx = (nextIdx + 1) % accounts.length;
                next = accounts[nextIdx];
            }
        }
        setFromAccount(next);
    };

    const cycleToAccount = () => {
        if (accounts.length <= 1) return;
        const idx = accounts.findIndex(a => a.id === toAccount?.id);
        let nextIdx = (idx + 1) % accounts.length;
        let next = accounts[nextIdx];

        if (next.id === fromAccount?.id) {
            if (accounts.length === 2) {
                // Swap
                setToAccount(fromAccount);
                setFromAccount(toAccount);
                return;
            } else {
                // Skip the selected "fromAccount"
                nextIdx = (nextIdx + 1) % accounts.length;
                next = accounts[nextIdx];
            }
        }
        setToAccount(next);
    };

    const handleSave = async () => {
        let finalAmount = 0;
        const newErrors: Record<string, string> = {};
        try {
            let cleanDisplay = display;
            if (cleanDisplay.endsWith('.')) cleanDisplay = cleanDisplay.slice(0, -1);
            finalAmount = parseFloat(cleanDisplay);
        } catch (_e) {
            finalAmount = 0;
        }

        if (finalAmount <= 0) {
            newErrors.amount = 'Please enter a valid amount';
            setErrors(newErrors);
            setWarningSheet({ title: 'Invalid Amount', description: 'Please enter a valid transfer amount greater than ₹0.' });
            return;
        }
        if (!fromAccount || !toAccount) {
            newErrors.accounts = 'Select both accounts';
            setErrors(newErrors);
            setWarningSheet({ title: 'Missing Accounts', description: 'Please select both a source and a destination account before transferring.' });
            return;
        }
        if (fromAccount.id === toAccount.id) {
            newErrors.accounts = 'Source and destination must differ';
            setErrors(newErrors);
            setWarningSheet({ title: 'Same Account', description: 'Source and destination accounts must be different. Use the ⇄ button to swap them.' });
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
                setWarningSheet({
                    title: 'Insufficient Balance',
                    description: `"${fromAccount.name}" doesn't have enough balance to complete this transfer.`,
                });
            } else if (e?.message === 'SAME_ACCOUNT') {
                setWarningSheet({ title: 'Same Account', description: 'Cannot transfer to the same account.' });
            } else {
                setWarningSheet({ title: 'Transfer Failed', description: e?.message || 'An unexpected error occurred. Please try again.' });
            }
        } finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
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
        <>
            <TransactionForm
                initialType="transfer"
                allowTypeSwitch={true}
                accounts={accounts}
                display={display}
                setDisplay={setDisplay}
                description={description}
                setDescription={setDescription}
                fromAccount={fromAccount}
                setFromAccount={setFromAccount}
                toAccount={toAccount}
                setToAccount={setToAccount}
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
                successMessage="Transfer Successful!"
            />
            {warningSheet && (
                <ConfirmActionSheet
                    visible={!!warningSheet}
                    title={warningSheet.title}
                    description={warningSheet.description}
                    confirmLabel="OK"
                    actionType="warning"
                    onConfirm={() => setWarningSheet(null)}
                    onCancel={() => setWarningSheet(null)}
                />
            )}
        </>
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
