import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Lock, Fingerprint, Clock, Key, Trash2 } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';
import {
  isLockEnabled, setLockEnabled, isBiometricEnabled, setBiometricEnabled,
  getTimeoutMinutes, setTimeoutMinutes, clearPin, isPinSet
} from '../../services/security/AppLockService';
import * as LocalAuthentication from 'expo-local-authentication';
import { Snackbar } from '../../components/Snackbar';

const TIMEOUT_OPTIONS = [
  { label: 'Immediately', value: 0 },
  { label: 'After 1 minute', value: 1 },
  { label: 'After 5 minutes', value: 5 },
  { label: 'After 15 minutes', value: 15 },
  { label: 'After 1 hour', value: 60 },
];

export default function AppLockSettingsScreen() {
  const router = useRouter();
  const [lockEnabled, setLockEnabledState] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [timeoutMinutes, setTimeoutMinutesState] = useState(0);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const loadSettings = useCallback(async () => {
    const [enabled, bio, timeout, pinSet, hasHardware, isEnrolled] = await Promise.all([
      isLockEnabled(),
      isBiometricEnabled(),
      getTimeoutMinutes(),
      isPinSet(),
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    setLockEnabledState(enabled);
    setBiometricEnabledState(bio);
    setTimeoutMinutesState(timeout);
    setPinConfigured(pinSet);
    setBiometricAvailable(hasHardware && isEnrolled);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleToggleLock = async (value: boolean) => {
    if (!value) {
      Alert.alert(
        'Disable App Lock',
        'Anyone with access to your phone will be able to view your financial data.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              await setLockEnabled(false);
              await clearPin();
              setLockEnabledState(false);
              setPinConfigured(false);
              setSnackbarMessage('App lock disabled');
              setSnackbarVisible(true);
            }
          }
        ]
      );
    } else {
      // Navigate to setup
      router.push('/security/setup-pin' as any);
    }
  };

  const handleToggleBiometric = async (value: boolean) => {
    await setBiometricEnabled(value);
    setBiometricEnabledState(value);
  };

  const handleSelectTimeout = async (minutes: number) => {
    await setTimeoutMinutes(minutes);
    setTimeoutMinutesState(minutes);
    setShowTimerPicker(false);
  };

  const handleChangePIN = () => {
    router.push('/security/setup-pin' as any);
  };

  const handleRemovePIN = () => {
    Alert.alert(
      'Remove PIN',
      'This will disable app lock entirely.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await setLockEnabled(false);
            await clearPin();
            setLockEnabledState(false);
            setPinConfigured(false);
            setSnackbarMessage('App lock removed');
            setSnackbarVisible(true);
          }
        }
      ]
    );
  };

  const currentTimeoutLabel = TIMEOUT_OPTIONS.find(o => o.value === timeoutMinutes)?.label || 'Immediately';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>App Lock</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {!pinConfigured ? (
          // Setup card
          <View style={styles.setupCard}>
            <View style={styles.setupIconBox}>
              <Lock size={48} color={Colors.primary[600]} />
            </View>
            <Text style={styles.setupTitle}>Secure Your Finances</Text>
            <Text style={styles.setupSubtitle}>
              Set a PIN to protect your account balances, loan details, and transaction history.
            </Text>
            <TouchableOpacity
              style={styles.setupBtn}
              onPress={() => router.push('/security/setup-pin' as any)}
            >
              <Text style={styles.setupBtnText}>Set Up PIN</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Master Toggle */}
            <View style={styles.section}>
              <View style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: 'rgba(16,24,40,0.08)' }]}>
                  <Lock size={20} color={Colors.gray[900]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowText}>App Lock</Text>
                  <Text style={styles.rowSubtext}>Require PIN to open app</Text>
                </View>
                <Switch
                  value={lockEnabled}
                  onValueChange={handleToggleLock}
                  trackColor={{ true: Colors.primary[500], false: Colors.gray[200] }}
                  thumbColor={Colors.white}
                />
              </View>
            </View>

            {lockEnabled && (
              <>
                {/* Biometric */}
                <View style={styles.section}>
                  <View style={[styles.row, { borderBottomWidth: 0 }]}>
                    <View style={[styles.rowIcon, { backgroundColor: 'rgba(16,24,40,0.08)' }]}>
                      <Fingerprint size={20} color={Colors.gray[900]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowText}>Biometric Unlock</Text>
                      <Text style={styles.rowSubtext}>
                        {biometricAvailable
                          ? 'Use fingerprint or face unlock'
                          : 'Set up fingerprint/face in phone settings first'}
                      </Text>
                    </View>
                    <Switch
                      value={biometricEnabled}
                      onValueChange={handleToggleBiometric}
                      disabled={!biometricAvailable}
                      trackColor={{ true: Colors.primary[500], false: Colors.gray[200] }}
                      thumbColor={Colors.white}
                    />
                  </View>
                </View>

                {/* Auto-Lock Timer */}
                <View style={styles.section}>
                  <TouchableOpacity style={styles.row} onPress={() => setShowTimerPicker(!showTimerPicker)}>
                    <View style={[styles.rowIcon, { backgroundColor: 'rgba(16,24,40,0.08)' }]}>
                      <Clock size={20} color={Colors.gray[900]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowText}>Auto-Lock Timer</Text>
                      <Text style={styles.rowSubtext}>{currentTimeoutLabel}</Text>
                    </View>
                  </TouchableOpacity>

                  {showTimerPicker && (
                    <View style={styles.timerOptions}>
                      {TIMEOUT_OPTIONS.map(opt => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[
                            styles.timerOption,
                            opt.value === timeoutMinutes && styles.timerOptionSelected
                          ]}
                          onPress={() => handleSelectTimeout(opt.value)}
                        >
                          <Text style={[
                            styles.timerOptionText,
                            opt.value === timeoutMinutes && styles.timerOptionTextSelected
                          ]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Change PIN */}
                <View style={styles.section}>
                  <TouchableOpacity style={styles.row} onPress={handleChangePIN}>
                    <View style={[styles.rowIcon, { backgroundColor: 'rgba(16,24,40,0.08)' }]}>
                      <Key size={20} color={Colors.gray[900]} />
                    </View>
                    <Text style={styles.rowText}>Change PIN</Text>
                  </TouchableOpacity>

                  {/* Remove PIN */}
                  <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={handleRemovePIN}>
                    <View style={[styles.rowIcon, { backgroundColor: Colors.danger[50] }]}>
                      <Trash2 size={20} color={Colors.danger[600]} />
                    </View>
                    <Text style={[styles.rowText, { color: Colors.danger[600] }]}>Remove PIN</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        message={snackbarMessage}
        onDismiss={() => setSnackbarVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: Colors.white },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
  scrollView: { flex: 1, paddingHorizontal: 16, paddingTop: 24 },
  section: { backgroundColor: Colors.white, borderRadius: Layout.radius.lg, marginBottom: 16, overflow: 'hidden', ...Layout.shadows.sm },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  rowIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  rowText: { fontSize: Typography.size.md, fontFamily: Typography.family.medium, color: Colors.gray[900], flex: 1 },
  rowSubtext: { fontSize: Typography.size.sm, color: Colors.gray[500], marginTop: 2 },
  timerOptions: { paddingHorizontal: 16, paddingBottom: 12 },
  timerOption: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: Layout.radius.md, marginBottom: 4 },
  timerOptionSelected: { backgroundColor: Colors.primary[100] },
  timerOptionText: { fontSize: Typography.size.md, color: Colors.gray[700], fontFamily: Typography.family.medium },
  timerOptionTextSelected: { color: Colors.primary[600], fontFamily: Typography.family.bold },
  setupCard: { alignItems: 'center', backgroundColor: Colors.white, borderRadius: Layout.radius.xl, padding: 32, marginTop: 24, ...Layout.shadows.md },
  setupIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary[50], justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  setupTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900], marginBottom: 12, textAlign: 'center' },
  setupSubtitle: { fontSize: Typography.size.md, color: Colors.gray[500], textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  setupBtn: { backgroundColor: Colors.primary[600], paddingHorizontal: 40, paddingVertical: 16, borderRadius: Layout.radius.lg, width: '100%', alignItems: 'center' },
  setupBtnText: { color: Colors.white, fontSize: Typography.size.md, fontFamily: Typography.family.bold },
});
