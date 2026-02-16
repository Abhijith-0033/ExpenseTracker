
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowRight, ArrowLeft } from 'lucide-react-native';
import { Colors, Layout } from '../constants/Theme';

interface SettlementSummaryProps {
    settlements: {
        from_name: string;
        to_name: string;
        amount: number;
    }[];
}

export const SettlementSummary = ({ settlements }: SettlementSummaryProps) => {
    if (settlements.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>All settled up! 🎉</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>How to Settle Up</Text>
            <View style={styles.list}>
                {settlements.map((item, index) => (
                    <View key={index} style={styles.item}>
                        <View style={styles.personContainer}>
                            <View style={[styles.avatar, { backgroundColor: Colors.danger[100] }]}>
                                <Text style={[styles.avatarText, { color: Colors.danger[700] }]}>
                                    {item.from_name.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                            <Text style={styles.name} numberOfLines={1}>{item.from_name}</Text>
                        </View>

                        <View style={styles.amountContainer}>
                            <Text style={styles.actionText}>pays</Text>
                            <View style={styles.arrowLine} />
                            <Text style={styles.amountText}>₹{item.amount}</Text>
                        </View>

                        <View style={styles.personContainer}>
                            <View style={[styles.avatar, { backgroundColor: Colors.success[100] }]}>
                                <Text style={[styles.avatarText, { color: Colors.success[700] }]}>
                                    {item.to_name.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                            <Text style={styles.name} numberOfLines={1}>{item.to_name}</Text>
                        </View>
                    </View>
                ))}
            </View>
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
        fontWeight: '700',
        color: Colors.gray[900],
        marginBottom: 16,
    },
    list: {
        gap: 16,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    personContainer: {
        alignItems: 'center',
        width: 60,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    avatarText: {
        fontSize: 16,
        fontWeight: '700',
    },
    name: {
        fontSize: 12,
        color: Colors.gray[900],
        fontWeight: '500',
        textAlign: 'center',
    },
    amountContainer: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    actionText: {
        fontSize: 12,
        color: Colors.gray[400],
        marginBottom: 4,
    },
    arrowLine: {
        height: 1,
        width: '100%',
        backgroundColor: Colors.gray[200],
        marginBottom: 4,
    },
    amountText: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.gray[900],
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.success[600],
    },
});
