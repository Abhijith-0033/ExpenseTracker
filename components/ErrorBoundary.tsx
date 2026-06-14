import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { AlertTriangle, RotateCcw } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../constants/Theme';
import { FallbackProps } from 'react-error-boundary';

export const TabErrorFallback: React.FC<FallbackProps> = ({
    error,
    resetErrorBoundary
}) => {
    const err = error as any;
    return (
        <View style={styles.tabContainer}>
            <View style={styles.card}>
                <AlertTriangle size={36} color={Colors.danger[500]} style={styles.icon} />
                <Text style={styles.title}>Section Error</Text>
                <Text style={styles.message}>
                    Something went wrong while rendering this section.
                </Text>
                <Text style={styles.errorText}>{err?.message || String(error)}</Text>
                <TouchableOpacity style={styles.button} onPress={resetErrorBoundary}>
                    <RotateCcw size={16} color={Colors.white} style={styles.buttonIcon} />
                    <Text style={styles.buttonText}>Try Again</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export const RootErrorFallback: React.FC<FallbackProps> = ({
    error,
    resetErrorBoundary
}) => {
    const err = error as any;
    return (
        <ScrollView contentContainerStyle={styles.rootContainer}>
            <View style={styles.rootContent}>
                <AlertTriangle size={64} color={Colors.danger[500]} style={styles.rootIcon} />
                <Text style={styles.rootTitle}>App Encountered an Error</Text>
                <Text style={styles.rootMessage}>
                    ExpenseTracker has encountered a critical error and needs to restart.
                </Text>
                <View style={styles.errorDetailsContainer}>
                    <Text style={styles.errorDetailsTitle}>Error Details:</Text>
                    <Text style={styles.errorDetailsText}>{err?.message || String(error)}</Text>
                    {err?.stack && (
                        <Text style={styles.stackText} numberOfLines={8}>
                            {err.stack}
                        </Text>
                    )}
                </View>
                <TouchableOpacity style={styles.rootButton} onPress={resetErrorBoundary}>
                    <RotateCcw size={20} color={Colors.white} style={styles.buttonIcon} />
                    <Text style={styles.rootButtonText}>Restart Application</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    tabContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Layout.spacing.lg,
        backgroundColor: Colors.gray[50],
    },
    card: {
        width: '100%',
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.lg,
        padding: Layout.spacing.lg,
        alignItems: 'center',
        ...Layout.shadows.md,
    },
    icon: {
        marginBottom: Layout.spacing.sm,
    },
    title: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        color: Colors.gray[800],
        marginBottom: Layout.spacing.xs,
    },
    message: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.regular,
        color: Colors.gray[500],
        textAlign: 'center',
        marginBottom: Layout.spacing.md,
    },
    errorText: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.regular,
        color: Colors.danger[700],
        backgroundColor: Colors.danger[50],
        padding: Layout.spacing.sm,
        borderRadius: Layout.radius.sm,
        width: '100%',
        textAlign: 'center',
        marginBottom: Layout.spacing.lg,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary[600],
        paddingHorizontal: Layout.spacing.md,
        paddingVertical: Layout.spacing.sm,
        borderRadius: Layout.radius.md,
    },
    buttonIcon: {
        marginRight: Layout.spacing.xs,
    },
    buttonText: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.medium,
        color: Colors.white,
    },
    rootContainer: {
        flexGrow: 1,
        backgroundColor: Colors.gray[50],
        justifyContent: 'center',
        padding: Layout.spacing.xl,
    },
    rootContent: {
        alignItems: 'center',
    },
    rootIcon: {
        marginBottom: Layout.spacing.lg,
    },
    rootTitle: {
        fontSize: Typography.size.xl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        textAlign: 'center',
        marginBottom: Layout.spacing.sm,
    },
    rootMessage: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.regular,
        color: Colors.gray[500],
        textAlign: 'center',
        marginBottom: Layout.spacing.xl,
    },
    errorDetailsContainer: {
        width: '100%',
        backgroundColor: Colors.gray[100],
        padding: Layout.spacing.md,
        borderRadius: Layout.radius.md,
        borderWidth: 1,
        borderColor: Colors.gray[200],
        marginBottom: Layout.spacing.xl,
    },
    errorDetailsTitle: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        color: Colors.gray[800],
        marginBottom: Layout.spacing.xs,
    },
    errorDetailsText: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.regular,
        color: Colors.danger[700],
        marginBottom: Layout.spacing.sm,
    },
    stackText: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.regular,
        color: Colors.gray[400],
    },
    rootButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary[600],
        paddingHorizontal: Layout.spacing.lg,
        paddingVertical: Layout.spacing.md,
        borderRadius: Layout.radius.lg,
        ...Layout.shadows.xl,
    },
    rootButtonText: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.white,
    },
});
