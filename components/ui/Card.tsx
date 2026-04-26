import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { Colors, Layout } from '../../constants/Theme';
import { BlurView } from 'expo-blur';

interface CardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    variant?: 'default' | 'elevated' | 'outlined' | 'glass';
}

export const Card: React.FC<CardProps> = ({ children, style, variant = 'elevated' }) => {
    const isGlass = variant === 'glass';

    const renderContent = () => (
        <View style={[
            styles.base,
            variant === 'outlined' && styles.outlined,
            variant === 'elevated' && styles.elevated,
            isGlass && styles.glassBase,
            style
        ]}>
            {children}
        </View>
    );

    if (isGlass && Platform.OS === 'ios') {
        return (
            <BlurView intensity={20} tint="light" style={[styles.glassWrapper, style]}>
                {children}
            </BlurView>
        );
    }

    return renderContent();
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
    glassBase: {
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        ...Layout.shadows.md,
    },
    glassWrapper: {
        borderRadius: Layout.radius.lg,
        padding: Layout.spacing.md,
        marginVertical: 6,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        ...Layout.shadows.sm,
    },
    default: {
        // Just background and radius
    }
});
