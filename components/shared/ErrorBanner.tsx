import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertCircle, RefreshCw } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';

interface ErrorBannerProps {
    visible: boolean;
    message: string;
    onRetry?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ visible, message, onRetry }) => {
    if (!visible) return null;

    return (
        <View style={styles.container}>
            <AlertCircle size={20} color={Colors.danger[500]} />
            <Text style={styles.message}>{message}</Text>
            {onRetry && (
                <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
                    <RefreshCw size={14} color={Colors.danger[500]} />
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${Colors.danger[500]}1A`,
        padding: Layout.spacing.md,
        borderRadius: Layout.radius.md,
        marginBottom: Layout.spacing.md,
        borderWidth: 1,
        borderColor: `${Colors.danger[500]}33`,
    },
    message: {
        flex: 1,
        marginLeft: Layout.spacing.sm,
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.medium,
        color: Colors.danger[500],
    },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Layout.spacing.xs,
        marginLeft: Layout.spacing.sm,
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.sm,
    },
    retryText: {
        marginLeft: 4,
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
        color: Colors.danger[500],
    }
});
