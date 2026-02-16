
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Delete, Check, X } from 'lucide-react-native';
import { Colors, Layout } from '../../constants/Theme';
import * as Haptics from 'expo-haptics';

interface KeypadProps {
    onPress: (val: string) => void;
    onDelete: () => void;
    onSubmit: () => void;
    onClear: () => void;
    disabled?: boolean;
}

export const Keypad: React.FC<KeypadProps> = ({ onPress, onDelete, onSubmit, onClear, disabled }) => {
    const keys = [
        '7', '8', '9', '/',
        '4', '5', '6', '*',
        '1', '2', '3', '-',
        '.', '0', 'C', '+'
    ];
    // Replaced '=' with 'C' in grid, handled submission via large button or distinct action

    const handlePress = (key: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (key === 'C') {
            onClear();
        } else {
            onPress(key);
        }
    };

    const handleDelete = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onDelete();
    };

    const handleSubmit = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSubmit();
    };

    return (
        <View style={styles.container}>
            <View style={styles.grid}>
                {keys.map((key) => {
                    const isOp = ['/', '*', '-', '+', 'C'].includes(key);
                    return (
                        <TouchableOpacity
                            key={key}
                            style={[styles.key, isOp && styles.opKey]}
                            onPress={() => handlePress(key)}
                            activeOpacity={0.6}
                        >
                            <Text style={[styles.keyText, isOp && styles.opKeyText]}>{key}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.actionsRow}>
                <TouchableOpacity
                    style={[styles.actionKey, { backgroundColor: Colors.danger[50] }]}
                    onPress={handleDelete}
                    onLongPress={onClear}
                >
                    <Delete size={24} color={Colors.danger[500]} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionKey, styles.submitKey, disabled && styles.disabledKey]}
                    onPress={handleSubmit}
                    disabled={disabled}
                >
                    <Text style={styles.submitText}>Save Expense</Text>
                    <Check size={20} color={Colors.white} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const windowWidth = Dimensions.get('window').width;
const keySize = (windowWidth - 48) / 4; // 4 cols, padding

const styles = StyleSheet.create({
    container: {
        padding: Layout.spacing.md,
        backgroundColor: Colors.white,
        borderTopLeftRadius: Layout.radius.xl,
        borderTopRightRadius: Layout.radius.xl,
        ...Layout.shadows.lg,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: Layout.spacing.md,
    },
    key: {
        width: keySize,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: Layout.radius.full,
        marginBottom: 12,
    },
    opKey: {
        backgroundColor: Colors.primary[50],
    },
    keyText: {
        fontSize: 24,
        fontWeight: '600',
        color: Colors.gray[900],
    },
    opKeyText: {
        color: Colors.primary[600],
        fontSize: 26,
        fontWeight: '700',
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    actionKey: {
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: Layout.radius.full,
    },
    submitKey: {
        flex: 1,
        marginLeft: 16,
        backgroundColor: Colors.primary[600],
        flexDirection: 'row',
        ...Layout.shadows.md,
    },
    submitText: {
        color: Colors.white,
        fontWeight: '700',
        fontSize: 18,
        marginRight: 8,
    },
    disabledKey: {
        backgroundColor: Colors.gray[300],
        opacity: 0.7,
    }
});
