import React, { useState , useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Delete } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';
import { savePin, setLockEnabled, setTimeoutMinutes, setBiometricEnabled } from '../../services/security/AppLockService';
import * as LocalAuthentication from 'expo-local-authentication';
import { Snackbar } from '../../components/Snackbar';

type SetupStep = 'create' | 'confirm' | 'biometric';

export default function SetupPinScreen() {
  const router = useRouter();
  const [step, setStep] = useState<SetupStep>('create');
  const [firstPin, setFirstPin] = useState('');
  const [enteredDigits, setEnteredDigits] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [biometricAvailable, setBiometricAvailableState] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Check biometric availability when reaching that step
  const checkBiometric = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailableState(hasHardware && isEnrolled);
  };

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleDigit = async (digit: string) => {
    if (enteredDigits.length >= 4) return;
    const newDigits = [...enteredDigits, digit];
    setEnteredDigits(newDigits);

    if (newDigits.length === 4) {
      const pin = newDigits.join('');

      if (step === 'create') {
        setFirstPin(pin);
        setEnteredDigits([]);
        setErrorMsg('');
        setStep('confirm');

      } else if (step === 'confirm') {
        if (pin === firstPin) {
          // PINs match — save and proceed
          await savePin(pin);
          await setLockEnabled(true);
          await setTimeoutMinutes(0); // Default: lock immediately
          setEnteredDigits([]);
          setErrorMsg('');
          await checkBiometric();
          setStep('biometric');
        } else {
          triggerShake();
          setEnteredDigits([]);
          setErrorMsg("PINs don't match. Try again.");
          setStep('create');
          setFirstPin('');
        }
      }
    } else {
      setErrorMsg('');
    }
  };

  const handleBackspace = () => {
    setEnteredDigits(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleEnableBiometric = async () => {
    await setBiometricEnabled(true);
    setSnackbarMessage('App lock enabled');
    setSnackbarVisible(true);
    setTimeout(() => router.back(), 800);
  };

  const handleSkipBiometric = async () => {
    await setBiometricEnabled(false);
    setSnackbarMessage('App lock enabled');
    setSnackbarVisible(true);
    setTimeout(() => router.back(), 800);
  };

  const stepTitle = step === 'create' ? 'Create a PIN'
    : step === 'confirm' ? 'Confirm PIN'
    : 'Enable Biometric?';

  const stepSubtitle = step === 'create' ? 'Choose a 4-digit PIN'
    : step === 'confirm' ? 'Re-enter your PIN to confirm'
    : 'Use fingerprint or face unlock for faster access';

  if (step === 'biometric') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.gray[900]} />
        </TouchableOpacity>

        <View style={styles.bioCard}>
          <Text style={styles.bioIcon}>🔐</Text>
          <Text style={styles.bioTitle}>Enable Biometric Unlock?</Text>
          <Text style={styles.bioSubtitle}>
            Use fingerprint or face unlock for faster access to Gastos.
          </Text>

          {biometricAvailable ? (
            <>
              <TouchableOpacity style={styles.enableBtn} onPress={handleEnableBiometric}>
                <Text style={styles.enableBtnText}>Enable</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipBtn} onPress={handleSkipBiometric}>
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.noBioText}>
                No biometric hardware enrolled on this device. Set up fingerprint or face unlock in phone settings first.
              </Text>
              <TouchableOpacity style={styles.enableBtn} onPress={handleSkipBiometric}>
                <Text style={styles.enableBtnText}>Continue</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Snackbar
          visible={snackbarVisible}
          message={snackbarMessage}
          onDismiss={() => setSnackbarVisible(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <ArrowLeft size={24} color={Colors.gray[900]} />
      </TouchableOpacity>

      <View style={styles.brandSection}>
        <Text style={styles.stepTitle}>{stepTitle}</Text>
        <Text style={styles.stepSubtitle}>{stepSubtitle}</Text>
      </View>

      <Animated.View
        style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
      >
        {[0, 1, 2, 3].map(i => (
          <View
            key={i}
            style={[
              styles.dot,
              i < enteredDigits.length ? styles.dotFilled : styles.dotEmpty,
            ]}
          />
        ))}
      </Animated.View>

      {!!errorMsg && <Text style={styles.errorMsg}>{errorMsg}</Text>}

      <View style={styles.numpad}>
        {['1','2','3','4','5','6','7','8','9'].map(digit => (
          <TouchableOpacity key={digit} style={styles.numKey} onPress={() => handleDigit(digit)}>
            <Text style={styles.numKeyText}>{digit}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.numKey} />
        <TouchableOpacity style={styles.numKey} onPress={() => handleDigit('0')}>
          <Text style={styles.numKeyText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.numKey} onPress={handleBackspace}>
          <Delete size={24} color={Colors.gray[700]} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50], alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  backBtn: { position: 'absolute', top: 60, left: 20, padding: 8 },
  brandSection: { alignItems: 'center', marginBottom: 48 },
  stepTitle: { fontSize: Typography.size.xxl, fontFamily: Typography.family.bold, color: Colors.gray[900], marginBottom: 8, textAlign: 'center' },
  stepSubtitle: { fontSize: Typography.size.sm, color: Colors.gray[500], fontFamily: Typography.family.regular, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: 20, marginBottom: 16 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  dotEmpty: { borderWidth: 2, borderColor: Colors.gray[300], backgroundColor: 'transparent' },
  dotFilled: { backgroundColor: Colors.primary[600] },
  errorMsg: { fontSize: Typography.size.sm, color: '#F04438', fontFamily: Typography.family.medium, marginBottom: 16, textAlign: 'center' },
  numpad: { flexDirection: 'row', flexWrap: 'wrap', width: 290, marginTop: 32, justifyContent: 'center' },
  numKey: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center', margin: 8, borderRadius: 40, backgroundColor: Colors.white, ...Layout.shadows.sm },
  numKeyText: { fontSize: Typography.size.xxl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  bioCard: { alignItems: 'center', padding: 32, backgroundColor: Colors.white, borderRadius: Layout.radius.xl, ...Layout.shadows.md, width: '100%' },
  bioIcon: { fontSize: 64, marginBottom: 16 },
  bioTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900], marginBottom: 12, textAlign: 'center' },
  bioSubtitle: { fontSize: Typography.size.md, color: Colors.gray[500], textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  enableBtn: { backgroundColor: Colors.primary[600], paddingHorizontal: 40, paddingVertical: 16, borderRadius: Layout.radius.lg, width: '100%', alignItems: 'center', marginBottom: 12 },
  enableBtnText: { color: Colors.white, fontSize: Typography.size.md, fontFamily: Typography.family.bold },
  skipBtn: { paddingHorizontal: 40, paddingVertical: 16, width: '100%', alignItems: 'center' },
  skipBtnText: { color: Colors.gray[500], fontSize: Typography.size.md, fontFamily: Typography.family.medium },
  noBioText: { fontSize: Typography.size.sm, color: Colors.gray[500], textAlign: 'center', lineHeight: 20, marginBottom: 24 },
});
