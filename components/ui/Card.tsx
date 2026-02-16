
import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors, Layout } from '../../constants/Theme';

interface CardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    variant?: 'default' | 'elevated' | 'outlined';
}

export const Card: React.FC<CardProps> = ({ children, style, variant = 'elevated' }) => {
    const getStyle = () => {
        if (variant === 'outlined') return styles.outlined;
        if (variant === 'elevated') return styles.elevated;
        return styles.default;
    };

    return (
        <View style={[
            styles.base,
            getStyle(),
            style
        ]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    base: {
        borderRadius: Layout.radius.lg,
        padding: Layout.spacing.md,
        backgroundColor: Colors.white,
        marginVertical: 6,
    },
    elevated: {
        ...Layout.shadows.sm,
    },
    outlined: {
        borderWidth: 1,
        borderColor: Colors.gray[200],
    },
    default: {
        // Just background and radius
    }
});
