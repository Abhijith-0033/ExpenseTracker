
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Transaction } from '../services/database';
import { format } from 'date-fns';
import { ArrowUpRight, ArrowDownLeft, ShoppingBag, Coffee, Car, Home, Film, DollarSign, Edit2, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors, Layout } from '../constants/Theme';
import { AnimatedItem } from './ui/AnimatedItem';
import { formatCurrency } from '../utils/currency';
import { useApp } from '../context/AppContext';
import { deleteTransaction } from '../services/database';
import { Alert } from 'react-native';

interface TransactionListProps {
    transactions: Transaction[];
    scrollEnabled?: boolean;
    showTitle?: boolean;
    limit?: number;
}

export const TransactionList: React.FC<TransactionListProps> = ({
    transactions,
    scrollEnabled = false,
    showTitle = true,
    limit = 10
}) => {
    const router = useRouter();
    const { refreshData } = useApp();

    const getIcon = (category: string) => {
        // ... (keep as is)
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
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: Layout.spacing.lg,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: Layout.spacing.md,
        color: Colors.gray[900],
        marginLeft: Layout.spacing.xs,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: Layout.spacing.md,
        backgroundColor: Colors.white,
        marginBottom: 8,
        borderRadius: Layout.radius.lg,
        ...Layout.shadows.sm,
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
        fontSize: 16,
        fontWeight: '600',
        color: Colors.gray[900],
    },
    subcategory: {
        fontSize: 13,
        color: Colors.gray[500],
        marginTop: 2,
    },
    rightSection: {
        alignItems: 'flex-end',
    },
    amount: {
        fontSize: 16,
        fontWeight: '700',
    },
    date: {
        fontSize: 12,
        color: Colors.gray[400],
        marginTop: 4,
    },
    actions: {
        flexDirection: 'row',
        marginLeft: 12,
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
        fontSize: 16,
        fontWeight: '600',
    },
    emptySub: {
        color: Colors.gray[400],
        fontSize: 14,
        marginTop: 4,
    }
});
