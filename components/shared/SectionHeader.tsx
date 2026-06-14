import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';

interface SectionHeaderProps {
    title: string;
    actionLabel?: string;
    onAction?: () => void;
    style?: ViewStyle;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ 
    title, 
    actionLabel, 
    onAction,
    style
}) => {
    return (
        <View style={[styles.container, style]}>
            <Text style={styles.title}>{title}</Text>
            {actionLabel && onAction && (
                <TouchableOpacity style={styles.actionBtn} onPress={onAction}>
                    <Text style={styles.actionText}>{actionLabel}</Text>
                    <ChevronRight size={16} color={Colors.primary[600]} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Layout.spacing.md,
    },
    title: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionText: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.medium,
        color: Colors.primary[600],
        marginRight: 4,
    }
});
