import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';

interface ConfirmSheetProps {
    visible: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    destructive?: boolean;
}

export const ConfirmSheet: React.FC<ConfirmSheetProps> = ({
    visible,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    destructive = false
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
                <TouchableWithoutFeedback>
                    <View style={styles.sheet}>
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.message}>{message}</Text>
                        
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
                                <Text style={styles.cancelText}>{cancelLabel}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[
                                    styles.button, 
                                    destructive ? styles.destructiveButton : styles.confirmButton
                                ]} 
                                onPress={onConfirm}
                            >
                                <Text style={styles.confirmText}>{confirmLabel}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Layout.spacing.xl,
    },
    sheet: {
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.xl,
        padding: Layout.spacing.xl,
        width: '100%',
        maxWidth: 400,
        ...Layout.shadows.lg,
    },
    title: {
        fontSize: Typography.size.xl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        marginBottom: Layout.spacing.sm,
        textAlign: 'center',
    },
    message: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.regular,
        color: Colors.gray[600],
        marginBottom: Layout.spacing.xl,
        textAlign: 'center',
        lineHeight: 22,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: Layout.spacing.md,
    },
    button: {
        flex: 1,
        paddingVertical: Layout.spacing.md,
        borderRadius: Layout.radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: Colors.gray[100],
    },
    confirmButton: {
        backgroundColor: Colors.primary[500],
    },
    destructiveButton: {
        backgroundColor: Colors.danger[500],
    },
    cancelText: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.gray[700],
    },
    confirmText: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.white,
    }
});
