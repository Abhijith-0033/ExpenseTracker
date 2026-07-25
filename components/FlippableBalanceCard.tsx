import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Wallet, ChevronRight, TrendingUp, TrendingDown, Layers } from 'lucide-react-native';
import { formatCurrency } from '../utils/currency';
import { AnimatedBalance } from './AnimatedBalance';
import { PressableScale } from './ui/PressableScale';
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

  const [isFlipped, setIsFlipped] = useState(false);
  const rotateY = useSharedValue(0);

  const flip = () => {
    setIsFlipped(!isFlipped);
    rotateY.value = withTiming(isFlipped ? 0 : 180, { duration: 600 });
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

  // Calculate Assets & Liabilities for Net Worth view
  const assets = accounts.filter(a => a.balance > 0).reduce((sum, a) => sum + a.balance, 0);
  const liabilities = Math.abs(accounts.filter(a => a.balance < 0).reduce((sum, a) => sum + a.balance, 0));

  if (variant === 'minimal_white') {
    return (
      <View style={[styles.variantContainer, { backgroundColor: colors.white, borderRadius: radius.xl, borderColor: colors.gray[200], borderWidth: 1 }]}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.label, { color: colors.gray[500] }]}>Total Balance</Text>
            <AnimatedBalance value={totalBalance} style={[styles.balanceText, { color: colors.gray[900] }]} />
          </View>
          <View style={[styles.iconBadge, { backgroundColor: colors.primary[50] }]}>
            <Wallet size={24} color={colors.primary[600]} />
          </View>
        </View>
        <View style={styles.footerRow}>
          <Text style={[styles.subText, { color: colors.gray[500] }]}>{accounts.length} Active Accounts</Text>
        </View>
      </View>
    );
  }

  if (variant === 'compact_dark') {
    return (
      <View style={[styles.variantContainer, { backgroundColor: colors.gray[900], borderRadius: radius.xl }]}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.label, { color: 'rgba(255,255,255,0.7)' }]}>Total Balance</Text>
            <AnimatedBalance value={totalBalance} style={[styles.balanceText, { color: '#FFF' }]} />
          </View>
          <Wallet size={28} color="rgba(255,255,255,0.3)" />
        </View>
        <View style={styles.compactAccountList}>
          {accounts.slice(0, 3).map(acc => (
            <View key={acc.id} style={styles.compactAccountChip}>
              <Text style={styles.compactAccountName} numberOfLines={1}>{acc.name}</Text>
              <Text style={styles.compactAccountBalance}>{formatCurrency(acc.balance)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (variant === 'net_worth') {
    return (
      <LinearGradient
        colors={[colors.primary[700], colors.primary[900]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.variantContainer, { borderRadius: radius.xl }]}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.label, { color: 'rgba(255,255,255,0.8)' }]}>Net Position</Text>
            <AnimatedBalance value={totalBalance} style={[styles.balanceText, { color: '#FFF' }]} />
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
    );
  }

  // Default: Gradient Flip Card
  return (
    <PressableScale onPress={flip} style={styles.container}>
      <View style={styles.cardContainer}>
        {/* Front Side */}
        <Animated.View style={[styles.card, { borderRadius: radius.xl }, frontAnimatedStyle]}>
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
        </Animated.View>

        {/* Back Side */}
        <Animated.View style={[styles.card, styles.cardBack, { borderRadius: radius.xl, backgroundColor: colors.success[700] }, backAnimatedStyle]}>
          <LinearGradient
            colors={[colors.success[600], colors.success[700]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.gradient, { borderRadius: radius.xl }]}
          >
            <Text style={styles.backTitle}>Account Breakdown</Text>
            <ScrollView
              style={styles.accountList}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {accounts.map(acc => (
                <View key={acc.id} style={styles.accountItem}>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>{acc.name}</Text>
                    <Text style={styles.accountType}>{acc.type}</Text>
                  </View>
                  <Text style={styles.accountBalance}>{formatCurrency(acc.balance)}</Text>
                </View>
              ))}
            </ScrollView>
          </LinearGradient>
        </Animated.View>
      </View>
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 0,
    marginVertical: 10,
    height: 200,
  },
  variantContainer: {
    padding: 20,
    marginVertical: 10,
    justifyContent: 'space-between',
    minHeight: 160,
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
  backTitle: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    marginBottom: 16,
  },
  accountList: {
    flex: 1,
  },
  accountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  accountInfo: {
    gap: 2,
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
