import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { ScrollView, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { Colors, Typography } from '../../constants/Theme';
import { getGroups, getGroupMembers, getGroupExpenses, deleteGroup, BillGroup } from '../../services/billSplitter';
import { BillGroupCard } from '../../components/BillGroupCard';
import { SwipeableRow } from '../../components/SwipeableRow';
import { ConfirmActionSheet } from '../../components/ConfirmActionSheet';

export default function BillSplitterScreen() {
    const router = useRouter();
    const [groups, setGroups] = useState<BillGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [confirmSheet, setConfirmSheet] = useState<{
        title: string;
        description: string;
        onConfirm: () => void;
    } | null>(null);

    const fetchData = async () => {
        try {
            const data = await getGroups();

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

    const handleDeleteGroup = (group: BillGroup) => {
        setConfirmSheet({
            title: 'Delete Group?',
            description: `Are you sure you want to delete "${group.name}"? All members and expenses will be permanently removed.`,
            onConfirm: async () => {
                setConfirmSheet(null);
                try {
                    await deleteGroup(group.id);
                    fetchData();
                } catch (_e) {
                    Alert.alert('Error', 'Failed to delete group.');
                }
            }
        });
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
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
                    <Text style={styles.bannerText}>Track shared expenses for trips, roommates, or events with friends.</Text>
                </View>

                {/* List */}
                {loading ? (
                    <ActivityIndicator size="large" color={Colors.primary[500]} style={{ marginTop: 40 }} />
                ) : (
                    groups.length > 0 ? (
                        <View style={{ gap: 12 }}>
                            {groups.map((group: any) => (
                                <SwipeableRow
                                    key={group.id}
                                    onDelete={() => handleDeleteGroup(group)}
                                    onEdit={() => router.push(`/bill-splitter/manage-group?id=${group.id}`)}
                                >
                                    <BillGroupCard
                                        group={group}
                                        onPress={() => router.push(`/bill-splitter/group-details?id=${group.id}`)}
                                    />
                                </SwipeableRow>
                            ))}
                        </View>
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

            {confirmSheet && (
                <ConfirmActionSheet
                    visible={!!confirmSheet}
                    title={confirmSheet.title}
                    description={confirmSheet.description}
                    confirmLabel="Delete Group"
                    actionType="delete"
                    onConfirm={confirmSheet.onConfirm}
                    onCancel={() => setConfirmSheet(null)}
                />
            )}
        </View>
        </GestureHandlerRootView>
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
