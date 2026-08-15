import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle, Check } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../constants/Theme';
import { format } from 'date-fns';

import { Balance, SettlementTransaction, BillExpenseDetails } from '../services/billSplitter';

interface SettlementSummaryProps {
    settlements: SettlementTransaction[];
    balances?: Balance[];
    settledExpenses?: BillExpenseDetails[];
    onMarkSettled?: (settlement: SettlementTransaction) => void;
}

export const SettlementSummary = ({ settlements, balances = [], settledExpenses = [], onMarkSettled }: SettlementSummaryProps) => {
    const hasPending = settlements.length > 0;
    const hasSettled = settledExpenses.length > 0;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Settlement Summary</Text>

            {balances.length > 0 && (
                <View style={styles.calculationBox}>
                    <Text style={styles.calcTitle}>Individual Balances</Text>
                    {balances.map(item => (
                        <View key={item.member_id} style={styles.calcRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.calcName}>{item.member_name}</Text>
                                <Text style={styles.calcDetails}>Spent ₹{item.total_spent.toFixed(0)} • Share ₹{item.total_share.toFixed(0)}</Text>
                            </View>
                            <Text style={[
                                styles.calcAmount,
                                { color: item.amount >= 0.01 ? Colors.success[600] : item.amount <= -0.01 ? Colors.danger[600] : Colors.gray[400] }
                            ]}>
                                {Math.abs(item.amount) < 0.01 ? 'Settled' : `${item.amount > 0 ? '+' : ''}₹${item.amount.toFixed(2)}`}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Pending Settlements */}
            <View style={{ marginBottom: hasSettled ? 24 : 0 }}>
                <Text style={styles.sectionHeaderTitle}>Pending Settlements</Text>
                {hasPending ? (
                    <View style={styles.list}>
                        {settlements.map((item, index) => (
                            <View key={index} style={styles.item}>
                                <View style={styles.personContainer}>
                                    <View style={[styles.avatar, { backgroundColor: Colors.danger[50] }]}>
                                        <Text style={[styles.avatarText, { color: Colors.danger[600] }]}>
                                            {item.from_name.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                    <Text style={styles.name} numberOfLines={1}>{item.from_name}</Text>
                                </View>

                                <View style={styles.amountContainer}>
                                    <Text style={styles.actionText}>pays</Text>
                                    <View style={styles.arrowLine} />
                                    <Text style={styles.amountText}>₹{item.amount.toLocaleString('en-IN')}</Text>
                                    {onMarkSettled && (
                                        <TouchableOpacity
                                            style={styles.settledBtn}
                                            onPress={() => onMarkSettled(item)}
                                        >
                                            <CheckCircle size={14} color={Colors.success[600]} />
                                            <Text style={styles.settledBtnText}>Mark Settled</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <View style={styles.personContainer}>
                                    <View style={[styles.avatar, { backgroundColor: Colors.success[50] }]}>
                                        <Text style={[styles.avatarText, { color: Colors.success[600] }]}>
                                            {item.to_name.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                    <Text style={styles.name} numberOfLines={1}>{item.to_name}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>All balances are currently settled! 🎉</Text>
                    </View>
                )}
            </View>

            {/* Settled History */}
            {hasSettled && (
                <View style={{ marginTop: 8 }}>
                    <Text style={styles.sectionHeaderTitle}>✓ Settled Transactions</Text>
                    <View style={{ gap: 10 }}>
                        {settledExpenses.map(exp => (
                            <View key={exp.id} style={styles.settledCard}>
                                <View style={styles.settledIconBox}>
                                    <Check size={16} color={Colors.success[600]} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.settledTitle}>{exp.title}</Text>
                                    <Text style={styles.settledSub}>{format(new Date(exp.date), 'MMM dd, yyyy')}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.settledAmount}>₹{exp.amount.toLocaleString('en-IN')}</Text>
                                    <View style={styles.settledPill}>
                                        <Text style={styles.settledPillText}>✓ Settled</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.lg,
        padding: 20,
        marginBottom: 20,
        ...Layout.shadows.sm,
    },
    title: {
        fontSize: 18,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        marginBottom: 16,
    },
    calculationBox: {
        backgroundColor: Colors.gray[50],
        borderRadius: 12,
        padding: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: Colors.gray[100],
    },
    calcTitle: {
        fontSize: 12,
        fontFamily: Typography.family.bold,
        color: Colors.gray[500],
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    calcRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    calcName: {
        fontSize: 14,
        color: Colors.gray[800],
        fontFamily: Typography.family.medium,
    },
    calcDetails: {
        fontSize: 11,
        color: Colors.gray[500],
        fontFamily: Typography.family.regular,
        marginTop: 2,
    },
    calcAmount: {
        fontSize: 14,
        fontFamily: Typography.family.bold,
    },
    list: {
        gap: 16,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.gray[50],
        padding: 12,
        borderRadius: 16,
    },
    personContainer: {
        alignItems: 'center',
        width: 70,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    avatarText: {
        fontSize: 18,
        fontFamily: Typography.family.bold,
    },
    name: {
        fontSize: 12,
        color: Colors.gray[900],
        fontFamily: Typography.family.medium,
        textAlign: 'center',
    },
    amountContainer: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    actionText: {
        fontSize: 12,
        color: Colors.gray[500],
        fontFamily: Typography.family.medium,
        marginBottom: 4,
    },
    arrowLine: {
        height: 1,
        width: '100%',
        backgroundColor: Colors.gray[200],
        marginBottom: 4,
    },
    amountText: {
        fontSize: 17,
        fontFamily: Typography.family.bold,
        color: Colors.primary[600],
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    emptyText: {
        fontSize: 16,
        fontFamily: Typography.family.bold,
        color: Colors.success[600],
    },
    settledBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: Colors.success[50],
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 16,
        marginTop: 6,
    },
    settledBtnText: {
        fontSize: 11,
        fontFamily: Typography.family.bold,
        color: Colors.success[700],
    },
    sectionHeaderTitle: {
        fontSize: 14,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    settledCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.success[50] + '60',
        borderColor: Colors.success[200],
        borderWidth: 1,
        padding: 12,
        borderRadius: 14,
    },
    settledIconBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.success[100],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    settledTitle: {
        fontSize: 14,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    settledSub: {
        fontSize: 12,
        color: Colors.gray[500],
        marginTop: 2,
    },
    settledAmount: {
        fontSize: 15,
        fontFamily: Typography.family.bold,
        color: Colors.success[700],
    },
    settledPill: {
        backgroundColor: Colors.success[100],
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginTop: 4,
    },
    settledPillText: {
        fontSize: 10,
        fontFamily: Typography.family.bold,
        color: Colors.success[700],
    },
});
