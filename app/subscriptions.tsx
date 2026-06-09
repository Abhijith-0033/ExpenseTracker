import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Modal, TextInput, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Layout } from '../constants/Theme';
import { ArrowLeft, Plus, RefreshCw, Calendar, CreditCard, Globe, Trash2, CheckCircle2, ChevronRight, Bell, Tag } from 'lucide-react-native';
import { router } from 'expo-router';
import { Card } from '../components/ui/Card';
import { Subscription, getAllSubscriptions, updateSubscription, deleteSubscription, getMonthlyBurn, addSubscription, updateSubscriptionStatus, advanceRenewalDate } from '../services/subscriptions';
import { format, differenceInDays } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button } from '../components/ui/Button';
import Animated, { FadeInDown, FadeInRight, FadeIn } from 'react-native-reanimated';
import { PressableScale } from '../components/ui/PressableScale';
import { SwipeableRow } from '../components/SwipeableRow';
import { formatAmount } from '../utils/formatAmount';
import { FormField } from '../components/FormField';
import { Snackbar } from '../components/Snackbar';

export default function SubscriptionsScreen() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [monthlyBurn, setMonthlyBurn] = useState(0);
    const [activeTab, setActiveTab] = useState<'active' | 'cancelled'>('active');
    const [_loading, setLoading] = useState(true);
    
    // Modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingSub, setEditingSub] = useState<Subscription | null>(null);
    const [pendingDeleteSub, setPendingDeleteSub] = useState<{id: number, name: string} | null>(null);
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [cycle, setCycle] = useState<'monthly' | 'quarterly' | 'yearly' | 'custom'>('monthly');
    const [isCustom, setIsCustom] = useState(false);
    const [customValue, setCustomValue] = useState('1');
    const [customUnit, setCustomUnit] = useState<'days' | 'weeks' | 'months'>('months');
    const [website, setWebsite] = useState('');
    const [autoRenew, setAutoRenew] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [notes, setNotes] = useState('');
    const [category, setCategory] = useState('Subscriptions');
    const [reminderDays, setReminderDays] = useState('3');
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [subs, burn] = await Promise.all([
                getAllSubscriptions(),
                getMonthlyBurn()
            ]);
            setSubscriptions(subs);
            setMonthlyBurn(burn);
        } catch (e) {
            console.error("Failed to load subscriptions", e);
        } finally {
            setLoading(false);
        }
    };

    const handleLongPress = (sub: Subscription) => {
        const buttons: any[] = [];
        
        if (sub.status !== 'paused' && sub.status !== 'cancelled') {
            buttons.push({ text: '⏸ Pause', onPress: () => handleUpdateStatus(sub.id, 'paused') });
        }
        if (sub.status === 'paused') {
            buttons.push({ text: '▶️ Reactivate', onPress: () => handleUpdateStatus(sub.id, 'active') });
        }
        if (sub.status !== 'cancelled') {
            buttons.push({ text: '❌ Cancel', style: 'destructive', onPress: () => handleUpdateStatus(sub.id, 'cancelled') });
        } else {
            buttons.push({ text: '🔄 Renew', onPress: () => handleUpdateStatus(sub.id, 'active') });
        }
        
        buttons.push({ text: '💰 Mark as Paid', onPress: () => handleMarkAsPaid(sub) });
        buttons.push({ text: '✏️ Edit', onPress: () => openEditModal(sub) });
        buttons.push({ text: '🗑️ Delete', style: 'destructive', onPress: () => handleDelete(sub.id, sub.name) });
        buttons.push({ text: 'Cancel', style: 'cancel' });

        Alert.alert(sub.name, 'Choose an action', buttons);
    };

    const handleUpdateStatus = async (id: number, status: 'active' | 'paused' | 'cancelled') => {
        await updateSubscriptionStatus(id, status);
        loadData();
    };

    const handleMarkAsPaid = async (sub: Subscription) => {
        Alert.alert('Mark as Paid?', `This will advance the renewal date for ${sub.name}.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Confirm', onPress: async () => {
                await advanceRenewalDate(sub.id);
                loadData();
            }}
        ]);
    };

    const handleDelete = (id: number, name: string) => {
        setPendingDeleteSub({ id, name });
    };

    const commitDelete = async () => {
        if (!pendingDeleteSub) return;
        try {
            await deleteSubscription(pendingDeleteSub.id);
            loadData();
        } catch (_e) {
            Alert.alert("Error", "Failed to delete subscription");
        } finally {
            setPendingDeleteSub(null);
        }
    };

    const openAddModal = () => {
        setEditingSub(null);
        setName('');
        setAmount('');
        setDate(new Date());
        setCycle('monthly');
        setIsCustom(false);
        setCustomValue('1');
        setCustomUnit('months');
        setWebsite('');
        setAutoRenew(true);
        setPaymentMethod('');
        setNotes('');
        setCategory('Subscriptions');
        setReminderDays('3');
        setShowAddModal(true);
    };

    const openEditModal = (sub: Subscription) => {
        setEditingSub(sub);
        setName(sub.name);
        setAmount(sub.amount.toString());
        setDate(new Date(sub.next_renewal_date));
        setCycle(sub.billing_cycle);
        setIsCustom(sub.billing_cycle === 'custom');
        setCustomValue(sub.custom_interval_value?.toString() || '1');
        setCustomUnit(sub.custom_interval_unit || 'months');
        setWebsite(sub.website || '');
        setAutoRenew(sub.auto_renew === 1);
        setPaymentMethod(sub.payment_method || '');
        setNotes(sub.notes || '');
        setCategory(sub.category || 'Subscriptions');
        setReminderDays(sub.reminder_days_before?.toString() || '3');
        setShowAddModal(true);
    };

    const handleSave = async () => {
        const newErrors: Record<string, string> = {};
        if (!name) newErrors.name = 'Name is required';
        if (!amount || isNaN(parseFloat(amount))) newErrors.amount = 'Valid amount is required';
        
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setErrors({});

        const subData = {
            name,
            amount: parseFloat(amount),
            billing_cycle: cycle,
            next_renewal_date: date.toISOString().split('T')[0],
            category,
            account_id: 1, // Default account
            icon: '🔄',
            color: Colors.primary[500],
            is_active: 1,
            notes,
            custom_interval_value: isCustom ? parseInt(customValue) : undefined,
            custom_interval_unit: isCustom ? customUnit : undefined,
            website,
            auto_renew: autoRenew ? 1 : 0,
            payment_method: paymentMethod,
            reminder_days_before: parseInt(reminderDays),
            status: editingSub ? editingSub.status : 'active'
        };

        if (editingSub) {
            await updateSubscription(editingSub.id, subData);
        } else {
            await addSubscription(subData);
        }

        setShowAddModal(false);
        loadData();
    };

    const validSubs = subscriptions.filter(s => s.id !== pendingDeleteSub?.id);
    const filteredSubs = validSubs.filter(s => {
        if (activeTab === 'active') return s.status !== 'cancelled';
        return s.status === 'cancelled';
    });

    const activeCount = subscriptions.filter(s => s.status === 'active' || !s.status).length;
    const dueThisWeek = subscriptions.filter(s => {
        const days = differenceInDays(new Date(s.next_renewal_date), new Date());
        return days >= 0 && days <= 7 && s.status !== 'cancelled' && s.status !== 'paused';
    }).length;

    const getFrequencyText = (sub: Subscription) => {
        if (sub.billing_cycle === 'custom') {
            return `Every ${sub.custom_interval_value} ${sub.custom_interval_unit}`;
        }
        return sub.billing_cycle.charAt(0).toUpperCase() + sub.billing_cycle.slice(1);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <PressableScale onPress={() => router.back()} style={styles.headerBtn}>
                    <ArrowLeft size={22} color={Colors.gray[800]} />
                </PressableScale>
                <Text style={styles.headerTitle}>Subscriptions</Text>
                <PressableScale onPress={openAddModal} style={[styles.headerBtn, styles.addBtn]}>
                    <Plus size={22} color={Colors.white} />
                </PressableScale>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Premium Analytics Card */}
                <Animated.View entering={FadeInDown.duration(600)}>
                    <Card style={styles.analyticsCard}>
                        <View style={styles.analyticsHeader}>
                            <View>
                                <Text style={styles.analyticsLabel}>MONTHLY BURN</Text>
                                <Text style={styles.analyticsValue}>
                                    {formatAmount(monthlyBurn, 'expense').text}
                                </Text>
                            </View>
                            <View style={styles.yearlyBadge}>
                                <Text style={styles.yearlyText}>
                                    {formatAmount(monthlyBurn * 12, 'expense').text} / year
                                </Text>
                            </View>
                        </View>
                        <View style={styles.analyticsGrid}>
                            <View style={styles.analyticsItem}>
                                <View style={[styles.analyticsIcon, { backgroundColor: Colors.success[50] }]}>
                                    <CheckCircle2 size={16} color={Colors.success[600]} />
                                </View>
                                <View>
                                    <Text style={styles.analyticsStatValue}>{activeCount}</Text>
                                    <Text style={styles.analyticsStatLabel}>Active</Text>
                                </View>
                            </View>
                            <View style={styles.analyticsItem}>
                                <View style={[styles.analyticsIcon, { backgroundColor: Colors.warning[50] }]}>
                                    <Bell size={16} color={Colors.warning[600]} />
                                </View>
                                <View>
                                    <Text style={styles.analyticsStatValue}>{dueThisWeek}</Text>
                                    <Text style={styles.analyticsStatLabel}>Due Soon</Text>
                                </View>
                            </View>
                        </View>
                    </Card>
                </Animated.View>

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === 'active' && styles.activeTab]} 
                        onPress={() => setActiveTab('active')}
                    >
                        <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>Active</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === 'cancelled' && styles.activeTab]} 
                        onPress={() => setActiveTab('cancelled')}
                    >
                        <Text style={[styles.tabText, activeTab === 'cancelled' && styles.activeTabText]}>Cancelled</Text>
                    </TouchableOpacity>
                </View>

                {/* Subscription List */}
                <View style={styles.listContainer}>
                    {filteredSubs.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <RefreshCw size={48} color={Colors.gray[200]} />
                            <Text style={styles.emptyText}>No {activeTab} subscriptions found</Text>
                        </View>
                    ) : (
                        filteredSubs.map((sub, index) => {
                            const daysLeft = differenceInDays(new Date(sub.next_renewal_date), new Date());
                            const isUpcoming = daysLeft >= 0 && daysLeft <= 7 && sub.status !== 'paused' && sub.status !== 'cancelled';
                            const isPaused = sub.status === 'paused';
                            const isAuto = sub.notes?.includes('Auto-added');
                            
                            return (
                                <Animated.View key={sub.id} entering={FadeInRight.delay(index * 100).duration(500)}>
                                    <SwipeableRow
                                        onDelete={() => handleDelete(sub.id, sub.name)}
                                        onEdit={() => openEditModal(sub)}
                                        deleteConfirmTitle="Delete Subscription"
                                        deleteConfirmMessage={`Are you sure you want to permanently delete ${sub.name}?`}
                                    >
                                        <TouchableOpacity 
                                            activeOpacity={0.7} 
                                            onLongPress={() => handleLongPress(sub)}
                                            onPress={() => openEditModal(sub)}
                                        >
                                            <Card style={[styles.subCard, isPaused && styles.pausedCard, isUpcoming && styles.upcomingCard]}>
                                                <View style={[styles.subIconContainer, { backgroundColor: sub.color + '15' }]}>
                                                    <Text style={{ fontSize: 24 }}>{sub.icon || '📦'}</Text>
                                                </View>
                                                
                                                <View style={styles.subMainInfo}>
                                                    <View style={styles.subHeaderRow}>
                                                        <Text style={styles.subName} numberOfLines={1}>{sub.name}</Text>
                                                        <Text style={[styles.subAmount, { color: formatAmount(sub.amount, 'expense').color }]}>
                                                            {formatAmount(sub.amount, 'expense').text}
                                                        </Text>
                                                    </View>
                                                    
                                                    <View style={styles.badgeRow}>
                                                        {isAuto ? (
                                                            <View style={[styles.badge, styles.recurringBadge]}>
                                                                <Text style={styles.badgeText}>📅 Recurring</Text>
                                                            </View>
                                                        ) : (
                                                            <View style={[styles.badge, styles.subBadge]}>
                                                                <Text style={styles.badgeText}>🔁 Subscription</Text>
                                                            </View>
                                                        )}
                                                        {isPaused && (
                                                            <View style={[styles.badge, styles.pausedBadge]}>
                                                                <Text style={styles.badgeText}>⏸ Paused</Text>
                                                            </View>
                                                        )}
                                                        {isUpcoming && (
                                                            <View style={[styles.badge, styles.upcomingBadge]}>
                                                                <Text style={styles.badgeText}>🔥 Due Soon</Text>
                                                            </View>
                                                        )}
                                                    </View>

                                                    <View style={styles.subFooterRow}>
                                                        <Text style={styles.subFreq}>{getFrequencyText(sub)}</Text>
                                                        <View style={styles.dot} />
                                                        <Text style={[styles.subDate, isUpcoming && styles.upcomingDateText]}>
                                                            {daysLeft === 0 ? 'Due Today' : daysLeft < 0 ? `Overdue by ${Math.abs(daysLeft)}d` : `Due in ${daysLeft}d`}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </Card>
                                        </TouchableOpacity>
                                    </SwipeableRow>
                                </Animated.View>
                            );
                        })
                    )}
                </View>
            </ScrollView>

            <Snackbar 
                visible={!!pendingDeleteSub}
                message="Subscription deleted"
                onUndo={() => setPendingDeleteSub(null)}
                onDismiss={commitDelete}
            />

            {/* Add/Edit Modal */}
            <Modal visible={showAddModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingSub ? 'Edit Subscription' : 'New Subscription'}</Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <ChevronRight size={24} color={Colors.gray[400]} style={{ transform: [{ rotate: '90deg' }] }} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                            <FormField 
                                label="Name"
                                value={name}
                                onChangeText={(val) => { setName(val); setErrors(prev => ({...prev, name: ''})); }}
                                placeholder="e.g. Netflix"
                                error={errors.name}
                                required
                                rightElement={<Tag size={18} color={Colors.gray[400]} />}
                            />

                            <FormField 
                                label="Amount"
                                value={amount}
                                onChangeText={(val) => { setAmount(val); setErrors(prev => ({...prev, amount: ''})); }}
                                placeholder="0"
                                keyboardType="numeric"
                                error={errors.amount}
                                required
                                rightElement={<Text style={styles.currencyPrefix}>₹</Text>}
                            />

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Billing Cycle</Text>
                                <View style={styles.cycleGrid}>
                                    {['monthly', 'quarterly', 'yearly', 'custom'].map(c => (
                                        <TouchableOpacity 
                                            key={c}
                                            style={[styles.cycleOption, cycle === c && styles.cycleOptionActive]} 
                                            onPress={() => { setCycle(c as any); setIsCustom(c === 'custom'); }}
                                        >
                                            <Text style={[styles.cycleOptionText, cycle === c && styles.cycleOptionTextActive]}>
                                                {c.charAt(0).toUpperCase() + c.slice(1)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {isCustom && (
                                <Animated.View entering={FadeIn.duration(300)} style={styles.customIntervalRow}>
                                    <View style={[styles.formGroup, { flex: 1 }]}>
                                        <Text style={styles.label}>Every</Text>
                                        <TextInput 
                                            style={styles.modalInputSmall} 
                                            keyboardType="numeric" 
                                            value={customValue} 
                                            onChangeText={setCustomValue} 
                                        />
                                    </View>
                                    <View style={[styles.formGroup, { flex: 2 }]}>
                                        <Text style={styles.label}>Unit</Text>
                                        <View style={styles.unitRow}>
                                            {['days', 'weeks', 'months'].map(u => (
                                                <TouchableOpacity 
                                                    key={u}
                                                    style={[styles.unitOption, customUnit === u && styles.unitOptionActive]} 
                                                    onPress={() => setCustomUnit(u as any)}
                                                >
                                                    <Text style={[styles.unitText, customUnit === u && styles.unitTextActive]}>{u}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                </Animated.View>
                            )}

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Next Renewal Date</Text>
                                <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowDatePicker(true)}>
                                    <Calendar size={18} color={Colors.gray[400]} />
                                    <Text style={styles.dateText}>{format(date, 'MMMM dd, yyyy')}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.formGroup}>
                                <View style={styles.labelRow}>
                                    <Text style={styles.label}>Website (Optional)</Text>
                                </View>
                                <View style={styles.inputWrapper}>
                                    <Globe size={18} color={Colors.gray[400]} />
                                    <TextInput style={styles.modalInput} placeholder="netflix.com" value={website} onChangeText={setWebsite} />
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <View style={styles.switchRow}>
                                    <View>
                                        <Text style={styles.label}>Auto-Renew</Text>
                                        <Text style={styles.helpText}>Notifications will auto-reschedule</Text>
                                    </View>
                                    <Switch 
                                        value={autoRenew} 
                                        onValueChange={setAutoRenew}
                                        trackColor={{ false: Colors.gray[200], true: Colors.primary[500] }}
                                    />
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Payment Method</Text>
                                <View style={styles.inputWrapper}>
                                    <CreditCard size={18} color={Colors.gray[400]} />
                                    <TextInput style={styles.modalInput} placeholder="ICICI Credit Card" value={paymentMethod} onChangeText={setPaymentMethod} />
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Reminder (Days Before)</Text>
                                <View style={styles.inputWrapper}>
                                    <Bell size={18} color={Colors.gray[400]} />
                                    <TextInput 
                                        style={styles.modalInput} 
                                        keyboardType="numeric" 
                                        placeholder="3" 
                                        value={reminderDays} 
                                        onChangeText={setReminderDays} 
                                    />
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Notes</Text>
                                <TextInput 
                                    style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]} 
                                    placeholder="Any additional details..." 
                                    multiline 
                                    value={notes} 
                                    onChangeText={setNotes} 
                                />
                            </View>

                            <Button 
                                title={editingSub ? "Update Subscription" : "Create Subscription"} 
                                onPress={handleSave} 
                                style={styles.saveBtn}
                            />

                            {editingSub && (
                                <TouchableOpacity 
                                    style={styles.deleteBtn} 
                                    onPress={() => {
                                        setShowAddModal(false);
                                        // Slight delay to allow modal to close smoothly before showing alert
                                        setTimeout(() => {
                                            handleDelete(editingSub.id, editingSub.name);
                                        }, 300);
                                    }}
                                >
                                    <Trash2 size={20} color={Colors.danger[500]} />
                                    <Text style={styles.deleteBtnText}>Delete Subscription</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {showDatePicker && (
                <DateTimePicker 
                    value={date} 
                    mode="date" 
                    display="default" 
                    onChange={(e, d) => { setShowDatePicker(false); if (d) setDate(d); }} 
                />
            )}

            <Snackbar 
                visible={!!pendingDeleteSub}
                message="Subscription deleted"
                onUndo={() => setPendingDeleteSub(null)}
                onDismiss={commitDelete}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.gray[50] },
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 20, 
        paddingVertical: 12, 
        justifyContent: 'space-between' 
    },
    headerBtn: { 
        padding: 10, 
        backgroundColor: Colors.white, 
        borderRadius: 12,
        ...Layout.shadows.sm
    },
    addBtn: { backgroundColor: Colors.primary[500] },
    headerTitle: { fontSize: 20, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    scrollContent: { padding: 20 },
    analyticsCard: { 
        backgroundColor: Colors.gray[900], 
        padding: 24, 
        borderRadius: 24,
        marginBottom: 24
    },
    analyticsHeader: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: 24
    },
    analyticsLabel: { 
        fontSize: 10, 
        fontFamily: Typography.family.bold, 
        color: Colors.gray[400], 
        letterSpacing: 1,
        marginBottom: 4
    },
    analyticsValue: { 
        fontSize: 32, 
        fontFamily: Typography.family.bold, 
        color: Colors.white 
    },
    yearlyBadge: { 
        backgroundColor: 'rgba(255,255,255,0.1)', 
        paddingHorizontal: 12, 
        paddingVertical: 6, 
        borderRadius: 12 
    },
    yearlyText: { fontSize: 12, color: Colors.gray[300], fontFamily: Typography.family.medium },
    analyticsGrid: { flexDirection: 'row', gap: 20 },
    analyticsItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    analyticsIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    analyticsStatValue: { fontSize: 18, fontFamily: Typography.family.bold, color: Colors.white },
    analyticsStatLabel: { fontSize: 12, color: Colors.gray[400], fontFamily: Typography.family.regular },
    tabContainer: { 
        flexDirection: 'row', 
        backgroundColor: Colors.gray[100], 
        borderRadius: 14, 
        padding: 4,
        marginBottom: 24
    },
    tab: { 
        flex: 1, 
        paddingVertical: 10, 
        alignItems: 'center', 
        borderRadius: 10 
    },
    activeTab: { backgroundColor: Colors.white, ...Layout.shadows.sm },
    tabText: { fontSize: 14, fontFamily: Typography.family.medium, color: Colors.gray[500] },
    activeTabText: { color: Colors.gray[900], fontFamily: Typography.family.bold },
    listContainer: { gap: 12 },
    subCard: { 
        flexDirection: 'row', 
        padding: 16, 
        borderRadius: 20,
        backgroundColor: Colors.white,
        alignItems: 'center'
    },
    pausedCard: { opacity: 0.6 },
    upcomingCard: { borderColor: Colors.danger[100], borderWidth: 1 },
    subIconContainer: { 
        width: 56, 
        height: 56, 
        borderRadius: 18, 
        justifyContent: 'center', 
        alignItems: 'center',
        marginRight: 16
    },
    subMainInfo: { flex: 1 },
    subHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    subName: { fontSize: 16, fontFamily: Typography.family.bold, color: Colors.gray[900], flex: 1 },
    subAmount: { fontSize: 16, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    badgeRow: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    recurringBadge: { backgroundColor: Colors.success[50] },
    subBadge: { backgroundColor: Colors.primary[50] },
    pausedBadge: { backgroundColor: Colors.gray[100] },
    upcomingBadge: { backgroundColor: Colors.danger[50] },
    badgeText: { fontSize: 10, fontFamily: Typography.family.bold, color: Colors.gray[700] },
    subFooterRow: { flexDirection: 'row', alignItems: 'center' },
    subFreq: { fontSize: 12, color: Colors.gray[500], fontFamily: Typography.family.medium },
    dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.gray[300], marginHorizontal: 8 },
    subDate: { fontSize: 12, color: Colors.gray[500], fontFamily: Typography.family.medium },
    upcomingDateText: { color: Colors.danger[600], fontFamily: Typography.family.bold },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 16 },
    emptyText: { fontSize: 16, color: Colors.gray[400], fontFamily: Typography.family.medium },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { 
        backgroundColor: Colors.white, 
        borderTopLeftRadius: 32, 
        borderTopRightRadius: 32, 
        padding: 24, 
        maxHeight: Dimensions.get('window').height * 0.9 
    },
    modalHeader: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 24
    },
    modalTitle: { fontSize: 20, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    formGroup: { marginBottom: 20 },
    label: { fontSize: 14, fontFamily: Typography.family.bold, color: Colors.gray[700], marginBottom: 8 },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    helpText: { fontSize: 12, color: Colors.gray[400], fontFamily: Typography.family.regular },
    inputWrapper: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: Colors.gray[100], 
        borderRadius: 16, 
        paddingHorizontal: 16,
        height: 56
    },
    modalInput: { flex: 1, fontSize: 16, fontFamily: Typography.family.medium, color: Colors.gray[900], marginLeft: 12 },
    modalInputSmall: { 
        backgroundColor: Colors.gray[100], 
        borderRadius: 16, 
        paddingHorizontal: 16, 
        height: 56,
        fontSize: 16, 
        fontFamily: Typography.family.medium, 
        color: Colors.gray[900] 
    },
    currencyPrefix: { fontSize: 18, fontFamily: Typography.family.bold, color: Colors.gray[400] },
    dateText: { fontSize: 16, fontFamily: Typography.family.medium, color: Colors.gray[900], marginLeft: 12 },
    cycleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    cycleOption: { 
        paddingHorizontal: 16, 
        paddingVertical: 10, 
        borderRadius: 12, 
        borderWidth: 1, 
        borderColor: Colors.gray[200] 
    },
    cycleOptionActive: { backgroundColor: Colors.primary[500], borderColor: Colors.primary[500] },
    cycleOptionText: { fontSize: 14, fontFamily: Typography.family.medium, color: Colors.gray[600] },
    cycleOptionTextActive: { color: Colors.white, fontFamily: Typography.family.bold },
    customIntervalRow: { flexDirection: 'row', gap: 12 },
    unitRow: { flexDirection: 'row', gap: 6 },
    unitOption: { 
        flex: 1, 
        paddingVertical: 12, 
        alignItems: 'center', 
        borderRadius: 12, 
        borderWidth: 1, 
        borderColor: Colors.gray[200] 
    },
    unitOptionActive: { backgroundColor: Colors.primary[50], borderColor: Colors.primary[200] },
    unitText: { fontSize: 12, color: Colors.gray[600], fontFamily: Typography.family.medium },
    unitTextActive: { color: Colors.primary[700], fontFamily: Typography.family.bold },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    saveBtn: { marginTop: 10, height: 60, borderRadius: 20 },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        paddingVertical: 16,
        borderRadius: 20,
        backgroundColor: Colors.danger[50],
        gap: 8,
    },
    deleteBtnText: {
        color: Colors.danger[600],
        fontSize: 16,
        fontFamily: Typography.family.bold,
    },
});
