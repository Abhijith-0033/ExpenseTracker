
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, StatusBar, Dimensions, ScrollView, DeviceEventEmitter, ActivityIndicator, InteractionManager } from 'react-native';
import { useRouter , useFocusEffect } from 'expo-router';
import { useApp } from '../context/AppContext';
import { addTransaction, getIncomeSources } from '../services/database';
import { playIncomeSound } from '../services/SoundService';
import { Keypad } from '../components/ui/Keypad';
import { Calendar as CalendarIcon, Wallet as WalletIcon, Tag as TagIcon, X, Briefcase, TrendingUp, Gift, DollarSign, Home, Globe, User, ChevronDown } from 'lucide-react-native';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Layout, Typography } from '../constants/Theme';
import { commonStyles } from '../theme/commonStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../components/ui/PressableScale';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { SuccessAnimation } from '../components/SuccessAnimation';
import { checkDuplicate } from '../services/duplicateCheck';
import { DuplicateWarningSheet } from '../components/DuplicateWarningSheet';
import { TransactionForm } from '../components/transaction/TransactionForm';

export default function AddIncomeScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { accounts, refreshData, soundEnabled } = useApp();

    const [display, setDisplay] = useState('0');
    const [description, setDescription] = useState('');
    const [selectedAccount, setSelectedAccount] = useState<any>(null);
    const [initializing, setInitializing] = useState(true);
    useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => {
            setInitializing(false);
        });
        return () => task.cancel();
    }, []);
    // Fixed category for Income, but subcategory is selectable
    const category = 'Income';
    const [subcategory, setSubcategory] = useState('Salary');
    const [incomeSources, setIncomeSources] = useState<any[]>([]);
    const [selectedSourceIcon, setSelectedSourceIcon] = useState('Briefcase');
    const [date, setDate] = useState(new Date());

    const [_showSourcePicker, _setShowSourcePicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Duplicate Guard State
    const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
    const [duplicateTransaction, setDuplicateTransaction] = useState<any>(null);
    const pendingSaveDataRef = React.useRef<number | null>(null);

    const loadIncomeSources = React.useCallback(async () => {
        try {
            const sources = await getIncomeSources();
            if (sources.length > 0) {
                setIncomeSources(sources);

                // If current subcategory exists in sources, sync icon
                const current = sources.find(s => s.name === subcategory);
                if (current) {
                    setSelectedSourceIcon(current.icon);
                } else {
                    // Initialize with first source
                    setSubcategory(sources[0].name);
                    setSelectedSourceIcon(sources[0].icon);
                }
            }
        } catch (e) {
            console.error("Failed to load income sources", e);
        }
    }, []);

    useEffect(() => {
        if (accounts.length > 0 && !selectedAccount) {
            setSelectedAccount(accounts[0]);
        }
        loadIncomeSources();
    }, [accounts, loadIncomeSources, selectedAccount]);

    useFocusEffect(
        React.useCallback(() => {
            setShowSuccess(false);
            setDisplay('0');
            setDescription('');
        }, [])
    );


    const evaluateExpression = (expr: string): number => {
        const safe = expr.replace(/[^0-9+\-*/.]/g, '');
        if (!safe) return 0;
        const tokens = safe.match(/(\d+\.?\d*)|([-+*/])/g);
        if (!tokens) return parseFloat(safe) || 0;
        let result = parseFloat(tokens[0]);
        if (isNaN(result)) return 0;
        for (let i = 1; i < tokens.length; i += 2) {
            const op = tokens[i];
            const val = parseFloat(tokens[i + 1]);
            if (isNaN(val)) continue;
            if (op === '+') result += val;
            else if (op === '-') result -= val;
            else if (op === '*') result *= val;
            else if (op === '/') result = val !== 0 ? result / val : result;
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

    const handleDelete = () => {
        setDisplay(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    };

    const handleClear = () => setDisplay('0');

    const handleEvaluate = () => {
        setDisplay(evaluateExpression(display).toString());
    };

    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = React.useRef(false);

    const handleSave = async () => {
        let finalAmount = evaluateExpression(display);
        const newErrors: Record<string, string> = {};

        if (finalAmount <= 0) {
            newErrors.amount = 'Please enter a valid amount';
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

        const duplicate = await checkDuplicate(finalAmount, category, date.toISOString(), 'income');
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

            await addTransaction({
                amount: finalAmount,
                category: 'Income',
                subcategory,
                account_id: selectedAccount.id,
                date: date.toISOString(),
                description
            });
            await refreshData();
            DeviceEventEmitter.emit('RECOMPUTE_SATISFACTION');

            // Trigger Daily Report Update
            try {
                const { scheduleOrUpdateDailyReport } = await import('../services/dailyReportNotification');
                await scheduleOrUpdateDailyReport();
            } catch (e) {
                console.warn("Daily report trigger failed", e);
            }

            // Sound Feedback
            playIncomeSound(soundEnabled);

            setShowSuccess(true);
        } catch (_e) {
            Alert.alert('Error', 'Failed to save income.');
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

    const cycleSource = () => {
        if (incomeSources.length === 0) return;
        const idx = incomeSources.findIndex(s => s.name === subcategory);
        const nextIdx = (idx + 1) % incomeSources.length;
        const nextSource = incomeSources[nextIdx];
        setSubcategory(nextSource.name);
        setSelectedSourceIcon(nextSource.icon);
    }


    if (initializing) {
        return (
            <View style={[commonStyles.screenContainer, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.primary[500]} />
            </View>
        );
    }

    return (
        <TransactionForm
            initialType="income"
            allowTypeSwitch={true}
            accounts={accounts}
            incomeSources={incomeSources}
            display={display}
            setDisplay={setDisplay}
            description={description}
            setDescription={setDescription}
            selectedAccount={selectedAccount}
            setSelectedAccount={setSelectedAccount}
            category={category}
            subcategory={subcategory}
            setSubcategory={setSubcategory}
            date={date}
            setDate={setDate}
            errors={errors}
            onSave={handleSave}
            onClose={() => router.back()}
            isSubmitting={isSubmitting}
            showSuccess={showSuccess}
            onSuccessFinish={() => {
                setShowSuccess(false);
                router.back();
            }}
            successMessage="Income Saved!"
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
        />
    );
}

const styles = StyleSheet.create({
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
    incomeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.success[50],
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        marginTop: 12,
        gap: 6,
    },
    incomeBadgeText: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
        color: Colors.success[700],
        textTransform: 'uppercase',
    },
    mainScroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
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
        backgroundColor: Colors.success[50],
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
    },
});

