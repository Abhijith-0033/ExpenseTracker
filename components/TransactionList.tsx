import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Dimensions , Alert } from 'react-native';
import { Transaction , deleteTransaction } from '../services/database';
import { format, addDays } from 'date-fns';
import { ArrowUpRight, ShoppingBag, Coffee, Car, Home, Film, DollarSign, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors, Layout, Typography } from '../constants/Theme';
import { AnimatedItem } from './ui/AnimatedItem';
import { useApp } from '../context/AppContext';


import { SwipeableRow } from './SwipeableRow';
import { RecurringBottomSheet } from './RecurringBottomSheet';
import { addSubscription } from '../services/subscriptions';
import { formatAmount } from '../utils/formatAmount';
import { Snackbar } from './Snackbar';

const { height: _SCREEN_HEIGHT } = Dimensions.get('window');

interface TransactionListProps {
    transactions: Transaction[];
    scrollEnabled?: boolean;
    showTitle?: boolean;
    limit?: number;
}

const DetailRow = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={2}>{value}</Text>
    </View>
);

export const TransactionList: React.FC<TransactionListProps> = ({
    transactions,
    scrollEnabled = false,
    showTitle = true,
    limit = 10
}) => {
    const router = useRouter();
    const { refreshData, accounts } = useApp();
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [recurringTx, setRecurringTx] = useState<Transaction | null>(null);
    const [showRecurring, setShowRecurring] = useState(false);
    const [pendingDeleteTx, setPendingDeleteTx] = useState<Transaction | null>(null);

    const getIcon = (category: string) => {
        switch (category) {
            case 'Food': return <Coffee size={20} color={Colors.warning[500]} />;
            case 'Transport': return <Car size={20} color={Colors.primary[500]} />;
            case 'Housing': return <Home size={20} color={Colors.success[500]} />;
            case 'Entertainment': return <Film size={20} color={Colors.danger[500]} />;
            case 'Shopping': return <ShoppingBag size={20} color={Colors.primary[700]} />;
            case 'Income': return <DollarSign size={20} color={Colors.success.text} />;
            default: return <ArrowUpRight size={20} color={Colors.gray[500]} />;
        }
    };

    const getIconBg = (category: string) => {
        switch (category) {
            case 'Food': return Colors.warning.bg;
            case 'Transport': return Colors.primary[100];
            case 'Housing': return Colors.success.bg;
            case 'Entertainment': return Colors.danger.bg;
            case 'Shopping': return Colors.primary[100];
            case 'Income': return Colors.success.bg;
            default: return Colors.gray[100];
        }
    };

    const handleDelete = (item: Transaction) => {
        setPendingDeleteTx(item);
    };

    const commitDelete = async () => {
        if (!pendingDeleteTx) return;
        try {
            await deleteTransaction(pendingDeleteTx.id, pendingDeleteTx.account_id, pendingDeleteTx.amount, pendingDeleteTx.category);
            await refreshData();
        } catch (_e) {
            Alert.alert("Error", "Failed to delete transaction");
        } finally {
            setPendingDeleteTx(null);
        }
    };

    const handleRecurringSave = async (freq: 'monthly' | 'quarterly' | 'yearly' | 'custom') => {
        if (!recurringTx) return;
        try {
            const daysToAdd = freq === 'quarterly' ? 90 : freq === 'yearly' ? 365 : freq === 'custom' ? 1 : 30;
            await addSubscription({
                name: recurringTx.description || recurringTx.subcategory,
                amount: recurringTx.amount,
                billing_cycle: freq,
                next_renewal_date: format(addDays(new Date(), daysToAdd), 'yyyy-MM-dd'),
                category: recurringTx.category,
                account_id: recurringTx.account_id,
                icon: '🔄',
                color: Colors.primary[500],
                is_active: 1,
                notes: 'Created from history',
                status: 'active',
                reminder_days_before: 3
            });
            setShowRecurring(false);
            setRecurringTx(null);
            Alert.alert("Success", "Subscription added!");
        } catch (_e) {
            Alert.alert("Error", "Failed to add subscription");
        }
    };

    const renderItem = ({ item, index }: { item: Transaction, index: number }) => {
        const amtType = item.category === 'Income' ? 'income' : item.category === 'Transfer' ? 'transfer' : 'expense';
        const { text: amtText, color: amtColor } = formatAmount(item.amount, amtType as any);

        return (
            <AnimatedItem index={index}>
                <SwipeableRow
                    onDelete={() => handleDelete(item)}
                    onEdit={() => router.push({ pathname: '/edit-transaction', params: { id: item.id } })}
                    onDuplicate={() => router.push({ 
                        pathname: '/(tabs)/add', 
                        params: { 
                            prefill_amount: item.amount.toString(), 
                            prefill_category: item.category, 
                            prefill_account_id: item.account_id.toString(),
                            prefill_description: item.description 
                        } 
                    })}
                    onRepeat={() => {
                        setRecurringTx(item);
                        setShowRecurring(true);
                    }}
                    deleteConfirmTitle="Delete Transaction"
                    deleteConfirmMessage="Are you sure you want to delete this record?"
                >
                    <View style={styles.item}>
                        <TouchableOpacity
                            style={styles.itemContent}
                            activeOpacity={0.7}
                            onPress={() => setSelectedTx(item)}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: getIconBg(item.category) }]}>
                                {getIcon(item.category)}
                            </View>
                            <View style={styles.details}>
                                <Text style={styles.category}>{item.category}</Text>
                                <Text style={styles.subcategory}>{item.subcategory}</Text>
                            </View>
                            <View style={styles.rightSection}>
                                <Text style={[styles.amount, { color: amtColor }]}>
                                    {amtText}
                                </Text>
                                <Text style={styles.date}>{format(new Date(item.date), 'MMM dd')}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </SwipeableRow>
            </AnimatedItem>
        );
    };

    const validTransactions = transactions.filter(t => t.id !== pendingDeleteTx?.id);
    const displayedTransactions = limit ? validTransactions.slice(0, limit) : validTransactions;

    const accountName = selectedTx ? accounts.find(a => a.id === selectedTx.account_id)?.name || 'Default Account' : '';

    return (
        <View style={styles.container}>
            {showTitle && <Text style={styles.title}>Recent Activity</Text>}
            {transactions.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.empty}>No transactions yet</Text>
                    <Text style={styles.emptySub}>Start by adding a new expense</Text>
                </View>
            ) : (
                <FlatList
                    data={displayedTransactions}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    scrollEnabled={scrollEnabled}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    initialNumToRender={15}
                    maxToRenderPerBatch={10}
                />
            )}

            {/* Detail Popup Modal */}
            <Modal
                visible={!!selectedTx}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedTx(null)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setSelectedTx(null)}
                >
                    <View style={styles.popupContent}>
                        <View style={styles.popupHandle} />

                        <View style={styles.popupHeader}>
                            <View style={[styles.popupIconContainer, selectedTx && { backgroundColor: getIconBg(selectedTx.category) }]}>
                                {selectedTx && getIcon(selectedTx.category)}
                            </View>
                            <View>
                                <Text style={styles.popupTitle}>{selectedTx?.category}</Text>
                                <Text style={[styles.popupAmount, selectedTx && { color: formatAmount(selectedTx.amount, selectedTx.category === 'Income' ? 'income' : 'expense').color }]}>
                                    {selectedTx && formatAmount(selectedTx.amount, selectedTx.category === 'Income' ? 'income' : 'expense').text}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedTx(null)}>
                                <X size={20} color={Colors.gray[400]} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.detailContainer}>
                            <DetailRow label="Sub Category" value={selectedTx?.subcategory || 'N/A'} />
                            <DetailRow label="Account" value={accountName} />
                            <DetailRow label="Description" value={selectedTx?.description || 'No description provided'} />
                            <DetailRow label="Date" value={selectedTx ? format(new Date(selectedTx.date), 'EEEE, dd MMMM yyyy') : ''} />
                            <DetailRow label="Time" value={selectedTx ? format(new Date(selectedTx.date), 'hh:mm a') : ''} />
                        </View>

                        <TouchableOpacity
                            style={styles.editFullBtn}
                            onPress={() => {
                                const id = selectedTx?.id;
                                setSelectedTx(null);
                                if (id) router.push({ pathname: '/edit-transaction', params: { id } });
                            }}
                        >
                            <Text style={styles.editFullBtnText}>Edit Transaction</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <RecurringBottomSheet
                visible={showRecurring}
                onClose={() => setShowRecurring(false)}
                transaction={recurringTx}
                onSave={handleRecurringSave}
            />

            <Snackbar 
                visible={!!pendingDeleteTx}
                message="Transaction deleted"
                onUndo={() => setPendingDeleteTx(null)}
                onDismiss={commitDelete}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: Layout.spacing.lg,
    },
    title: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        marginBottom: Layout.spacing.md,
        color: Colors.gray[900],
        marginLeft: Layout.spacing.xs,
    },
    item: {
        backgroundColor: Colors.white,
        marginBottom: 12,
        borderRadius: 24,
    },
    itemContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 20,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    details: {
        flex: 1,
    },
    category: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    subcategory: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.medium,
        color: Colors.gray[500],
        marginTop: 4,
    },
    rightSection: {
        alignItems: 'flex-end',
    },
    amount: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
    },
    date: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.medium,
        color: Colors.gray[400],
        marginTop: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40,
        backgroundColor: Colors.gray[50],
        borderRadius: Layout.radius.lg,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: Colors.gray[200],
    },
    empty: {
        color: Colors.gray[600],
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
    },
    emptySub: {
        color: Colors.gray[400],
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.medium,
        marginTop: 4,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    popupContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
        ...Layout.shadows.lg,
    },
    popupHandle: {
        width: 40,
        height: 4,
        backgroundColor: Colors.gray[200],
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 24,
    },
    popupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 32,
    },
    popupIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    popupTitle: {
        fontSize: Typography.size.md,
        color: Colors.gray[500],
        fontFamily: Typography.family.bold,
    },
    popupAmount: {
        fontSize: Typography.size.xxl,
        fontFamily: Typography.family.bold,
        marginTop: 2,
    },
    closeBtn: {
        marginLeft: 'auto',
        padding: 8,
        backgroundColor: Colors.gray[50],
        borderRadius: 20,
    },
    detailContainer: {
        marginBottom: 32,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[50],
    },
    detailLabel: {
        fontSize: Typography.size.sm,
        color: Colors.gray[400],
        fontFamily: Typography.family.bold,
    },
    detailValue: {
        fontSize: Typography.size.sm,
        color: Colors.gray[900],
        fontFamily: Typography.family.bold,
        maxWidth: '65%',
        textAlign: 'right',
    },
    editFullBtn: {
        backgroundColor: Colors.primary[600],
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        ...Layout.shadows.md,
    },
    editFullBtnText: {
        color: Colors.white,
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
    },
});
