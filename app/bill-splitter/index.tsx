
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, Search } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../../constants/Theme';
import { getGroups, getGroupMembers, getGroupExpenses, BillGroup } from '../../services/billSplitter';
import { BillGroupCard } from '../../components/BillGroupCard';

export default function BillSplitterScreen() {
    const router = useRouter();
    const [groups, setGroups] = useState<BillGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            // Need to fetch stats too. For now, mock or update service to return stats?
            // The service returns BillGroup. Let's assume for list view we might need to fetch stats separately
            // OR update getGroups to do a JOIN.
            // For MVP efficiency, let's just fetch basic groups and maybe details later?
            // Actually, the card needs stats. Let's use getGroups as is but we'll need to 
            // query member count and expense total for each.
            // Since SQLite is local, N+1 query isn't terrible for small lists, but a JOIN is better.
            // For now, let's just fetch groups and then for each group fetch stats in parallel.

            const data = await getGroups();

            // To properly show stats, we'd need to extend the service to return these counts.
            // But since I can't easily change database.ts/billSplitter.ts concurrently here without complexity,
            // I'll make a quick "enriched" fetch here or just show basic info first.
            // Let's assume I'll update billSplitter.ts to return enriched data or do it here.

            const enriched = await Promise.all(data.map(async (g) => {
                const members = await getGroupMembers(g.id);
                const expenses = await getGroupExpenses(g.id);
                const total = expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);

                return {
                    ...g,
                    member_count: members.length,
                    expense_count: expenses.length,
                    total_expenses: total
                };
            }));

            setGroups(enriched);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchData();
        }, [])
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={Colors.gray[900]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Split Bills</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
            >
                {/* Intro / Banner */}
                <View style={styles.banner}>
                    <Text style={styles.bannerTitle}>Group Expenses</Text>
                    <Text style={styles.bannerText}>Track shared potential expenses for trips, roommates, or events.</Text>
                </View>

                {/* List */}
                {loading ? (
                    <ActivityIndicator size="large" color={Colors.primary[500]} style={{ marginTop: 40 }} />
                ) : (
                    groups.length > 0 ? (
                        groups.map((group: any) => (
                            <BillGroupCard
                                key={group.id}
                                group={group}
                                onPress={() => router.push(`/bill-splitter/group-details?id=${group.id}`)}
                            />
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>✈️</Text>
                            <Text style={styles.emptyTitle}>No groups yet</Text>
                            <Text style={styles.emptyText}>Create a group to start splitting bills!</Text>
                        </View>
                    )
                )}

                <View style={{ height: 80 }} />
            </ScrollView>

            {/* FAB */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push('/bill-splitter/manage-group')}
            >
                <Plus size={32} color="white" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.gray[50] },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[100],
    },
    backBtn: { padding: 4, marginLeft: -4 },
    headerTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    scrollContent: { padding: 20 },
    banner: {
        marginBottom: 24,
    },
    bannerTitle: {
        fontSize: Typography.size.xxl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        marginBottom: 4,
    },
    bannerText: {
        fontSize: Typography.size.sm,
        color: Colors.gray[500],
        lineHeight: 20,
        fontFamily: Typography.family.regular,
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 60,
        padding: 40,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        marginBottom: 8,
    },
    emptyText: {
        textAlign: 'center',
        color: Colors.gray[500],
        lineHeight: 24,
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.regular,
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.primary[600],
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: Colors.primary[600],
        shadowOpacity: 0.4,
        shadowRadius: 10,
    },
});
