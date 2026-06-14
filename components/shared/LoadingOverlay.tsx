import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';

interface LoadingOverlayProps {
    visible: boolean;
    message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ visible, message = 'Loading...' }) => {
    if (!visible) return null;
    
    return (
        <View style={styles.overlay}>
            <View style={styles.container}>
                <ActivityIndicator size="large" color={Colors.primary[500]} />
                {message && <Text style={styles.message}>{message}</Text>}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    container: {
        backgroundColor: Colors.white,
        padding: Layout.spacing.xl,
        borderRadius: Layout.radius.lg,
        alignItems: 'center',
        ...Layout.shadows.md,
    },
    message: {
        marginTop: Layout.spacing.md,
        fontSize: Typography.size.md,
        fontFamily: Typography.family.medium,
        color: Colors.gray[700],
    }
});
