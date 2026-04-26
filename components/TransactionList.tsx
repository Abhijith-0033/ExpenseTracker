
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { Transaction } from '../services/database';
import { format } from 'date-fns';
import { ArrowUpRight, ArrowDownLeft, ShoppingBag, Coffee, Car, Home, Film, DollarSign, Edit2, Trash2, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors, Layout, Typography } from '../constants/Theme';
import { AnimatedItem } from './ui/AnimatedItem';
import { formatCurrency } from '../utils/currency';
import { useApp } from '../context/AppContext';
import { deleteTransaction } from '../services/database';
import { Alert } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
        Alert.alert(
            "Delete Transaction",
            "Are you sure you want to delete this record?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteTransaction(item.id, item.account_id, item.amount, item.category);
                            await refreshData();
                        } catch (e) {
                            Alert.alert("Error", "Failed to delete transaction");
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item, index }: { item: Transaction, index: number }) => (
        <AnimatedItem index={index}>
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
                        <Text style={[styles.amount, { color: item.category === 'Income' ? Colors.success.text : Colors.gray[900] }]}>
                            {item.category === 'Income' ? '+' : '-'} {formatCurrency(item.amount)}
                        </Text>
                        <Text style={styles.date}>{format(new Date(item.date), 'MMM dd')}</Text>
                    </View>
                </TouchableOpacity>

                {/* Action Buttons */}
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => router.push({ pathname: '/edit-transaction', params: { id: item.id } })}
                    >
                        <Edit2 size={18} color={Colors.gray[500]} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleDelete(item)}
                    >
                        <Trash2 size={18} color={Colors.danger[500]} />
                    </TouchableOpacity>
                </View>
            </View>
        </AnimatedItem>
    );

    const displayedTransactions = limit ? transactions.slice(0, limit) : transactions;

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
                                <Text style={[styles.popupAmount, selectedTx && { color: selectedTx.category === 'Income' ? Colors.success.text : Colors.gray[900] }]}>
                                    {selectedTx?.category === 'Income' ? '+' : '-'} {selectedTx && formatCurrency(selectedTx.amount)}
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
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        marginBottom: 8,
        borderRadius: Layout.radius.lg,
        ...Layout.shadows.sm,
    },
    itemContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: Layout.spacing.md,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
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
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.regular,
        color: Colors.gray[500],
        marginTop: 2,
    },
    rightSection: {
        alignItems: 'flex-end',
    },
    amount: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
    },
    date: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.regular,
        color: Colors.gray[400],
        marginTop: 4,
    },
    actions: {
        flexDirection: 'row',
        paddingRight: 12,
        gap: 4,
        alignItems: 'center',
    },
    actionBtn: {
        padding: 8,
        borderRadius: 8,
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
