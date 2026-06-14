import { StyleSheet } from 'react-native';
import { Colors, Layout, Typography, SemanticColors } from '../constants/Theme';

export const commonStyles = StyleSheet.create({
    screenContainer: {
        flex: 1,
        backgroundColor: Colors.gray[50],
    },
    scrollViewContent: {
        paddingHorizontal: Layout.spacing.md,
        paddingBottom: Layout.spacing.xl,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Layout.spacing.md,
        paddingTop: 60,
        paddingBottom: Layout.spacing.md,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[200],
    },
    headerTitle: {
        fontSize: Typography.size.xl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    card: {
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.lg,
        padding: Layout.spacing.md,
        marginBottom: Layout.spacing.md,
        ...Layout.shadows.sm,
    },
    sectionTitle: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        marginBottom: Layout.spacing.md,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    rowCenter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    primaryButton: {
        backgroundColor: Colors.primary[600],
        borderRadius: Layout.radius.md,
        paddingVertical: Layout.spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: Colors.white,
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
    },
    inputLabel: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        color: Colors.gray[700],
        marginBottom: Layout.spacing.xs,
    },
    input: {
        backgroundColor: Colors.gray[50],
        borderWidth: 1,
        borderColor: Colors.gray[200],
        borderRadius: Layout.radius.md,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: Typography.size.md,
        fontFamily: Typography.family.regular,
        color: Colors.gray[900],
        marginBottom: Layout.spacing.md,
    },
    errorText: {
        color: SemanticColors.expense,
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.medium,
        marginTop: 4,
    },
    emptyListText: {
        textAlign: 'center',
        fontSize: Typography.size.md,
        fontFamily: Typography.family.regular,
        color: Colors.gray[400],
        paddingVertical: Layout.spacing.xl,
    }
});
