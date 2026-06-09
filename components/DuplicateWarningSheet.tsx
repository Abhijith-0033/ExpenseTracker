/* eslint-disable react/no-unescaped-entities */
import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { AlertTriangle, Clock } from 'lucide-react-native';
import { Colors, Typography } from '../constants/Theme';
import { Transaction } from '../services/database';
import { formatAmount } from '../utils/formatAmount';
import { format } from 'date-fns';

interface DuplicateWarningSheetProps {
    visible: boolean;
    existingTransaction: Transaction | null;
    onSaveAnyway: () => void;
    onCancel: () => void;
}

export const DuplicateWarningSheet: React.FC<DuplicateWarningSheetProps> = ({
    visible,
    existingTransaction,
    onSaveAnyway,
    onCancel
}) => {
    if (!existingTransaction) return null;

    const { text: amtText, color: amtColor } = formatAmount(
        existingTransaction.amount, 
        existingTransaction.category === 'Income' ? 'income' : 'expense'
    );

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    <View style={styles.handle} />
                    
                    <View style={styles.iconContainer}>
                        <AlertTriangle size={32} color={Colors.warning[600]} />
                    </View>
                    
                    <Text style={styles.title}>Possible Duplicate</Text>
                    <Text style={styles.description}>
                        You just saved a very similar transaction recently. Are you sure you want to add this one too?
                    </Text>

                    <View style={styles.txCard}>
                        <View style={styles.txHeader}>
                            <Text style={styles.txCategory}>{existingTransaction.category}</Text>
                            <Text style={[styles.txAmount, { color: amtColor }]}>{amtText}</Text>
                        </View>
                        <View style={styles.txFooter}>
                            <Text style={styles.txSubcategory}>{existingTransaction.subcategory}</Text>
                            <View style={styles.timeWrapper}>
                                <Clock size={12} color={Colors.gray[400]} />
                                <Text style={styles.txTime}>
                                    {format(new Date(existingTransaction.created_at), 'hh:mm a')}
                                </Text>
                            </View>
                        </View>
                        {existingTransaction.description ? (
                            <Text style={styles.txNote} numberOfLines={1}>
                                {`"${existingTransaction.description}"`}
                            </Text>
                        ) : null}
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.saveBtn} onPress={onSaveAnyway} activeOpacity={0.8}>
                            <Text style={styles.saveBtnText}>Yes, Save Anyway</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
                            <Text style={styles.cancelBtnText}>Cancel — It's a Duplicate</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
        alignItems: 'center',
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: Colors.gray[200],
        borderRadius: 2,
        marginBottom: 24,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.warning[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: Typography.size.xl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        marginBottom: 8,
    },
    description: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.medium,
        color: Colors.gray[500],
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 16,
    },
    txCard: {
        width: '100%',
        backgroundColor: Colors.gray[50],
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.gray[100],
        marginBottom: 32,
    },
    txHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    txCategory: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    txAmount: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
    },
    txFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    txSubcategory: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.medium,
        color: Colors.gray[500],
    },
    timeWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    txTime: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.medium,
        color: Colors.gray[400],
    },
    txNote: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.regular,
        color: Colors.gray[500],
        fontStyle: 'italic',
        marginTop: 8,
    },
    actions: {
        width: '100%',
        gap: 12,
    },
    saveBtn: {
        width: '100%',
        paddingVertical: 16,
        backgroundColor: Colors.warning[500],
        borderRadius: 16,
        alignItems: 'center',
    },
    saveBtnText: {
        color: Colors.white,
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
    },
    cancelBtn: {
        width: '100%',
        paddingVertical: 16,
        backgroundColor: Colors.gray[100],
        borderRadius: 16,
        alignItems: 'center',
    },
    cancelBtnText: {
        color: Colors.gray[700],
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
    },
});
