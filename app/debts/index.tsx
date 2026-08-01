import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Modal, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, X } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../../constants/Theme';
import { useTheme } from '../../context/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getDebts, addDebtPerson, deleteDebtPerson, Debt, getAccounts, Account } from '../../services/database';
import { getDebtSummary } from '../../services/debts';
import { DebtOverviewCharts } from '../../components/DebtCharts';
import { DebtCard } from '../../components/DebtCard';
import { formatCurrency } from '../../utils/currency';
import { SwipeableRow } from '../../components/SwipeableRow';
import { FormField } from '../../components/FormField';
import { AccountSelector } from '../../components/AccountSelector';
import { Snackbar } from '../../components/Snackbar';

export default function DebtsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { colors } = useTheme();
    const initialType = params.type as 'debt' | 'receivable' || 'debt';

    const [activeTab, setActiveTab] = useState<'debt' | 'receivable'>(initialType);
    const [debts, setDebts] = useState<Debt[]>([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({ totalDebt: 0, totalReceivable: 0, netPosition: 0 });

    // Add Modal State
    const [isModalVisible, setModalVisible] = useState(false);
    const [newName, setNewName] = useState('');
    const [newAmount, setNewAmount] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [pendingDeleteDebt, setPendingDeleteDebt] = useState<number | null>(null);

    const fetchData = React.useCallback(async () => {
        try {
            const [data, sum, accs] = await Promise.all([
                getDebts(activeTab),
                getDebtSummary(),
                getAccounts()
            ]);
            setDebts(data);
            setSummary(sum);
            setAccounts(accs.filter(a => a.type !== 'meta_categories'));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useFocusEffect(
        React.useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    const handleAdd = async () => {
        if (!newName.trim()) {
            setErrors({ name: 'Name is required' });
            return;
        }
        setErrors({});
        try {
            await addDebtPerson(newName, activeTab, newNotes, parseFloat(newAmount) || 0, selectedAccountId ?? undefined);
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: Colors.white,
    },
    backBtn: { padding: 8, marginLeft: -8 },
    headerTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    tabs: {
        flexDirection: 'row',
        padding: 4,
        margin: 16,
        backgroundColor: Colors.gray[200],
        borderRadius: 12,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    activeTab: {
        backgroundColor: Colors.white,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    tabText: {
        fontFamily: Typography.family.bold,
        fontSize: Typography.size.sm,
        color: Colors.gray[500],
    },
    activeTabText: {
        color: Colors.gray[900],
    },
    scrollContent: { padding: 16 },
    summaryRow: { marginBottom: 20 },
    summaryCard: {
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
    },
    summaryLabel: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.gray[600], marginBottom: 8 },
    summaryValue: { fontSize: Typography.size.xxxl, fontFamily: Typography.family.bold },
    sectionTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, marginBottom: 12, marginTop: 8 },
    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyText: { color: Colors.gray[500], fontFamily: Typography.family.medium },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.primary[600],
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: Colors.primary[600],
        shadowOpacity: 0.4,
        shadowRadius: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        minHeight: 400,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold },
    label: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, marginBottom: 8, color: Colors.gray[700] },
    helpText: { fontSize: 12, color: Colors.gray[500], marginTop: 4, fontFamily: Typography.family.medium },
    input: {
        backgroundColor: Colors.gray[50],
        padding: 16,
        borderRadius: Layout.radius.lg,
        marginBottom: 16,
        fontSize: Typography.size.md,
        fontFamily: Typography.family.medium,
        borderWidth: 1,
        borderColor: Colors.gray[100],
    },
    saveBtn: {
        backgroundColor: Colors.primary[600],
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 16,
    },
    saveBtnText: { color: 'white', fontSize: Typography.size.md, fontFamily: Typography.family.bold },
});
