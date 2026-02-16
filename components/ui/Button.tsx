
import React from 'react';
import { Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Pressable } from 'react-native';
import { Colors, Layout } from '../../constants/Theme';

interface ButtonProps {
    onPress: () => void;
    title: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    loading?: boolean;
    style?: ViewStyle;
    icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    onPress,
    title,
    variant = 'primary',
    loading = false,
    style,
    icon
}) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.96);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    const getBackgroundColor = () => {
        switch (variant) {
            case 'primary': return Colors.primary[600];
            case 'secondary': return Colors.gray[100];
            case 'danger': return Colors.danger[500];
            case 'ghost': return 'transparent';
            default: return Colors.primary[600];
        }
    };

    const getTextColor = () => {
        if (variant === 'secondary') return Colors.gray[800];
        if (variant === 'ghost') return Colors.primary[600];
        return Colors.white;
    };

    return (
        <Pressable
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={loading}
        >
            <Animated.View style={[
                styles.button,
                { backgroundColor: getBackgroundColor() },
                variant === 'primary' && Layout.shadows.md, // Shadow for primary
                style,
                animatedStyle
            ]}>
                {loading ? (
                    <ActivityIndicator color={getTextColor()} />
                ) : (
                    <>
                        {icon && icon}
                        <Text style={[styles.text, { color: getTextColor(), marginLeft: icon ? 8 : 0 }]}>{title}</Text>
                    </>
                )}
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    button: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: Layout.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    text: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
});
