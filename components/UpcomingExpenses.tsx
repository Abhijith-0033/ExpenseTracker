import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { getUpcomingExpenses, RechargeMeta } from '../services/database';
import { Colors, Layout } from '../constants/Theme';
import { Smartphone, Clock, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { format, differenceInDays, parseISO } from 'date-fns';
import { formatCurrency } from '../utils/currency';

export const UpcomingExpenses = () => {
    const [upcoming, setUpcoming] = useState<RechargeMeta[]>([]);

    useEffect(() => {
        loadUpcoming();
    }, []);

    const loadUpcoming = async () => {
        try {
            const data = await getUpcomingExpenses();
            setUpcoming(data);
        } catch (e) {
            console.error("Failed to load upcoming expenses", e);
        }
    };

    if (upcoming.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>📅 Upcoming Expenses</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {upcoming.map((item) => {
                    const expiry = parseISO(item.expiry_date);
                    const daysLeft = differenceInDays(expiry, new Date());

                    let statusColor = Colors.success[500];
                    let statusBg = Colors.success[50];
                    if (daysLeft <= 2) {
                        statusColor = Colors.danger[500];
                        statusBg = Colors.danger[50];
                    } else if (daysLeft <= 5) {
                        statusColor = Colors.warning[500];
                        statusBg = Colors.warning[50];
                    }

                    return (
                        <View key={item.id} style={styles.card}>
                            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                                <Text style={[styles.statusText, { color: statusColor }]}>
                                    {daysLeft < 0 ? 'Expired' : `${daysLeft} days left`}
                                </Text>
                            </View>

                            <View style={styles.cardHeader}>
                                <View style={styles.iconContainer}>
                                    <Smartphone size={20} color={Colors.primary[600]} />
                                </View>
                                <View>
                                    <Text style={styles.itemName} numberOfLines={1}>
                                        {item.subcategory || 'Phone Recharge'}
                                    </Text>
                                    <Text style={styles.expiryDate}>Expires {format(expiry, 'MMM dd')}</Text>
                                </View>
                            </View>

                            <View style={styles.footer}>
                                <Text style={styles.amount}>{formatCurrency(item.amount || 0)}</Text>
                                <Clock size={14} color={Colors.gray[400]} style={{ marginLeft: 'auto' }} />
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
    },
    header: {
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.gray[800],
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    scrollContent: {
        paddingRight: 20,
    },
    card: {
        width: 180,
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.xl,
        padding: 16,
        marginRight: 12,
        ...Layout.shadows.sm,
    },
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: Layout.radius.full,
        marginBottom: 12,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: Colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.gray[900],
        width: 100,
    },
    expiryDate: {
        fontSize: 11,
        color: Colors.gray[500],
        marginTop: 2,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: Colors.gray[50],
        paddingTop: 12,
    },
    amount: {
        fontSize: 15,
        fontWeight: '800',
        color: Colors.gray[900],
    }
});
