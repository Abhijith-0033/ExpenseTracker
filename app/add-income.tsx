
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, StatusBar, Dimensions, ScrollView, DeviceEventEmitter } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import { addTransaction, getCategories, getIncomeSources } from '../services/database';
import { playIncomeSound } from '../services/SoundService';
import { Keypad } from '../components/ui/Keypad';
import { Calendar as CalendarIcon, Wallet as WalletIcon, Tag as TagIcon, X, Briefcase, TrendingUp, Gift, DollarSign, Home, Globe, User, ChevronDown } from 'lucide-react-native';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Layout, Typography } from '../constants/Theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '../utils/currency';
import { PressableScale } from '../components/ui/PressableScale';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { SuccessAnimation } from '../components/SuccessAnimation';

export default function AddIncomeScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { accounts, refreshData, soundEnabled } = useApp();

    const [display, setDisplay] = useState('0');
    const [description, setDescription] = useState('');
    const [selectedAccount, setSelectedAccount] = useState<any>(null);
    // Fixed category for Income, but subcategory is selectable
    const category = 'Income';
    const [subcategory, setSubcategory] = useState('Salary');
    const [incomeSources, setIncomeSources] = useState<any[]>([]);
    const [selectedSourceIcon, setSelectedSourceIcon] = useState('Briefcase');
    const [date, setDate] = useState(new Date());

    const [showSourcePicker, setShowSourcePicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        if (accounts.length > 0 && !selectedAccount) {
            setSelectedAccount(accounts[0]);
        }
        loadIncomeSources();
    }, [accounts, selectedAccount]);

    useFocusEffect(
        React.useCallback(() => {
            setShowSuccess(false);
            setDisplay('0');
            setDescription('');
        }, [])
    );

    const loadIncomeSources = async () => {
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
    };

    const handleKeyPress = (val: string) => {
        setDisplay(prev => {
            if (prev === '0' && !['+', '-', '*', '/', '.'].includes(val)) return val;
            if (['+', '-', '*', '/', '.'].includes(val) && ['+', '-', '*', '/', '.'].includes(prev.slice(-1))) return prev;
            return prev + val;
        });
    };

    const handleDelete = () => {
        setDisplay(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    };

    const handleClear = () => setDisplay('0');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = React.useRef(false);

    const handleSave = async () => {
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
        if (!selectedAccount) {
            Alert.alert('Account Required', 'Please select an account');
            return;
        }

        if (isSubmittingRef.current) return;

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

            // Sound Feedback
            playIncomeSound(soundEnabled);

            setShowSuccess(true);
        } catch (e) {
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


    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
            <StatusBar barStyle="dark-content" />

            <LinearGradient
                colors={['rgba(34, 197, 94, 0.08)', 'rgba(255, 255, 255, 0)']}
                style={StyleSheet.absoluteFill}
            />

            {/* Header */}
            <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
                <PressableScale onPress={() => router.back()} style={styles.closeBtn}>
                    <X size={24} color={Colors.gray[800]} />
                </PressableScale>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerSubtitle}>Adding Money</Text>
                    <Text style={styles.headerTitle}>New Income</Text>
                </View>
                <View style={{ width: 44 }} />
            </Animated.View>

            <ScrollView
                style={styles.mainScroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Main Display - Special focus on the number */}
                <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.displayContainer}>
                    <View style={styles.amountWrapper}>
                        <Text style={[styles.currencySymbol, { color: Colors.success[600] }]}>₹</Text>
                        <Text style={styles.amountDisplay} numberOfLines={1} adjustsFontSizeToFit>{display}</Text>
                    </View>
                    <View style={styles.incomeBadge}>
                        <TrendingUp size={14} color={Colors.success[700]} />
                        <Text style={styles.incomeBadgeText}>Income Entry</Text>
                    </View>
                </Animated.View>

                {/* Row 1: Date & Account */}
                <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.selectorsRow}>
                    <PressableScale style={[styles.pill, { flex: 1 }]} onPress={() => setShowDatePicker(true)}>
                        <View style={styles.pillIconContainer}>
                            <CalendarIcon size={20} color={Colors.success[600]} />
                        </View>
                        <View style={styles.pillContent}>
                            <Text style={styles.pillLabel}>Date</Text>
                            <Text style={styles.pillValue}>{format(date, 'MMM dd, yyyy')}</Text>
                        </View>
                    </PressableScale>

                    <PressableScale style={[styles.pill, { flex: 1 }]} onPress={cycleAccount}>
                        <View style={styles.pillIconContainer}>
                            <WalletIcon size={20} color={Colors.success[600]} />
                        </View>
                        <View style={styles.pillContent}>
                            <Text style={styles.pillLabel}>Account</Text>
                            <Text style={styles.pillValue} numberOfLines={1}>
                                {selectedAccount ? selectedAccount.name : 'Select'}
                            </Text>
                        </View>
                    </PressableScale>
                </Animated.View>

                {/* Source Selection */}
                <Animated.View entering={FadeInDown.delay(300).duration(600)}>
                    <PressableScale style={[styles.pill, styles.widePill]} onPress={cycleSource}>
                        <View style={styles.pillIconContainer}>
                            {/* Simple dynamic icon render */}
                            {selectedSourceIcon === 'Briefcase' && <Briefcase size={24} color={Colors.success[600]} />}
                            {selectedSourceIcon === 'Tag' && <TagIcon size={24} color={Colors.success[600]} />}
                            {selectedSourceIcon === 'TrendingUp' && <TrendingUp size={24} color={Colors.success[600]} />}
                            {selectedSourceIcon === 'Gift' && <Gift size={24} color={Colors.success[600]} />}
                            {selectedSourceIcon === 'DollarSign' && <DollarSign size={24} color={Colors.success[600]} />}
                            {selectedSourceIcon === 'Home' && <Home size={24} color={Colors.success[600]} />}
                            {selectedSourceIcon === 'Globe' && <Globe size={24} color={Colors.success[600]} />}
                            {selectedSourceIcon === 'User' && <User size={24} color={Colors.success[600]} />}
                            {!['Briefcase', 'Tag', 'TrendingUp', 'Gift', 'DollarSign', 'Home', 'Globe', 'User'].includes(selectedSourceIcon) && <DollarSign size={24} color={Colors.success[600]} />}
                        </View>
                        <View style={styles.pillContent}>
                            <Text style={styles.pillLabel}>Income Source</Text>
                            <Text style={styles.pillValue}>{subcategory}</Text>
                        </View>
                        <View style={styles.cycleIcon}>
                            <ChevronDown size={14} color={Colors.gray[400]} />
                        </View>
                    </PressableScale>
                </Animated.View>

                {/* Note Input */}
                <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.noteWrapper}>
                    <TextInput
                        placeholder="Add a remark for this entry..."
                        placeholderTextColor={Colors.gray[400]}
                        value={description}
                        onChangeText={setDescription}
                        style={styles.input}
                    />
                </Animated.View>
            </ScrollView>

            <Animated.View entering={FadeInUp.delay(500).duration(600)}>
                <Keypad
                    onPress={handleKeyPress}
                    onDelete={handleDelete}
                    onClear={handleClear}
                    onSubmit={handleSave}
                    submitColor={Colors.success[600]}
                    submitLabel="Save Income"
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

            <SuccessAnimation 
                visible={showSuccess} 
                onAnimationFinish={() => {
                    setShowSuccess(false);
                    router.back();
                }} 
                message="Income Saved!"
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
    input: {
        padding: 16,
        fontSize: Typography.size.md,
        color: Colors.gray[800],
        fontFamily: Typography.family.medium,
    },
});

