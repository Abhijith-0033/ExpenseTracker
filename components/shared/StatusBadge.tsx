import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Typography } from '../../constants/Theme';

interface StatusBadgeProps {
    label: string;
    color: string;
    size?: 'sm' | 'md';
    style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
    label, 
    color, 
    size = 'sm',
    style 
}) => {
    return (
        <View style={[
            styles.badge, 
            { backgroundColor: `${color}1A` }, // 10% opacity hex
            size === 'sm' ? styles.badgeSm : styles.badgeMd,
            style
        ]}>
            <Text style={[
                styles.text,
                { color },
                size === 'sm' ? styles.textSm : styles.textMd
            ]}>
                {label.toUpperCase()}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        borderRadius: 12,
        alignSelf: 'flex-start',
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeSm: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    badgeMd: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    text: {
        fontFamily: Typography.family.bold,
        letterSpacing: 0.5,
    },
    textSm: {
        fontSize: 10,
    },
    textMd: {
        fontSize: 12,
    }
});
