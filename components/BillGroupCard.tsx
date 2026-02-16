
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Users, Receipt, Calendar } from 'lucide-react-native';
import { Colors, Layout } from '../constants/Theme';
import { BillGroup } from '../services/billSplitter';
import { format } from 'date-fns';

interface BillGroupCardProps {
    group: BillGroup & { member_count: number; expense_count: number; total_expenses: number };
    onPress: () => void;
}

export const BillGroupCard = ({ group, onPress }: BillGroupCardProps) => {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Users size={24} color={Colors.primary[600]} />
                </View>
                <View style={styles.headerText}>
                    <Text style={styles.title} numberOfLines={1}>{group.name}</Text>
                    {group.description ? (
                        <Text style={styles.description} numberOfLines={1}>{group.description}</Text>
                    ) : null}
                </View>
                <View style={styles.dateContainer}>
                    <Text style={styles.dateText}>{format(new Date(group.last_updated), 'MMM d')}</Text>
                </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Users size={14} color={Colors.gray[500]} />
                    <Text style={styles.statText}>{group.member_count} Members</Text>
                </View>
                <View style={styles.statItem}>
                    <Receipt size={14} color={Colors.gray[500]} />
                    <Text style={styles.statText}>{group.expense_count} Expenses</Text>
                </View>
                <View style={[styles.statItem, { flex: 1, justifyContent: 'flex-end' }]}>
                    <Text style={styles.totalLabel}>Total: </Text>
                    <Text style={styles.totalValue}>₹{group.total_expenses.toLocaleString('en-IN')}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.lg,
        padding: 16,
        marginBottom: 16,
        ...Layout.shadows.sm,
        borderWidth: 1,
        borderColor: Colors.gray[100],
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.gray[900],
        marginBottom: 2,
    },
    description: {
        fontSize: 14,
        color: Colors.gray[500],
    },
    dateContainer: {
        backgroundColor: Colors.gray[50],
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    dateText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.gray[600],
    },
    divider: {
        height: 1,
        backgroundColor: Colors.gray[100],
        marginVertical: 12,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    statText: {
        fontSize: 13,
        color: Colors.gray[600],
        marginLeft: 6,
        fontWeight: '500',
    },
    totalLabel: {
        fontSize: 13,
        color: Colors.gray[500],
    },
    totalValue: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.primary[700],
    },
});
