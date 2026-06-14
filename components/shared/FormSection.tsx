import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Typography, Colors, Layout } from '../../constants/Theme';

interface FormSectionProps {
    title: string;
    children: React.ReactNode;
    style?: ViewStyle;
}

export const FormSection: React.FC<FormSectionProps> = ({ title, children, style }) => {
    return (
        <View style={[styles.container, style]}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.content}>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: Layout.spacing.xl,
    },
    title: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.medium,
        color: Colors.gray[600],
        marginBottom: Layout.spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    content: {
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.lg,
        ...Layout.shadows.sm,
        overflow: 'hidden',
    }
});
