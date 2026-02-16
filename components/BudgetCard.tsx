import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Colors, Layout } from '../constants/Theme';
import { BudgetStatus, deleteBudget } from '../services/budgets';
import { Trash2, Edit2 } from 'lucide-react-native';
import { formatCurrency } from '../utils/currency';

interface BudgetCardProps {
    data: BudgetStatus;
    onEdit: (category: string, amount: number) => void;
    onDelete: () => void;
}

export const BudgetCard: React.FC<BudgetCardProps> = ({ data, onEdit, onDelete }) => {
    // Color logic
    let progressColor = Colors.success[500];
    if (data.percentage >= 100) progressColor = Colors.danger[500];
    else if (data.percentage >= 70) progressColor = Colors.warning[500];

    const width = Math.min(data.percentage, 100);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.category}>{data.category}</Text>
                <View style={styles.actions}>
                    <TouchableOpacity onPress={() => onEdit(data.category, data.budget)} style={styles.actionBtn}>
                        <Edit2 size={16} color={Colors.gray[500]} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
                        <Trash2 size={16} color={Colors.danger[500]} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.numbers}>
                <Text style={styles.spent}>{formatCurrency(data.spent)}</Text>
                <Text style={styles.total}> / {formatCurrency(data.budget)}</Text>
            </View>

            <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${width}%`, backgroundColor: progressColor }]} />
            </View>

            <View style={styles.footer}>
                <Text style={[styles.statusText, { color: progressColor }]}>
                    {data.remaining >= 0
                        ? `${formatCurrency(data.remaining)} remaining`
                        : `${formatCurrency(Math.abs(data.remaining))} over budget`}
                </Text>
                <Text style={styles.percentage}>{Math.round(data.percentage)}%</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.lg,
        padding: Layout.spacing.md,
        marginBottom: Layout.spacing.sm,
        ...Layout.shadows.sm,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    category: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.gray[900],
    },
    actions: {
        flexDirection: 'row',
    },
    actionBtn: {
        padding: 4,
        marginLeft: 8,
    },
    numbers: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 8,
    },
    spent: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.gray[900],
    },
    total: {
        fontSize: 14,
        color: Colors.gray[500],
    },
    progressContainer: {
        height: 8,
        backgroundColor: Colors.gray[100],
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBar: {
        height: '100%',
        borderRadius: 4,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    percentage: {
        fontSize: 12,
        color: Colors.gray[500],
    },
});
