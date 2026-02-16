
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Layout } from '../constants/Theme';

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
        borderRadius: 12,
        padding: 12,
        minWidth: 100,
        marginRight: 12,
        borderWidth: 1,
    },
    topRow: {
        flexDirection: 'column',
        marginBottom: 4,
    },
    name: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.gray[900],
        marginBottom: 2,
    },
    label: {
        fontSize: 12,
        fontWeight: '500',
    },
    amount: {
        fontSize: 18,
        fontWeight: '700',
    },
});
