import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Wallet, ChevronRight, TrendingUp, TrendingDown, Layers, RotateCcw } from 'lucide-react-native';
import { formatCurrency } from '../utils/currency';
import { AnimatedBalance } from './AnimatedBalance';
import { useTheme, BalanceCardVariant } from '../context/ThemeContext';

const { width: _SCREEN_WIDTH } = Dimensions.get('window');

interface Account {
  id: number;
  name: string;
  balance: number;
  type: string;
}

interface FlippableBalanceCardProps {
  totalBalance: number;
  accounts: Account[];
  variant?: BalanceCardVariant;
}

export const FlippableBalanceCard: React.FC<FlippableBalanceCardProps> = ({
  totalBalance,
  accounts,
  variant: propVariant,
}) => {
  const { colors, radius, themeConfig } = useTheme();
  const variant = propVariant || themeConfig.balanceCardVariant || 'gradient_flip';

  // ALL hooks declared here — before any variant if-blocks
  const [isFlipped, setIsFlipped] = useState(false);
  const rotateY = useSharedValue(0);

  const flip = () => {
    const next = !isFlipped;
    setIsFlipped(next);
    rotateY.value = withTiming(next ? 180 : 0, { duration: 600 });
  };

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateValue = interpolate(rotateY.value, [0, 180], [0, 180], Extrapolate.CLAMP);
    return {
      transform: [{ rotateY: `${rotateValue}deg` }],
      zIndex: isFlipped ? 0 : 1,
      opacity: rotateValue > 90 ? 0 : 1,
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateValue = interpolate(rotateY.value, [0, 180], [-180, 0], Extrapolate.CLAMP);
    return {
      transform: [{ rotateY: `${rotateValue}deg` }],
      zIndex: isFlipped ? 1 : 0,
      opacity: rotateValue < -90 ? 0 : 1,
    };
  });

  const assets = accounts.filter(a => a.balance > 0).reduce((sum, a) => sum + a.balance, 0);
  const liabilities = Math.abs(
    accounts.filter(a => a.balance < 0).reduce((sum, a) => sum + a.balance, 0)
  );

  // ── Shared back face: Account Breakdown list (used by ALL 4 variants) ──────
  const renderBack = () => (
    <Animated.View
      style={[
        styles.card,
        styles.cardBack,
        { borderRadius: radius.xl, backgroundColor: colors.success[700] },
        backAnimatedStyle,
      ]}
    >
      <LinearGradient
        colors={[colors.success[600], colors.success[700]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.backGradient, { borderRadius: radius.xl }]}
      >
        <View style={styles.backHeader}>
          <Text style={styles.backTitle}>Account Breakdown</Text>
          {/* Tap this to flip back — the ONLY pressable element on the back face */}
          <Pressable onPress={flip} hitSlop={8} style={styles.flipBackBtn}>
            <RotateCcw size={14} color="white" />
          </Pressable>
        </View>
        {accounts.length > 3 && (
          <Text style={styles.backSubtitle}>Scroll to see all {accounts.length}</Text>
        )}
        {/* This ScrollView can now capture scroll events since nothing above it is Pressable */}
        <ScrollView
          style={styles.accountList}
          contentContainerStyle={styles.accountListContent}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          scrollEnabled={true}
          bounces={false}
        >
          {accounts.map((acc, index) => (
            <View
              key={acc.id}
              style={[
                styles.accountItem,
                index === accounts.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={styles.accountInfo}>
                <Text style={styles.accountName} numberOfLines={1}>{acc.name}</Text>
                <Text style={styles.accountType}>{acc.type}</Text>
              </View>
              <Text style={styles.accountBalance}>{formatCurrency(acc.balance)}</Text>
            </View>
          ))}
        </ScrollView>
      </LinearGradient>
    </Animated.View>
  );
  // ────────────────────────────────────────────────────────────────────────────

  // ── Variant: minimal_white ──────────────────────────────────────────────────
  if (variant === 'minimal_white') {
    return (
      <View style={styles.container}>
        <View style={styles.cardContainer}>
          <Animated.View
            style={[
              styles.card,
              {
                borderRadius: radius.xl,
                backgroundColor: colors.white,
                borderColor: colors.gray[200],
                borderWidth: 1,
              },
              frontAnimatedStyle,
            ]}
          >
            <Pressable onPress={flip} style={styles.flipPressable}>
              <View style={styles.variantInner}>
                <View style={styles.header}>
                  <View>
                    <Text style={[styles.label, { color: colors.gray[500] }]}>Total Balance</Text>
                    <AnimatedBalance
                      value={totalBalance}
                      style={[styles.balanceText, { color: colors.gray[900] }]}
                    />
                  </View>
                  <View style={[styles.iconBadge, { backgroundColor: colors.primary[50] }]}>
                    <Wallet size={24} color={colors.primary[600]} />
                  </View>
                </View>
                <View style={styles.footerRow}>
                  <Text style={[styles.subText, { color: colors.gray[500] }]}>
                    {accounts.length} Accounts · Tap to see all
                  </Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>
          {renderBack()}
        </View>
      </View>
    );
  }

  // ── Variant: compact_dark ───────────────────────────────────────────────────
  if (variant === 'compact_dark') {
    return (
      <View style={styles.container}>
        <View style={styles.cardContainer}>
          <Animated.View
            style={[
              styles.card,
              { borderRadius: radius.xl, backgroundColor: colors.gray[900] },
              frontAnimatedStyle,
            ]}
          >
            <Pressable onPress={flip} style={styles.flipPressable}>
              <View style={styles.variantInner}>
                <View style={styles.header}>
                  <View>
                    <Text style={[styles.label, { color: 'rgba(255,255,255,0.7)' }]}>
                      Total Balance
                    </Text>
                    <AnimatedBalance
                      value={totalBalance}
                      style={[styles.balanceText, { color: '#FFF' }]}
                    />
                  </View>
                  <Wallet size={28} color="rgba(255,255,255,0.3)" />
                </View>
                <View style={styles.compactAccountList}>
                  {accounts.slice(0, 3).map(acc => (
                    <View key={acc.id} style={styles.compactAccountChip}>
                      <Text style={styles.compactAccountName} numberOfLines={1}>
                        {acc.name}
                      </Text>
                      <Text style={styles.compactAccountBalance}>
                        {formatCurrency(acc.balance)}
                      </Text>
                    </View>
                  ))}
                </View>
                {accounts.length > 3 && (
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.4)',
                      fontSize: 10,
                      marginTop: 6,
                      textAlign: 'center',
                    }}
                  >
                    +{accounts.length - 3} more · Tap to see all
                  </Text>
                )}
              </View>
            </Pressable>
          </Animated.View>
          {renderBack()}
        </View>
      </View>
    );
  }

  // ── Variant: net_worth ──────────────────────────────────────────────────────
  if (variant === 'net_worth') {
    return (
      <View style={styles.container}>
        <View style={styles.cardContainer}>
          <Animated.View style={[styles.card, { borderRadius: radius.xl }, frontAnimatedStyle]}>
            <Pressable onPress={flip} style={styles.flipPressable}>
              <LinearGradient
                colors={[colors.primary[700], colors.primary[900]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.gradient, { borderRadius: radius.xl }]}
              >
                <View style={styles.header}>
                  <View>
                    <Text style={[styles.label, { color: 'rgba(255,255,255,0.8)' }]}>
                      Net Position
                    </Text>
                    <AnimatedBalance
                      value={totalBalance}
                      style={[styles.balanceText, { color: '#FFF' }]}
                    />
                  </View>
                  <Layers size={28} color="rgba(255,255,255,0.4)" />
                </View>
                <View style={styles.netWorthRow}>
                  <View style={styles.netWorthCol}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <TrendingUp size={14} color="#34D399" />
                      <Text style={styles.netWorthLabel}>Assets</Text>
                    </View>
                    <Text style={styles.netWorthValue}>{formatCurrency(assets)}</Text>
                  </View>
                  <View style={styles.netWorthCol}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <TrendingDown size={14} color="#F87171" />
                      <Text style={styles.netWorthLabel}>Liabilities</Text>
                    </View>
                    <Text style={styles.netWorthValue}>{formatCurrency(liabilities)}</Text>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
          {renderBack()}
        </View>
      </View>
    );
  }

  // ── Default Variant: gradient_flip ─────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.cardContainer}>
        {/* Front Side */}
        <Animated.View style={[styles.card, { borderRadius: radius.xl }, frontAnimatedStyle]}>
          <Pressable onPress={flip} style={styles.flipPressable}>
            <LinearGradient
              colors={[colors.primary[600], colors.primary[400]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.gradient, { borderRadius: radius.xl }]}
            >
              <View style={styles.decCircle1} />
              <View style={styles.decCircle2} />

              <View style={styles.header}>
                <View style={styles.labelContainer}>
                  <Text style={styles.label}>Total Balance</Text>
                </View>
                <Wallet size={32} color="rgba(255,255,255,0.3)" />
              </View>

              <View style={styles.main}>
                <AnimatedBalance value={totalBalance} style={styles.balanceText} />
              </View>

              <View style={styles.footer}>
                <Text style={styles.accountCount}>{accounts.length} Active Accounts</Text>
                <View style={styles.flipIndicator}>
                  <ChevronRight size={16} color="white" />
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* Back Side — plain Animated.View, NOT wrapped in Pressable → scroll works */}
        {renderBack()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 0,
    marginVertical: 10,
    height: 200,
  },
  cardContainer: {
    flex: 1,
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    backgroundColor: '#377A55',
  },
  flipPressable: {
    flex: 1,
  },
  variantInner: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  gradient: {
    flex: 1,
    padding: 24,
    overflow: 'hidden',
  },
  decCircle1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  decCircle2: {
    position: 'absolute',
    bottom: -30,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  labelContainer: {
    gap: 4,
  },
  label: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  main: {
    flex: 1,
    justifyContent: 'center',
    marginTop: 10,
  },
  balanceText: {
    color: 'white',
    fontSize: 38,
    fontFamily: 'DMSans_700Bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerRow: {
    marginTop: 16,
  },
  subText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
  },
  accountCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
  },
  flipIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backGradient: {
    flex: 1,
    padding: 18,
  },
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  backTitle: {
    color: 'white',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  backSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontFamily: 'DMSans_500Medium',
    marginBottom: 6,
  },
  flipBackBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountList: {
    flex: 1,
  },
  accountListContent: {
    paddingBottom: 4,
  },
  accountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  accountInfo: {
    gap: 2,
    flex: 1,
    marginRight: 8,
  },
  accountName: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  accountType: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontFamily: 'DMSans_500Medium',
  },
  accountBalance: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  compactAccountList: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  compactAccountChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    borderRadius: 12,
  },
  compactAccountName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontFamily: 'DMSans_500Medium',
  },
  compactAccountBalance: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    marginTop: 2,
  },
  netWorthRow: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  netWorthCol: {
    flex: 1,
  },
  netWorthLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontFamily: 'DMSans_500Medium',
  },
  netWorthValue: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    marginTop: 4,
  },
});
