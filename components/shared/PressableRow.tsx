import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';

interface PressableRowProps {
    leftIcon?: React.ReactNode;
    title: string;
    subtitle?: string;
    rightElement?: React.ReactNode;
    onPress?: () => void;
    showChevron?: boolean;
    style?: ViewStyle;
}

export const PressableRow: React.FC<PressableRowProps> = ({
    leftIcon,
    title,
    subtitle,
    rightElement,
    onPress,
    showChevron = true,
    style
}) => {
    return (
        <TouchableOpacity 
            style={[styles.container, style]} 
            onPress={onPress}
            activeOpacity={onPress ? 0.7 : 1}
            disabled={!onPress}
        >
            {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}
            
            <View style={styles.textContainer}>
                <Text style={styles.title}>{title}</Text>
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>

            <View style={styles.rightContainer}>
                {rightElement}
                {showChevron && onPress && !rightElement && (
                    <ChevronRight size={20} color={Colors.gray[400]} />
                )}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Layout.spacing.md,
        paddingHorizontal: Layout.spacing.lg,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[100],
    },
    iconContainer: {
        marginRight: Layout.spacing.md,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.gray[50],
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    title: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.medium,
        color: Colors.gray[900],
    },
    subtitle: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.regular,
        color: Colors.gray[500],
        marginTop: 2,
    },
    rightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: Layout.spacing.sm,
    }
});
