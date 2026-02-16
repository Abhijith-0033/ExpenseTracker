import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { TrendingUp, TrendingDown, Trash2, Clock } from 'lucide-react-native';
import { Colors, Layout } from '../constants/Theme';
import { formatCurrency } from '../utils/currency';
import { formatDistanceToNow } from 'date-fns';
import { Debt } from '../services/database';

interface DebtCardProps {
    item: Debt;
    onPress: () => void;
    onIncrease: () => void;
    onReduce: () => void;
    onDelete: () => void;
}

export const DebtCard: React.FC<DebtCardProps> = ({ item, onPress, onIncrease, onReduce, onDelete }) => {
    const isDebt = item.type === 'debt';
    const color = isDebt ? Colors.danger[500] : Colors.success[500];
    const bg = isDebt ? Colors.danger.bg : Colors.success.bg;

    const renderRightActions = () => {
        return (
            <View style={styles.actionsContainer}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: color }]} onPress={onReduce}>
                    <TrendingDown size={20} color="white" />
                    <Text style={styles.actionText}>Reduce</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isDebt ? Colors.success[500] : Colors.danger[500] }]} onPress={onIncrease}>
                    <TrendingUp size={20} color="white" />
                    <Text style={styles.actionText}>Increase</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.gray[200] }]} onPress={onDelete}>
                    <Trash2 size={20} color={Colors.gray[600]} />
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <Swipeable renderRightActions={renderRightActions}>
            <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
                <View style={[styles.iconContainer, { backgroundColor: bg }]}>
                    {isDebt ?
                        <TrendingDown size={24} color={color} /> :
                        <TrendingUp size={24} color={color} />
                    }
                </View>

                <View style={styles.details}>
                    <View style={styles.header}>
                        <Text style={styles.name}>{item.name}</Text>
                        <Text style={[styles.amount, { color }]}>{formatCurrency(item.amount)}</Text>
                    </View>

                    <View style={styles.footer}>
                        <View style={styles.timeContainer}>
                            <Clock size={12} color={Colors.gray[400]} />
                            <Text style={styles.timeText}>
                                {item.last_updated ? formatDistanceToNow(item.last_updated) + ' ago' : 'Just now'}
                            </Text>
                        </View>
                        {item.notes ? (
                            <Text style={styles.notes} numberOfLines={1}>{item.notes}</Text>
                        ) : null}
                    </View>
                </View>
            </TouchableOpacity>
        </Swipeable>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.white,
        padding: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        ...Layout.shadows.sm,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    details: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.gray[900],
    },
    amount: {
        fontSize: 16,
        fontWeight: '700',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeText: {
        fontSize: 12,
        color: Colors.gray[500],
        marginLeft: 4,
    },
    notes: {
        fontSize: 12,
        color: Colors.gray[400],
        maxWidth: 120,
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        marginLeft: 12,
    },
    actionBtn: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 70,
        height: '100%',
        marginLeft: 4,
        borderRadius: 12,
    },
    actionText: {
        color: 'white',
        fontSize: 10,
        marginTop: 4,
        fontWeight: '600',
    },
});
