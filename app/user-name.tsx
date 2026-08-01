/**
 * user-name.tsx
 * Screen: UserNameScreen
 *
 * Shown ONCE after the onboarding tour completes,
 * BEFORE the user reaches the main dashboard.
 *
 * Flow:
 *   1. User types their name in the animated input
 *   2. Taps "Create My Certificate" button
 *   3. Name + cert number saved (SQLite + AsyncStorage)
 *   4. RevenueCat attributes synced (non-blocking)
 *   5. Navigate to /certificate?isFirstTime=true&userName=...
 *
 * Or:
 *   User taps "Skip for now" → saved as 'Anonymous User',
 *   cert number still generated, navigates straight to dashboard.
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Layout } from '../constants/Theme';
import {
  saveUserName,
  generateAndSaveCertificateNumber,
} from '../services/onboardingState';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Component ───────────────────────────────────────────────────────────────

export default function UserNameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Animated bottom border on input
  const borderAnim = useRef(new Animated.Value(0)).current;
  const borderColorAnim = useRef(new Animated.Value(0)).current; // 0=default, 1=focused, 2=error

  // ── Border animation on focus/blur ──
  useEffect(() => {
    Animated.timing(borderAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  // ── Border color when error shown ──
  useEffect(() => {
    if (error) {
      Animated.timing(borderColorAnim, {
        toValue: 2,
        duration: 150,
        useNativeDriver: false,
      }).start();
    } else if (isFocused) {
      Animated.timing(borderColorAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(borderColorAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }).start();
    }
  }, [error, isFocused]);

  const borderColor = borderColorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [Colors.gray[200], Colors.primary[600], '#F04438'],
  });

  const borderWidth = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.5, 2],
  });

  // ── Sync RevenueCat attributes (non-blocking) ──
  const syncRevenueCatAttributes = useCallback(
    async () => {
      try {
        const { syncUserAttributes } = await import('../services/revenueCatSync');
        await syncUserAttributes();
      } catch (e) {
        // Never block user flow for analytics
        console.warn('RevenueCat attribute sync failed:', e);
      }
    },
    []
  );

  // ── Main action: save name + navigate to certificate ──
  const handleContinue = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name to continue');
      return;
    }
    if (loading) return;

    setError('');
    setLoading(true);

    try {
      // 1. Save name to SQLite + AsyncStorage
      await saveUserName(trimmed);

      // 2. Generate and save certificate number
      const certNumber = await generateAndSaveCertificateNumber();

      // 3. Sync RevenueCat (non-blocking — fire and forget)
      syncRevenueCatAttributes();

      // 4. Navigate to CertificateScreen (first time mode)
      router.replace({
        pathname: '/certificate' as any,
        params: {
          userName: trimmed,
          certNumber,
          isFirstTime: 'true',
        },
      });
    } catch (err) {
      console.error('UserNameScreen handleContinue error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [name, loading, router, syncRevenueCatAttributes]);

  // ── Skip: save anonymous, generate cert, go to dashboard ──
  const handleSkip = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await saveUserName('Anonymous User');
      await generateAndSaveCertificateNumber();
      // Sync RevenueCat attributes for skipped/anonymous user
      syncRevenueCatAttributes();
      // Navigate to main dashboard (do NOT show certificate)
      router.replace('/(tabs)');
    } catch (err) {
      console.warn('UserNameScreen handleSkip error:', err);
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  }, [loading, router, syncRevenueCatAttributes]);

  const showCharCount = name.length > 0;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* ── TOP HERO (40% of screen) ── */}
          <LinearGradient
            colors={[Colors.primary[600], Colors.primary[700]]}
            style={[styles.topHero, { paddingTop: insets.top + 16 }]}
          >
            <Text style={styles.heroEmoji}>🏆</Text>
            <Text style={styles.heroTitle}>Your journey begins here</Text>
          </LinearGradient>

          {/* ── BOTTOM CARD (60% of screen) ── */}
          <View style={styles.bottomCard}>
            <Text style={styles.questionTitle}>What should we call you?</Text>
            <Text style={styles.questionSubtitle}>
              We&apos;ll add your name to your personal{'\n'}Financial Commitment Certificate
            </Text>

            {/* ── Name Input ── */}
            <View style={styles.inputWrapper}>
              <Animated.View
                style={[
                  styles.inputContainer,
                  { borderBottomColor: borderColor, borderBottomWidth: borderWidth },
                ]}
              >
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your full name"
                  placeholderTextColor={Colors.gray[300]}
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (error) setError('');
                  }}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  autoFocus
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleContinue}
                  maxLength={50}
                  editable={!loading}
                />
              </Animated.View>

              {/* Error message */}
              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : null}

              {/* Character count */}
              {showCharCount && (
                <Text style={styles.charCount}>{name.length}/50</Text>
              )}
            </View>

            {/* ── Continue Button ── */}
            <Pressable
              onPress={handleContinue}
              disabled={name.trim().length === 0 || loading}
              style={({ pressed }) => [
                styles.continueBtn,
                name.trim().length === 0 && styles.continueBtnDisabled,
                pressed && name.trim().length > 0 && styles.continueBtnPressed,
              ]}
            >
              <Text style={styles.continueBtnText}>
                {loading ? 'Creating…' : 'Create My Certificate'}
              </Text>
            </Pressable>

            {/* ── Skip Button ── */}
            <Pressable
              onPress={handleSkip}
              disabled={loading}
              style={styles.skipBtn}
            >
              <Text style={styles.skipBtnText}>Skip for now</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.primary[600],
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // ── Top Hero ──
  topHero: {
    height: SCREEN_HEIGHT * 0.38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.lg,
  },
  heroEmoji: {
    fontSize: 72,
    textAlign: 'center',
  },
  heroTitle: {
    fontSize: Typography.size.xxl,
    fontFamily: Typography.family.bold,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: Layout.spacing.md,
  },

  // ── Bottom Card ──
  bottomCard: {
    flex: 1,
    backgroundColor: Colors.gray[50],
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -20,
    paddingTop: Layout.spacing.xl,
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
    minHeight: SCREEN_HEIGHT * 0.65,
  },
  questionTitle: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    textAlign: 'center',
  },
  questionSubtitle: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.gray[400],
    textAlign: 'center',
    marginTop: Layout.spacing.sm,
    lineHeight: 22,
  },

  // ── Input ──
  inputWrapper: {
    marginTop: Layout.spacing.xl,
  },
  inputContainer: {
    height: 56,
    backgroundColor: Colors.gray[100],
    borderRadius: Layout.radius.md,
    paddingHorizontal: Layout.spacing.md,
    justifyContent: 'center',
    // Animated bottom border only (borderBottomColor/Width set via Animated)
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.gray[200],
  },
  textInput: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    flex: 1,
    padding: 0,
  },
  errorText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: '#F04438',
    marginTop: Layout.spacing.xs,
    marginLeft: 2,
  },
  charCount: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.gray[300],
    textAlign: 'right',
    marginTop: Layout.spacing.xs,
  },

  // ── Continue Button ──
  continueBtn: {
    marginTop: Layout.spacing.xl,
    height: 56,
    borderRadius: Layout.radius.full,
    backgroundColor: Colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: {
    backgroundColor: Colors.gray[200],
  },
  continueBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.97 }],
  },
  continueBtnText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: '#FFFFFF',
  },

  // ── Skip Button ──
  skipBtn: {
    marginTop: Layout.spacing.md,
    alignItems: 'center',
    paddingVertical: Layout.spacing.sm,
  },
  skipBtnText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: Colors.gray[300],
  },
});
