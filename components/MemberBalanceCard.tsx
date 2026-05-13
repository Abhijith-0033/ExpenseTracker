
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Layout, Typography } from '../constants/Theme';

interface MemberBalanceCardProps {
    name: string;
    amount: number; // +ve = receives, -ve = owes
}

export const MemberBalanceCard = ({ name, amount }: MemberBalanceCardProps) => {
    const isPositive = amount > 0;
    const isZero = Math.abs(amount) < 0.01;

    const color = isZero
        ? Colors.gray[500]
        : isPositive
            ? Colors.success[600]
            : Colors.danger[600];

    const bgColor = isZero
        ? Colors.gray[50]
        : isPositive
            ? Colors.success[50]
            : Colors.danger[50];

    const label = isZero
        ? 'Settled'
        : isPositive
            ? 'Gets back'
            : 'Owes';

    return (
        <View style={[styles.container, { backgroundColor: bgColor, borderColor: isZero ? Colors.gray[200] : 'transparent' }]}>
            <View style={styles.topRow}>
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                <Text style={[styles.label, { color }]}>{label}</Text>
            </View>
            <Text style={[styles.amount, { color }]}>
                ₹{Math.abs(amount).toLocaleString('en-IN')}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        padding: 14,
        minWidth: 120,
        marginRight: 12,
        borderWidth: 1,
        ...Layout.shadows.sm,
    },
    topRow: {
        flexDirection: 'column',
        marginBottom: 6,
    },
    name: {
        fontSize: 14,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        marginBottom: 2,
    },
    label: {
        fontSize: 12,
        fontFamily: Typography.family.medium,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    amount: {
        fontSize: 20,
        fontFamily: Typography.family.bold,
    },
});

