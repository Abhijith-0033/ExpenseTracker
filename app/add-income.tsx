
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import { addTransaction, getCategories, getIncomeSources } from '../services/database';
import { Keypad } from '../components/ui/Keypad';
import { Calendar as CalendarIcon, Wallet as WalletIcon, Tag as TagIcon, X, Briefcase, TrendingUp, Gift, DollarSign, Home, Globe, User } from 'lucide-react-native';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Layout } from '../constants/Theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '../utils/currency';

export default function AddIncomeScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { accounts, refreshData } = useApp();

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

    useEffect(() => {
        if (accounts.length > 0 && !selectedAccount) {
            setSelectedAccount(accounts[0]);
        }
        loadIncomeSources();
    }, [accounts, selectedAccount]);

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

        try {
            await addTransaction({
                amount: finalAmount,
                category: 'Income',
                subcategory,
                account_id: selectedAccount.id,
                date: date.toISOString(),
                description
            });
            await refreshData();
            router.back();
        } catch (e) {
            Alert.alert('Error', 'Failed to save income.');
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
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
                    <X size={24} color={Colors.gray[600]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add Income</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Main Display - Green for Income */}
            <View style={styles.displayContainer}>
                <Text style={[styles.currencySymbol, { color: Colors.success[500] }]}>₹</Text>
                <Text style={[styles.amountDisplay, { color: Colors.success.text }]} numberOfLines={1} adjustsFontSizeToFit>{display}</Text>
            </View>

            <View style={styles.formContainer}>
                {/* Row 1: Date & Account */}
                <View style={styles.selectorsRow}>
                    <TouchableOpacity style={styles.pill} onPress={() => setShowDatePicker(true)}>
                        <CalendarIcon size={18} color={Colors.success[500]} />
                        <Text style={styles.pillText}>{format(date, 'MMM dd, yyyy')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.pill} onPress={cycleAccount}>
                        <WalletIcon size={18} color={Colors.success[500]} />
                        <Text style={styles.pillText}>
                            {selectedAccount ? selectedAccount.name : 'Select Account'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Source Selection (Simple Toggle for now, mirroring category style) */}
                <TouchableOpacity style={[styles.pill, styles.widePill]} onPress={cycleSource}>
                    {/* Simple dynamic icon render */}
                    {selectedSourceIcon === 'Briefcase' && <Briefcase size={20} color={Colors.success[500]} />}
                    {selectedSourceIcon === 'Tag' && <TagIcon size={20} color={Colors.success[500]} />}
                    {selectedSourceIcon === 'TrendingUp' && <TrendingUp size={20} color={Colors.success[500]} />}
                    {selectedSourceIcon === 'Gift' && <Gift size={20} color={Colors.success[500]} />}
                    {selectedSourceIcon === 'DollarSign' && <DollarSign size={20} color={Colors.success[500]} />}
                    {selectedSourceIcon === 'Home' && <Home size={20} color={Colors.success[500]} />}
                    {selectedSourceIcon === 'Globe' && <Globe size={20} color={Colors.success[500]} />}
                    {selectedSourceIcon === 'User' && <User size={20} color={Colors.success[500]} />}
                    {/* Fallback */}
                    {!['Briefcase', 'Tag', 'TrendingUp', 'Gift', 'DollarSign', 'Home', 'Globe', 'User'].includes(selectedSourceIcon) && <DollarSign size={20} color={Colors.success[500]} />}
                    <Text style={styles.pillText}>
                        Source: {subcategory}
                    </Text>
                    <Text style={styles.hint}>(Tap to change)</Text>
                </TouchableOpacity>

                {/* Note Input */}
                <TextInput
                    placeholder="Add a note (optional)"
                    placeholderTextColor={Colors.gray[400]}
                    value={description}
                    onChangeText={setDescription}
                    style={styles.input}
                />
            </View>

            <View style={{ flex: 1 }} />

            <Keypad
                onPress={handleKeyPress}
                onDelete={handleDelete}
                onClear={handleClear}
                onSubmit={handleSave}
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.success.bg, // Light green background
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
        marginRight: 8,
        fontWeight: '500',
    },
    amountDisplay: {
        fontSize: 64,
        fontWeight: '700',
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
        justifyContent: 'flex-start',
    },
    pillText: {
        marginLeft: 10,
        fontSize: 15,
        color: Colors.gray[800],
        fontWeight: '600',
    },
    hint: {
        marginLeft: 'auto',
        fontSize: 12,
        color: Colors.gray[400],
    },
    input: {
        backgroundColor: Colors.white,
        padding: 16,
        borderRadius: Layout.radius.lg,
        fontSize: 16,
        color: Colors.gray[800],
        ...Layout.shadows.sm,
    },
});
