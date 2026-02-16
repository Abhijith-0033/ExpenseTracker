
import React, { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { ViewStyle } from 'react-native';

interface AnimatedItemProps {
    children: React.ReactNode;
    index: number;
    style?: ViewStyle;
}

export const AnimatedItem: React.FC<AnimatedItemProps> = ({ children, index, style }) => {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(20);

    useEffect(() => {
        const delay = index * 50; // Stagger by 50ms
        opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
        translateY.value = withDelay(delay, withSpring(0, { damping: 12 }));
    }, [index]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    return (
        <Animated.View style={[style, animatedStyle]}>
            {children}
        </Animated.View>
    );
};
