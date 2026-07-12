import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  StatusBar
} from 'react-native';
import { Delete, Fingerprint } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { verifyPin, isBiometricEnabled, recordUnlock } from '../../services/security/AppLockService';
import * as LocalAuthentication from 'expo-local-authentication';

interface LockScreenProps {
  onUnlock: () => void;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function LockScreen({ onUnlock }: LockScreenProps) {
  const [enteredDigits, setEnteredDigits] = useState<string[]>([]); // max 4
  const [attempts, setAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // Shake animation
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  // Check biometric on mount + auto-trigger
  useEffect(() => {
    const checkAndTriggerBiometric = async () => {
      const bioEnabled = await isBiometricEnabled();
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (bioEnabled && hasHardware && isEnrolled) {
        setBiometricAvailable(true);
        triggerBiometric();
      }
    };
    checkAndTriggerBiometric();
  }, []); // Run once on mount only

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setAttempts(0);
          setErrorMsg('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const triggerBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Gastos',
        cancelLabel: 'Use PIN instead',
        disableDeviceFallback: false,
      });
      if (result.success) {
        await recordUnlock();
        onUnlock();
      }
      // If cancelled or error: do nothing — PIN entry remains visible
    } catch (_) {
      // Fail silently
    }
  };

  const handleDigit = async (digit: string) => {
    if (lockoutRemaining > 0) return;
    if (enteredDigits.length >= 4) return;

    const newDigits = [...enteredDigits, digit];
    setEnteredDigits(newDigits);

    if (newDigits.length === 4) {
      const pin = newDigits.join('');
      const isCorrect = await verifyPin(pin);

      if (isCorrect) {
        // Brief green flash on dots — show all filled green then unlock
        await recordUnlock();
        setEnteredDigits([]);
        onUnlock();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        triggerShake();
        setEnteredDigits([]);

        if (newAttempts >= MAX_ATTEMPTS) {
          setLockoutRemaining(LOCKOUT_SECONDS);
          setErrorMsg('Too many attempts. Try again in 30 seconds.');
        } else {
          setErrorMsg(`Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? 's' : ''} remaining.`);
        }
      }
    } else {
      setErrorMsg('');
    }
  };

  const handleBackspace = () => {
    if (lockoutRemaining > 0) return;
    setEnteredDigits(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  const filledCount = enteredDigits.length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* App branding */}
      <View style={styles.brandSection}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>G</Text>
        </View>
        <Text style={styles.appName}>Gastos</Text>
        <Text style={styles.subtitle}>
          {lockoutRemaining > 0
            ? `Try again in ${lockoutRemaining}s`
            : 'Enter your PIN to continue'}
        </Text>
      </View>

      {/* PIN Dots */}
      <Animated.View
        style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
      >
        {[0, 1, 2, 3].map(i => (
          <View
            key={i}
            style={[
              styles.dot,
              i < filledCount ? styles.dotFilled : styles.dotEmpty,
            ]}
          />
        ))}
      </Animated.View>

      {/* Error message */}
      {!!errorMsg && (
        <Text style={styles.errorMsg}>{errorMsg}</Text>
      )}

      {/* Number Pad */}
      <View style={styles.numpad}>
        {['1','2','3','4','5','6','7','8','9'].map(digit => (
          <TouchableOpacity
            key={digit}
            style={styles.numKey}
            onPress={() => handleDigit(digit)}
            disabled={lockoutRemaining > 0}
          >
            <Text style={styles.numKeyText}>{digit}</Text>
          </TouchableOpacity>
        ))}

        {/* Bottom row: [biometric] [0] [backspace] */}
        {biometricAvailable ? (
          <TouchableOpacity style={styles.numKey} onPress={triggerBiometric}>
            <Fingerprint size={26} color={Colors.primary[600]} />
          </TouchableOpacity>
        ) : (
          <View style={styles.numKey} />
        )}

        <TouchableOpacity
          style={styles.numKey}
          onPress={() => handleDigit('0')}
          disabled={lockoutRemaining > 0}
        >
          <Text style={styles.numKeyText}>0</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.numKey}
          onPress={handleBackspace}
          disabled={lockoutRemaining > 0}
        >
          <Delete size={24} color={Colors.gray[700]} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray[50],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...Layout.shadows.lg,
  },
  logoText: {
    fontSize: 40,
    fontFamily: Typography.family.bold,
    color: Colors.white,
  },
  appName: {
    fontSize: Typography.size.xxl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 4,
  },
  subtitle: {
    fontSize: Typography.size.sm,
    color: Colors.gray[500],
    fontFamily: Typography.family.regular,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  dotEmpty: {
    borderWidth: 2,
    borderColor: Colors.gray[300],
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: Colors.primary[600],
  },
  errorMsg: {
    fontSize: Typography.size.sm,
    color: '#F04438',
    fontFamily: Typography.family.medium,
    marginBottom: 16,
    textAlign: 'center',
  },
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 290,
    marginTop: 32,
    justifyContent: 'center',
  },
  numKey: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
    borderRadius: 40,
    backgroundColor: Colors.white,
    ...Layout.shadows.sm,
  },
  numKeyText: {
    fontSize: Typography.size.xxl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
});
