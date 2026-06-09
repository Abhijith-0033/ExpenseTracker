import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { 
    useAnimatedStyle, 
    useSharedValue, 
    withSpring, 
    withTiming, 
    runOnJS,
    Easing
} from 'react-native-reanimated';
import { Colors, Typography, Layout } from '../constants/Theme';

interface SnackbarProps {
    visible: boolean;
    message: string;
    onUndo?: () => void;
    onDismiss?: () => void;
    duration?: number;
    bottomOffset?: number;
}

export const Snackbar: React.FC<SnackbarProps> = ({
    visible,
    message,
    onUndo,
    onDismiss,
    duration = 4000,
    bottomOffset = 82 // Default to sit above standard Android bottom tab
}) => {
    const [render, setRender] = useState(visible);
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(20);
    const progressWidth = useSharedValue(100);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Enter animation
    const animateIn = () => {
        setRender(true);
        opacity.value = withTiming(1, { duration: 250 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
        
        progressWidth.value = 100;
        progressWidth.value = withTiming(0, { 
            duration, 
            easing: Easing.linear 
        });

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        
        timeoutRef.current = setTimeout(() => {
            handleDismiss();
        }, duration);
    };

    // Exit animation
    const animateOut = () => {
        opacity.value = withTiming(0, { duration: 250 }, (finished) => {
            if (finished) {
                runOnJS(setRender)(false);
            }
        });
        translateY.value = withTiming(20, { duration: 250 });
    };

    const handleDismiss = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        animateOut();
        if (onDismiss) onDismiss();
    };

    const handleUndo = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        animateOut();
        if (onUndo) onUndo();
    };

    useEffect(() => {
        if (visible) {
            animateIn();
        } else if (render) {
            // Only animate out if we are currently rendering it
            // (this handles cases where parent explicitly sets visible=false)
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            animateOut();
        }
        
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [visible, message, render, animateIn, animateOut]); // Re-animate if message changes while visible

    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
            transform: [{ translateY: translateY.value }],
        };
    });

    const progressStyle = useAnimatedStyle(() => {
        return {
            width: `${progressWidth.value}%`,
        };
    });

    if (!render) return null;

    return (
        <Animated.View style={[styles.container, { bottom: bottomOffset }, animatedStyle]}>
            <View style={styles.content}>
                <Text style={styles.message} numberOfLines={2}>{message}</Text>
                
                {onUndo && (
                    <TouchableOpacity onPress={handleUndo} style={styles.actionBtn} activeOpacity={0.7}>
                        <Text style={styles.actionText}>UNDO</Text>
                    </TouchableOpacity>
                )}
            </View>
            <View style={styles.progressContainer}>
                <Animated.View style={[styles.progressBar, progressStyle]} />
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 16,
        right: 16,
        backgroundColor: Colors.gray[900], // #111827 or similar
        borderRadius: 12,
        ...Layout.shadows.md,
        elevation: 6,
        overflow: 'hidden',
        zIndex: 9999, // Ensure it's above other elements
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    message: {
        flex: 1,
        color: Colors.white,
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.medium,
        marginRight: 12,
    },
    actionBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    actionText: {
        color: Colors.primary[400], // slightly brighter than 500 for dark bg
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        letterSpacing: 1,
    },
    progressContainer: {
        height: 3,
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.1)',
        position: 'absolute',
        bottom: 0,
        left: 0,
    },
    progressBar: {
        height: '100%',
        backgroundColor: Colors.primary[500],
    }
});
