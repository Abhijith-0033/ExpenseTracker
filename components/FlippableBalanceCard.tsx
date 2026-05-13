
import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming, 
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Wallet, Info, ChevronRight } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../constants/Theme';
import { formatCurrency } from '../utils/currency';
import { AnimatedBalance } from './AnimatedBalance';
import { PressableScale } from './ui/PressableScale';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Account {
  id: number;
  name: string;
  balance: number;
  type: string;
}

interface FlippableBalanceCardProps {
  totalBalance: number;
  accounts: Account[];
}

export const FlippableBalanceCard: React.FC<FlippableBalanceCardProps> = ({ totalBalance, accounts }) => {
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

  return (
    <PressableScale onPress={flip} style={styles.container}>
      <View style={styles.cardContainer}>
        {/* Front Side */}
        <Animated.View style={[styles.card, frontAnimatedStyle]}>
          <LinearGradient
            colors={[Colors.primary[600], Colors.primary[400]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
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
        <Animated.View style={[styles.card, styles.cardBack, backAnimatedStyle]}>
          <LinearGradient
            colors={[Colors.success[600], Colors.success[700]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <Text style={styles.backTitle}>Account Breakdown</Text>
            <ScrollView 
              style={styles.accountList} 
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {accounts.map((acc) => (
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
    marginHorizontal: 20,
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
    borderRadius: 24,
    ...Layout.shadows.md,
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    backgroundColor: Colors.success[700],
  },
  gradient: {
    flex: 1,
    borderRadius: 24,
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
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
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
    fontSize: 42,
    fontFamily: Typography.family.bold,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
  },
  flipIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backTitle: {
    color: 'white',
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
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
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
  },
  accountType: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontFamily: Typography.family.medium,
  },
  accountBalance: {
    color: 'white',
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
  },
});
