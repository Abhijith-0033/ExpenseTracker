import React, { useState, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { TabErrorFallback } from '../../components/ErrorBoundary';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { ChevronRight, Wallet, Tag, Database, Bell, FileUp, FileDown, FileText, Info, Calendar, Users, Target, CalendarClock, RefreshCw, FileBarChart, Send, Lock, PiggyBank, Trash2, Palette } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { checkReminderStatus, scheduleDailyReminder } from '../../services/notifications';
import { exportData, exportCSV, restoreData } from '../../services/backup';
import { Crown, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '../../src/subscription/useSubscription';

function SettingsContent() {
    const router = useRouter();
    const { soundEnabled, setSoundEnabled } = useApp();
    const { isPremium, isTrialActive, trialDaysRemaining, trialHoursRemaining, restorePurchases } = useSubscription();
    const [reminderEnabled, setReminderEnabled] = useState(true);

    const handleBackupJSON = () => {
        if (!isPremium && !isTrialActive) {
            router.push('/paywall');
            return;
        }
        exportData();
    };

    const handleExportCSV = () => {
        if (!isPremium && !isTrialActive) {
            router.push('/paywall');
            return;
        }
        exportCSV();
    };

    const handleRestore = () => {
        if (!isPremium && !isTrialActive) {
            router.push('/paywall');
            return;
        }
        restoreData();
    };

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

            {/* Premium Status Header Card */}
            <View style={styles.premiumCardContainer}>
                {isPremium ? (
                    <View style={[styles.premiumCard, styles.premiumCardActive]}>
                        <View style={styles.premiumHeader}>
                            <Crown size={24} color="#EAB308" style={{ marginRight: 8 }} />
                            <Text style={[styles.premiumTitle, { color: Colors.white }]}>Gastos Premium Active</Text>
                        </View>
                        <Text style={[styles.premiumDesc, { color: 'rgba(255,255,255,0.8)' }]}>
                            You have unlimited access to all features, reports, and modules.
                        </Text>
                        <View style={styles.premiumActionRow}>
                            <TouchableOpacity style={styles.restoreBtn} onPress={() => router.push('/paywall')}>
                                <Text style={styles.restoreBtnText}>View Plan Details</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <LinearGradient
                        colors={[Colors.primary[600], Colors.primary[800]]}
                        style={styles.premiumCard}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <View style={styles.premiumHeader}>
                            <Crown size={24} color="#FACC15" style={{ marginRight: 8 }} />
                            <Text style={[styles.premiumTitle, { color: Colors.white }]}>
                                {isTrialActive ? `Free Trial: ${trialDaysRemaining > 1 ? `${trialDaysRemaining} days` : `${trialHoursRemaining} hours`} left` : 'Unlock Gastos Premium'}
                            </Text>
                        </View>
                        <Text style={[styles.premiumDesc, { color: 'rgba(255,255,255,0.85)' }]}>
                            {isTrialActive 
                                ? 'Upgrade today to lock in full access to EMI, Debt, Sinking Funds & reports.' 
                                : 'Your trial has ended. Upgrade to regain full access to advanced features.'}
                        </Text>
                        <View style={styles.premiumActionRow}>
                            <TouchableOpacity style={styles.upgradeBtn} onPress={() => router.push('/paywall')}>
                                <Text style={styles.upgradeBtnText}>Get Premium</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.restoreBtnLink} onPress={restorePurchases}>
                                <Text style={[styles.restoreBtnLinkText, { color: Colors.white }]}>Restore</Text>
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                )}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>General</Text>

                <TouchableOpacity
                    style={styles.row}
                    onPress={() => router.push('/theme-settings' as any)}
                >
                    <View style={[styles.rowIcon, { backgroundColor: 'rgba(232, 145, 122, 0.15)' }]}>
                        <Palette size={20} color={Colors.primary[600]} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowText}>Appearance & Dashboard</Text>
                        <Text style={styles.rowSubtext}>Themes, dark mode, colors & widget layout</Text>
                    </View>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.row}
                    onPress={() => router.push('/security/app-lock-settings' as any)}
                >
                    <View style={[styles.rowIcon, { backgroundColor: 'rgba(16,24,40,0.08)' }]}>
                        <Lock size={20} color={Colors.gray[900]} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowText}>App Lock</Text>
                        <Text style={styles.rowSubtext}>PIN and biometric security</Text>
                    </View>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>

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

                <TouchableOpacity style={styles.row} onPress={() => router.push('/tax-planner' as any)}>
                    <View style={[styles.rowIcon, { backgroundColor: 'rgba(5,150,105,0.1)' }]}>
                        <FileText size={20} color="#059669" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowText}>Tax Planner</Text>
                        <Text style={styles.rowSubtext}>Plan deductions, estimate liability</Text>
                    </View>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.row} onPress={() => router.push('/future-calendar' as any)}>
                    <View style={[styles.rowIcon, { backgroundColor: 'rgba(11,165,236,0.1)' }]}>
                        <Calendar size={20} color="#0BA5EC" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowText}>Future Calendar</Text>
                        <Text style={styles.rowSubtext}>See upcoming expenses before they happen</Text>
                    </View>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.row} onPress={() => router.push('/upcoming-bills' as any)}>
                    <View style={[styles.rowIcon, { backgroundColor: Colors.primary[50] }]}>
                        <Calendar size={20} color={Colors.primary[600]} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowText}>Upcoming Bills</Text>
                        <Text style={styles.rowSubtext}>Manage utility bills, rent, and credit cards</Text>
                    </View>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.row} onPress={() => router.push('/scheduled-expenses' as any)}>
                    <View style={[styles.rowIcon, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                        <CalendarClock size={20} color="#6366F1" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowText}>Scheduled Expenses</Text>
                        <Text style={styles.rowSubtext}>Automate or approve recurring transactions</Text>
                    </View>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.row} onPress={() => router.push('/sinking-funds' as any)}>
                    <View style={[styles.rowIcon, { backgroundColor: 'rgba(20,184,166,0.1)' }]}>
                        <PiggyBank size={20} color="#14B8A6" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowText}>Sinking Funds</Text>
                        <Text style={styles.rowSubtext}>Save monthly for predictable big expenses</Text>
                    </View>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>
            </View>

            {/* Integrations Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Integrations</Text>

                <TouchableOpacity
                    style={styles.row}
                    onPress={() => router.push('/telegram-settings' as any)}
                >
                    <View style={[styles.rowIcon, { backgroundColor: 'rgba(0,136,204,0.1)' }]}>
                        <Send size={20} color="#0088CC" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowText}>Telegram Bot</Text>
                        <Text style={styles.rowSubtext}>Add expenses via Telegram</Text>
                    </View>
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

                <TouchableOpacity style={styles.row} onPress={handleBackupJSON}>
                    <View style={[styles.rowIcon, { backgroundColor: Colors.primary[50] }]}>
                        <Database size={20} color={Colors.primary[600]} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowText}>Backup Data (JSON)</Text>
                        <Text style={{ fontSize: Typography.size.xs, color: Colors.gray[500], fontFamily: Typography.family.regular }}>Full backup of all your data</Text>
                    </View>
                    <FileDown size={20} color={Colors.gray[400]} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.row} onPress={handleExportCSV}>
                    <View style={[styles.rowIcon, { backgroundColor: Colors.success[50] }]}>
                        <FileText size={20} color={Colors.success[600]} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowText}>Export to CSV</Text>
                        <Text style={{ fontSize: Typography.size.xs, color: Colors.gray[500], fontFamily: Typography.family.regular }}>Transactions for Excel</Text>
                    </View>
                    <FileDown size={20} color={Colors.gray[400]} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.row} onPress={handleRestore}>
                    <View style={[styles.rowIcon, { backgroundColor: Colors.danger[50] }]}>
                        <FileUp size={20} color={Colors.danger[500]} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.rowText, { color: Colors.danger[600] }]}>Restore from Backup</Text>
                        <Text style={{ fontSize: Typography.size.xs, color: Colors.gray[500], fontFamily: Typography.family.regular }}>Replace current data</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={() => router.push('/data-cleanup' as any)}>
                    <View style={[styles.rowIcon, { backgroundColor: Colors.danger[50] }]}>
                        <Trash2 size={20} color={Colors.danger[600]} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.rowText, { color: Colors.danger[600] }]}>Delete Records by Period</Text>
                        <Text style={{ fontSize: Typography.size.xs, color: Colors.gray[500], fontFamily: Typography.family.regular }}>Clean up historical transactions</Text>
                    </View>
                    <ChevronRight size={20} color={Colors.gray[400]} />
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Application</Text>

                <TouchableOpacity style={styles.row} onPress={() => router.push('/quick-guide' as any)}>
                    <View style={[styles.rowIcon, { backgroundColor: 'rgba(100,116,139,0.1)' }]}>
                        <Info size={20} color="#64748B" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowText}>Help & In-App Guide</Text>
                        <Text style={styles.rowSubtext}>Learn how to use Gastos features</Text>
                    </View>
                    <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>

                <View style={styles.row}>
                    <View style={styles.rowIcon}>
                        <Info size={20} color={Colors.gray[600]} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowText}>Version</Text>
                        <Text style={{ fontSize: Typography.size.xs, color: Colors.gray[500], fontFamily: Typography.family.regular }}>3.5.0 (Build 45)</Text>
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
    premiumCardContainer: {
        marginBottom: 20,
    },
    premiumCard: {
        backgroundColor: Colors.primary[50],
        borderWidth: 1,
        borderColor: Colors.primary[200],
        borderRadius: 24,
        padding: 20,
    },
    premiumCardActive: {
        backgroundColor: Colors.gray[900],
        borderColor: Colors.gray[800],
    },
    premiumCardTrial: {
        backgroundColor: Colors.primary[50],
        borderColor: Colors.primary[100],
    },
    premiumHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    premiumTitle: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.primary[800],
    },
    premiumDesc: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.regular,
        color: Colors.gray[600],
        lineHeight: 20,
        marginBottom: 16,
    },
    premiumActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    upgradeBtn: {
        backgroundColor: Colors.primary[500],
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    upgradeBtnText: {
        color: Colors.white,
        fontFamily: Typography.family.bold,
        fontSize: Typography.size.sm,
    },
    restoreBtn: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    restoreBtnText: {
        color: Colors.white,
        fontFamily: Typography.family.bold,
        fontSize: Typography.size.sm,
    },
    restoreBtnLink: {
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    restoreBtnLinkText: {
        color: Colors.primary[600],
        fontFamily: Typography.family.bold,
        fontSize: Typography.size.sm,
    },
});

export default function SettingsScreen() {
    return (
        <ErrorBoundary FallbackComponent={TabErrorFallback}>
            <SettingsContent />
        </ErrorBoundary>
    );
}
