import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { X, Wallet, PieChart, Target, TrendingUp, Calculator, CreditCard, Users, ChevronRight, Calendar, Lock, Clock } from 'lucide-react-native';
import { Colors, Typography } from '../constants/Theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '../src/subscription/useSubscription';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_WIDTH = SCREEN_WIDTH * 0.82;

interface MenuItem {
    id: string;
    title: string;
    subtitle: string;
    icon: React.ComponentType<any>;
    bgColor: string;
    iconColor: string;
    disabled?: boolean;
    isPremiumOnly?: boolean;
    badgeCount?: number;
}

interface SidePanelProps {
    visible: boolean;
    onClose: () => void;
    onNavigate: (route: string) => void;
}

export const SidePanel: React.FC<SidePanelProps> = ({ visible, onClose, onNavigate }) => {
    const { isPremium, isTrialActive } = useSubscription();
    const isFreeUser = !isPremium && !isTrialActive;
    const insets = useSafeAreaInsets();
    const translateX = useSharedValue(SCREEN_WIDTH);
    const [render, setRender] = React.useState(false);

    const [pendingApprovalCount, setPendingApprovalCount] = React.useState(0);

    React.useEffect(() => {
        const load = async () => {
            try {
                const { getDatabase, initDatabase } = await import('../services/database');
                await initDatabase();
                const db = getDatabase();
                const result: any = await db.getFirstAsync(
                    `SELECT COUNT(*) as cnt FROM scheduled_expense_log WHERE action = 'pending'`
                );
                setPendingApprovalCount(result?.cnt ?? 0);
            } catch (_e) {
                // silently fail
            }
        };
        if (visible) load();
    }, [visible]);

    useEffect(() => {
        if (visible) {
            setRender(true);
            translateX.value = withSpring(0, {
                damping: 18,
                stiffness: 180,
                mass: 0.8,
            });
        } else {
            translateX.value = withTiming(SCREEN_WIDTH, { duration: 280 }, (finished) => {
                if (finished) runOnJS(setRender)(false);
            });
        }
    }, [translateX, visible]);

    const panGesture = Gesture.Pan()
        .activeOffsetX([-10, 10])
        .onUpdate((e) => {
            if (e.translationX > 0) {
                translateX.value = e.translationX;
            }
        })
        .onEnd((e) => {
            if (e.translationX > PANEL_WIDTH / 3 || e.velocityX > 500) {
                runOnJS(onClose)();
            } else {
                translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
            }
        });

    const animatedPanelStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const animatedBackdropStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            translateX.value,
            [0, SCREEN_WIDTH],
            [1, 0],
            Extrapolate.CLAMP
        ),
    }));

    if (!render) return null;

    const menuItems: MenuItem[] = [
        {
            id: 'account-detail',
            title: 'Account Details',
            subtitle: 'View income & expense by account',
            icon: Wallet,
            bgColor: Colors.primary[100],
            iconColor: Colors.primary[600],
            isPremiumOnly: true,
        },
        {
            id: 'category-detail',
            title: 'Category Insights',
            subtitle: 'Deep dive into your spending',
            icon: PieChart,
            bgColor: Colors.warning[100],
            iconColor: Colors.warning[600],
            isPremiumOnly: true,
        },
        {
            id: 'budgets',
            title: 'Budget Progress',
            subtitle: 'Check your budget status',
            icon: Target,
            bgColor: Colors.danger[100],
            iconColor: Colors.danger[600],
        },
        {
            id: 'income-breakdown',
            title: 'Income Breakdown',
            subtitle: 'Analyze your earning sources',
            icon: TrendingUp,
            bgColor: Colors.success[100],
            iconColor: Colors.success[600],
            isPremiumOnly: true,
        },
        {
            id: 'debt-calculator',
            title: 'Debt Calculator',
            subtitle: 'When will you be debt-free?',
            icon: Calculator,
            bgColor: '#EDE9FE',
            iconColor: '#7C3AED',
        },
        {
            id: 'debt-tracker',
            title: 'Debt Tracker',
            subtitle: 'Track loans and repayments',
            icon: CreditCard,
            bgColor: 'rgba(239, 68, 68, 0.1)',
            iconColor: '#EF4444',
            isPremiumOnly: true,
        },
        {
            id: 'chit-funds',
            title: 'Chit Funds',
            subtitle: 'Manage chit fund investments',
            icon: Users,
            bgColor: 'rgba(16, 185, 129, 0.1)',
            iconColor: '#10B981',
            isPremiumOnly: true,
        },
        {
            id: 'emi-tracker',
            title: 'EMI Tracker',
            subtitle: 'Track loan EMI payments',
            icon: Calendar,
            bgColor: 'rgba(156, 39, 176, 0.1)',
            iconColor: '#9C27B0',
            isPremiumOnly: true,
        },
        {
            id: 'scheduled-expenses',
            title: 'Scheduled Expenses',
            subtitle: 'Automate recurring payments',
            icon: Clock,
            bgColor: 'rgba(99, 102, 241, 0.1)',
            iconColor: '#6366F1',
            isPremiumOnly: true,
            badgeCount: pendingApprovalCount > 0 ? pendingApprovalCount : undefined,
        },
    ];

    return (
        <View style={styles.wrapper}>
            <Animated.View style={[styles.backdrop, animatedBackdropStyle]}>
                <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
            </Animated.View>

            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.panel, animatedPanelStyle]}>
                    <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
                        <View>
                            <Text style={styles.headerTitle}>Premium Tools</Text>
                            <Text style={styles.headerSubtitle}>Quick access to financial features</Text>
                        </View>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <X size={24} color={Colors.gray[500]} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={styles.menuContainer}>
                        {menuItems.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={[styles.menuItem, item.disabled && styles.menuItemDisabled]}
                                activeOpacity={0.7}
                                disabled={item.disabled}
                                onPress={() => {
                                    onClose();
                                    setTimeout(() => onNavigate(item.id), 300);
                                }}
                            >
                                <View style={[styles.iconBox, { backgroundColor: item.bgColor }]}>
                                    <item.icon size={22} color={item.iconColor} />
                                </View>
                                <View style={styles.menuTextContent}>
                                    <Text style={styles.menuTitle}>{item.title}</Text>
                                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                                </View>
                                {item.badgeCount !== undefined && (
                                    <View style={styles.menuBadge}>
                                        <Text style={styles.menuBadgeText}>{item.badgeCount}</Text>
                                    </View>
                                )}
                                {item.isPremiumOnly && isFreeUser ? (
                                    <View style={styles.lockIconWrapper}>
                                        <Lock size={14} color={Colors.primary[500]} />
                                    </View>
                                ) : (
                                    !item.disabled && <ChevronRight size={20} color={Colors.gray[300]} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
                        <Text style={styles.versionText}>Gastos v3.5.0 (Build 45)</Text>
                    </View>
                </Animated.View>
            </GestureDetector>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        elevation: 1000,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(16,24,40,0.45)',
    },
    backdropTouch: {
        flex: 1,
    },
    panel: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        width: PANEL_WIDTH,
        backgroundColor: Colors.white,
        borderTopLeftRadius: 32,
        borderBottomLeftRadius: 32,
        shadowColor: '#101828',
        shadowOffset: { width: -8, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 24,
        borderBottomWidth: 1,
        borderColor: Colors.gray[100],
    },
    headerTitle: {
        fontSize: Typography.size.xl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.medium,
        color: Colors.gray[500],
    },
    closeBtn: {
        padding: 8,
        backgroundColor: Colors.gray[50],
        borderRadius: 20,
    },
    menuContainer: {
        paddingTop: 16,
        paddingBottom: 40,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
    },
    menuItemDisabled: {
        opacity: 0.5,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    menuTextContent: {
        flex: 1,
    },
    menuTitle: {
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        marginBottom: 2,
    },
    menuSubtitle: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.medium,
        color: Colors.gray[500],
    },
    footer: {
        alignItems: 'center',
        paddingTop: 16,
        borderTopWidth: 1,
        borderColor: Colors.gray[100],
    },
    versionText: {
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.regular,
        color: Colors.gray[400],
        textAlign: 'center',
    },
    lockIconWrapper: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuBadge: {
        backgroundColor: Colors.danger[500],
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 5,
        marginLeft: 'auto',
        marginRight: 8,
    },
    menuBadgeText: {
        fontSize: 10,
        fontFamily: Typography.family.bold,
        color: Colors.white,
    },
});
