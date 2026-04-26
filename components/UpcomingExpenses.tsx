import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { 
    getUpcomingExpenses, RechargeMeta, 
    updateRechargeMeta, updateBillTransaction, 
    deleteRechargeMeta 
} from '../services/database';
import { cancelNotification, scheduleRechargeReminder } from '../services/notifications';
import { Colors, Layout, Typography } from '../constants/Theme';
import { Smartphone, Clock, Edit2, Trash2, X } from 'lucide-react-native';
import { format, differenceInDays, parseISO, addDays } from 'date-fns';
import { formatCurrency } from '../utils/currency';
import DateTimePicker from '@react-native-community/datetimepicker';

export const UpcomingExpenses = () => {
    const [upcoming, setUpcoming] = useState<RechargeMeta[]>([]);
    
    // Edit Modal State
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<RechargeMeta | null>(null);
    const [editName, setEditName] = useState('');
    const [editAmount, setEditAmount] = useState('');
    const [editValidity, setEditValidity] = useState('');
    const [editExpiryDate, setEditExpiryDate] = useState(new Date());
    const [showEditDatePicker, setShowEditDatePicker] = useState(false);
    const [editErrors, setEditErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

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

    const handleEdit = (item: RechargeMeta) => {
        setEditingItem(item);
        setEditName(item.description || item.subcategory || '');
        setEditAmount((item.amount || 0).toString());
        setEditValidity(item.validity_days.toString());
        setEditExpiryDate(parseISO(item.expiry_date));
        setEditErrors({});
        setEditModalVisible(true);
    };

    const handleSaveEdit = async () => {
        if (!editingItem) return;

        // Validate
        const errors: Record<string, string> = {};
        if (!editName.trim()) errors.name = 'Name is required';
        if (!editAmount || isNaN(Number(editAmount)) || Number(editAmount) <= 0) errors.amount = 'Valid amount required';
        if (!editValidity || isNaN(Number(editValidity)) || Number(editValidity) <= 0) errors.validity = 'Valid days required';
        
        if (Object.keys(errors).length > 0) {
            setEditErrors(errors);
            return;
        }

        try {
            setIsSaving(true);
            const days = parseInt(editValidity);
            const newExpiry = editExpiryDate;
            const newReminder = addDays(newExpiry, -2);

            // 1. Cancel old notification (gracefully)
            if (editingItem.notification_id) {
                await cancelNotification(editingItem.notification_id);
            }

            // 2. Schedule new notification
            const newNotifId = await scheduleRechargeReminder(
                "Recharge Expiring Soon",
                `Your ${editName} recharge expires in 2 days.`,
                newReminder
            );

            // 3. Update recharge_meta record
            await updateRechargeMeta(editingItem.id, {
                validity_days: days,
                expiry_date: newExpiry.toISOString(),
                reminder_date: newReminder.toISOString(),
                notification_id: newNotifId || '',
            });

            // 4. Update linked transaction
            await updateBillTransaction(editingItem.expense_id, {
                amount: parseFloat(editAmount),
                description: editName,
            });

            setEditModalVisible(false);
            await loadUpcoming();
        } catch (e) {
            Alert.alert('Error', 'Failed to update bill.');
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = (item: RechargeMeta) => {
        Alert.alert(
            'Delete this bill?',
            `"${item.description || item.subcategory || 'This bill'}" will be permanently removed.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // 1. Delete record and get notification_id
                            const notifId = await deleteRechargeMeta(item.id);

                            // 2. Cancel notification (gracefully — no crash if missing)
                            if (notifId) {
                                await cancelNotification(notifId);
                            }

                            // 3. Refresh list
                            await loadUpcoming();
                        } catch (e) {
                            Alert.alert('Error', 'Failed to delete bill.');
                        }
                    }
                }
            ]
        );
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
                            <View style={styles.cardTopRow}>
                                <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                                    <Text style={[styles.statusText, { color: statusColor }]}>
                                        {daysLeft < 0 ? 'Expired' : `${daysLeft} days left`}
                                    </Text>
                                </View>
                                <View style={styles.cardActions}>
                                    <TouchableOpacity
                                        style={styles.cardActionBtn}
                                        onPress={() => handleEdit(item)}
                                    >
                                        <Edit2 size={12} color={Colors.primary[600]} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.cardActionBtn, { backgroundColor: Colors.danger[50] }]}
                                        onPress={() => handleDelete(item)}
                                    >
                                        <Trash2 size={12} color={Colors.danger[500]} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.cardHeader}>
                                <View style={styles.iconContainer}>
                                    <Smartphone size={18} color={Colors.primary[600]} />
                                </View>
                                <View>
                                    <Text style={styles.itemName} numberOfLines={1}>
                                        {item.description || item.subcategory || 'Phone Recharge'}
                                    </Text>
                                    <Text style={styles.expiryDate}>Expires {format(expiry, 'MMM dd')}</Text>
                                </View>
                            </View>

                            <View style={styles.footer}>
                                <Text style={styles.amount}>{formatCurrency(item.amount || 0)}</Text>
                                <Clock size={12} color={Colors.gray[400]} style={{ marginLeft: 'auto' }} />
                            </View>
                        </View>
                    );
                })}
            </ScrollView>

            {/* Edit Bill Modal */}
            <Modal visible={editModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Bill</Text>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                                <X size={24} color={Colors.gray[400]} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.fieldLabel}>Bill Name</Text>
                        <TextInput
                            style={[styles.modalInput, editErrors.name && styles.inputError]}
                            value={editName}
                            onChangeText={setEditName}
                            placeholder="e.g. Mobile Recharge"
                        />
                        {editErrors.name && <Text style={styles.errorText}>{editErrors.name}</Text>}

                        <View style={styles.inputRow}>
                            <View style={{ flex: 1, marginRight: 12 }}>
                                <Text style={styles.fieldLabel}>Amount</Text>
                                <TextInput
                                    style={[styles.modalInput, editErrors.amount && styles.inputError]}
                                    value={editAmount}
                                    onChangeText={setEditAmount}
                                    keyboardType="numeric"
                                />
                                {editErrors.amount && <Text style={styles.errorText}>{editErrors.amount}</Text>}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.fieldLabel}>Validity (days)</Text>
                                <TextInput
                                    style={[styles.modalInput, editErrors.validity && styles.inputError]}
                                    value={editValidity}
                                    onChangeText={setEditValidity}
                                    keyboardType="numeric"
                                />
                                {editErrors.validity && <Text style={styles.errorText}>{editErrors.validity}</Text>}
                            </View>
                        </View>

                        <Text style={styles.fieldLabel}>Expiry Date</Text>
                        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEditDatePicker(true)}>
                            <Text style={styles.dateBtnText}>{format(editExpiryDate, 'MMM dd, yyyy')}</Text>
                        </TouchableOpacity>

                        {showEditDatePicker && (
                            <DateTimePicker
                                value={editExpiryDate}
                                mode="date"
                                onChange={(e, date) => {
                                    setShowEditDatePicker(false);
                                    if (date) setEditExpiryDate(date);
                                }}
                            />
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity 
                                style={[styles.saveBtn, isSaving && { opacity: 0.7 }]} 
                                onPress={handleSaveEdit}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Update Bill</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.gray[800],
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    scrollContent: {
        paddingRight: 20,
    },
    card: {
        width: 190,
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.xl,
        padding: 16,
        marginRight: 12,
        ...Layout.shadows.sm,
        borderWidth: 1,
        borderColor: Colors.gray[50],
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: Layout.radius.full,
    },
    statusText: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
        textTransform: 'uppercase',
    },
    cardActions: {
        flexDirection: 'row',
        gap: 6,
    },
    cardActionBtn: {
        width: 24,
        height: 24,
        borderRadius: 8,
        backgroundColor: Colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    iconContainer: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: Colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    itemName: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        width: 100,
    },
    expiryDate: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.regular,
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
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: Typography.size.xl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    fieldLabel: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
        color: Colors.gray[500],
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    modalInput: {
        backgroundColor: Colors.gray[50],
        padding: 16,
        borderRadius: 16,
        fontSize: Typography.size.md,
        fontFamily: Typography.family.medium,
        color: Colors.gray[900],
        borderWidth: 1,
        borderColor: Colors.gray[100],
        marginBottom: 20,
    },
    inputRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    inputError: {
        borderColor: Colors.danger[300],
        backgroundColor: Colors.danger[50],
    },
    errorText: {
        color: Colors.danger[500],
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.medium,
        marginTop: -16,
        marginBottom: 16,
        marginLeft: 4,
    },
    dateBtn: {
        backgroundColor: Colors.gray[50],
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.gray[100],
        marginBottom: 24,
    },
    dateBtnText: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    modalActions: {
        marginTop: 8,
    },
    saveBtn: {
        backgroundColor: Colors.primary[600],
        padding: 18,
        borderRadius: 20,
        alignItems: 'center',
        ...Layout.shadows.md,
    },
    saveBtnText: {
        color: 'white',
        fontFamily: Typography.family.bold,
        fontSize: Typography.size.md,
    },
});
