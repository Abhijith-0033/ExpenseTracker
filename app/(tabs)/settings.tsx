import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { ChevronRight, Wallet, Tag, Database, Bell, FileUp, FileDown, FileText, Info, Calendar, Users, Target, CalendarClock, RefreshCw, FileBarChart } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { checkReminderStatus, scheduleDailyReminder } from '../../services/notifications';
import { exportData, exportCSV, restoreData } from '../../services/backup';
import { UpcomingExpenses } from '../../components/UpcomingExpenses';

export default function SettingsScreen() {
    const router = useRouter();
    const { soundEnabled, setSoundEnabled } = useApp();
    const [reminderEnabled, setReminderEnabled] = useState(true);

    useEffect(() => {
        checkReminderStatus().then(setReminderEnabled);
    }, []);

    const toggleReminder = async (val: boolean) => {
        const success = await scheduleDailyReminder(val);
        if (success) {
            setReminderEnabled(val);
        } else {
            // If failed (likely permission denied), revert visual state and alert
            setReminderEnabled(false);
            Alert.alert(
                'Permission Required',
                'Notifications are disabled. Please enable them in your device settings to receive reminders.',
                [{ text: 'OK' }]
            );
        }
    };

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.headerTitle}>Settings</Text>

            <View style={{ marginBottom: 20 }}>
                <UpcomingExpenses />
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>General</Text>

                <TouchableOpacity
                    style={styles.row}
                    onPress={() => router.push('/notification-settings' as any)}
                >
                    <View style={[styles.rowIcon, { backgroundColor: '#F3E8FF' }]}>
                        <Bell size={20} color="#7C3AED" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowText}>Notifications</Text>
                        <Text style={styles.rowSubtext}>Manage alerts and reminders</Text>
                    </View>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.row}
                    onPress={() => router.push('/manage-accounts')}
                >
                    <View style={styles.rowIcon}>
                        <Wallet size={20} color="#2563eb" />
                    </View>
                    <Text style={styles.rowText}>Manage Accounts</Text>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.row}
                    onPress={() => router.push('/manage-categories')}
                >
                    <View style={styles.rowIcon}>
                        <Tag size={20} color="#7c3aed" />
                    </View>
                    <Text style={styles.rowText}>Manage Categories</Text>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.row}
                    onPress={() => router.push('/manage-income-sources')}
                >
                    <View style={styles.rowIcon}>
                        <Wallet size={20} color="#059669" />
                    </View>
                    <Text style={styles.rowText}>Manage Income Sources</Text>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>

                <Link href="/(tabs)/calendar" asChild>
                    <TouchableOpacity style={styles.row}>
                        <View style={styles.rowIcon}>
                            <Calendar size={20} color={Colors.primary[600]} />
                        </View>
                        <Text style={styles.rowText}>Calendar View</Text>
                        <ChevronRight size={20} color={Colors.gray[400]} />
                    </TouchableOpacity>
                </Link>

                <Link href="/bill-splitter" asChild>
                    <TouchableOpacity style={styles.row}>
                        <View style={styles.rowIcon}>
                            <Users size={20} color={Colors.primary[600]} />
                        </View>
                        <Text style={styles.rowText}>Split Bills / Groups</Text>
                        <ChevronRight size={20} color={Colors.gray[400]} />
                    </TouchableOpacity>
                </Link>
            </View>

            {/* Features Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Features</Text>
                
                <TouchableOpacity style={styles.row} onPress={() => router.push('/savings-goals' as any)}>
                    <View style={[styles.rowIcon, { backgroundColor: '#F3E8FF' }]}>
                        <Target size={20} color="#7C3AED" />
                    </View>
                    <Text style={styles.rowText}>Savings Goals</Text>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.row} onPress={() => router.push('/cash-flow' as any)}>
                    <View style={[styles.rowIcon, { backgroundColor: '#DBEAFE' }]}>
                        <CalendarClock size={20} color="#2563EB" />
                    </View>
                    <Text style={styles.rowText}>Cash Flow Calendar</Text>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.row} onPress={() => router.push('/subscriptions' as any)}>
                    <View style={[styles.rowIcon, { backgroundColor: '#FCE4EC' }]}>
                        <RefreshCw size={20} color="#E91E63" />
                    </View>
                    <Text style={styles.rowText}>Subscriptions Tracker</Text>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.row} onPress={() => router.push('/financial-report' as any)}>
                    <View style={[styles.rowIcon, { backgroundColor: Colors.accent.mint }]}>
                        <FileBarChart size={20} color={Colors.success[600]} />
                    </View>
                    <Text style={styles.rowText}>Financial Report</Text>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>
            </View>

            {/* Notification & Sound Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Preferences</Text>

                <View style={styles.row}>
                    <View style={styles.rowIcon}>
                        <Bell size={20} color={Colors.warning[500]} />
                    </View>
                    <Text style={styles.rowText}>Daily Reminder (9:00 PM)</Text>
                    <Switch
                        value={reminderEnabled}
                        onValueChange={toggleReminder}
                        trackColor={{ true: Colors.primary[500], false: Colors.gray[200] }}
                        thumbColor={Colors.white}
                    />
                </View>

                <View style={[styles.row, { borderBottomWidth: 0 }]}>
                    <View style={styles.rowIcon}>
                        <Bell size={20} color={Colors.success[500]} />
                    </View>
                    <Text style={styles.rowText}>Sound Effects</Text>
                    <Switch
                        value={soundEnabled}
                        onValueChange={setSoundEnabled}
                        trackColor={{ true: Colors.primary[500], false: Colors.gray[200] }}
                        thumbColor={Colors.white}
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Data Management</Text>

                <TouchableOpacity style={styles.row} onPress={exportData}>
                    <View style={[styles.rowIcon, { backgroundColor: Colors.primary[50] }]}>
                        <Database size={20} color={Colors.primary[600]} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowText}>Backup Data (JSON)</Text>
                        <Text style={{ fontSize: Typography.size.xs, color: Colors.gray[500], fontFamily: Typography.family.regular }}>Full backup of all your data</Text>
                    </View>
                    <FileDown size={20} color={Colors.gray[400]} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.row} onPress={exportCSV}>
                    <View style={[styles.rowIcon, { backgroundColor: Colors.success[50] }]}>
                        <FileText size={20} color={Colors.success[600]} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowText}>Export to CSV</Text>
                        <Text style={{ fontSize: Typography.size.xs, color: Colors.gray[500], fontFamily: Typography.family.regular }}>Transactions for Excel</Text>
                    </View>
                    <FileDown size={20} color={Colors.gray[400]} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.row} onPress={restoreData}>
                    <View style={[styles.rowIcon, { backgroundColor: Colors.danger[50] }]}>
                        <FileUp size={20} color={Colors.danger[500]} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.rowText, { color: Colors.danger[600] }]}>Restore from Backup</Text>
                        <Text style={{ fontSize: Typography.size.xs, color: Colors.gray[500], fontFamily: Typography.family.regular }}>Replace current data</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Application</Text>
                <View style={styles.row}>
                    <View style={styles.rowIcon}>
                        <Info size={20} color={Colors.gray[600]} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowText}>Version</Text>
                        <Text style={{ fontSize: Typography.size.xs, color: Colors.gray[500], fontFamily: Typography.family.regular }}>2.2.0 (Build 32)</Text>
                    </View>
                </View>
            </View>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.gray[50],
        padding: 16,
        paddingTop: 60,
    },
    headerTitle: {
        fontSize: Typography.size.xxxl,
        fontFamily: Typography.family.bold,
        marginBottom: 20,
        color: Colors.gray[900],
    },
    section: {
        marginBottom: 24,
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.lg,
        overflow: 'hidden',
        ...Layout.shadows.sm,
    },
    sectionTitle: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        color: Colors.gray[500],
        marginLeft: 16,
        marginTop: 16,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[100],
    },
    rowIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    rowText: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.medium,
        color: Colors.gray[900],
        flex: 1,
    },
    rowSubtext: {
        fontSize: Typography.size.sm,
        color: Colors.gray[500],
        marginTop: 2,
    },
});
