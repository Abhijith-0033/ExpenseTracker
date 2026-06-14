/**
 * MetricCard.tsx
 * 
 * Reusable card for displaying a single Finance Lab metric.
 * Tappable to open a detail modal.
 */

import React from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Dimensions
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Colors, Typography, Layout } from '../constants/Theme';

const screenWidth = Dimensions.get('window').width;
const CARD_WIDTH = (screenWidth - 48 - 12) / 2; // 2 columns with margins

interface MetricCardProps {
    icon: string;
    title: string;
    value: string;
    subtitle?: string;
    status?: string;
    statusColor?: string;
    onPress?: () => void;
    index?: number;
    accentColor?: string;
    fullWidth?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
    icon,
    title,
    value,
    subtitle,
    status,
    statusColor = Colors.primary[500],
    onPress,
    index = 0,
    accentColor = Colors.primary[500],
    fullWidth = false,
}) => {
    return (
        <Animated.View
            entering={FadeInUp.delay(index * 80).duration(600)}
            style={[styles.wrapper, fullWidth && styles.fullWidthWrapper]}
        >
            <TouchableOpacity
                style={[styles.card, fullWidth && styles.fullWidthCard]}
                onPress={onPress}
                activeOpacity={0.85}
            >
                {/* Top accent bar */}
                <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

                {/* Icon */}
                <Text style={styles.icon}>{icon}</Text>

                {/* Title */}
                <Text style={styles.title} numberOfLines={2}>{title}</Text>

                {/* Main value */}
                <Text style={[styles.value, { color: accentColor }]} numberOfLines={1} adjustsFontSizeToFit>
                    {value}
                </Text>

                {/* Status badge */}
                {status ? (
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
                    </View>
                ) : null}

                {/* Subtitle */}
                {subtitle ? (
                    <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
                ) : null}

                {/* Tap hint */}
                <Text style={styles.tapHint}>Tap for details →</Text>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        width: CARD_WIDTH,
        marginBottom: 12,
    },
    fullWidthWrapper: {
        width: '100%',
    },
    card: {
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.lg,
        padding: 16,
        minHeight: 160,
        ...Layout.shadows.sm,
        overflow: 'hidden',
    },
    fullWidthCard: {
        minHeight: 100,
    },
    accentBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        borderTopLeftRadius: Layout.radius.lg,
        borderTopRightRadius: Layout.radius.lg,
    },
    icon: {
        fontSize: 24,
        marginTop: 8,
        marginBottom: 6,
    },
    title: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
        color: Colors.gray[500],
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    value: {
        fontSize: 22,
        fontFamily: Typography.family.bold,
        marginBottom: 8,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 20,
        marginBottom: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 5,
    },
    statusText: {
        fontSize: 11,
        fontFamily: Typography.family.bold,
    },
    subtitle: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.regular,
        color: Colors.gray[400],
        marginBottom: 4,
    },
    tapHint: {
        fontSize: 10,
        color: Colors.gray[300],
        fontFamily: Typography.family.medium,
        marginTop: 4,
    },
});
