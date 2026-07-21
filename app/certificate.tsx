/**
 * certificate.tsx
 * Screen: CertificateScreen
 *
 * Two modes controlled by isFirstTime param:
 *
 * isFirstTime = 'true':
 *   - Full-screen modal, blue background, no back button
 *   - Shows "Welcome to Gastos!" header
 *   - "Download Certificate" + "Continue to App" buttons
 *
 * isFirstTime = 'false' (from Quick Guide):
 *   - Normal screen with back button + "My Certificate" header
 *   - Shows Download, Share, and Edit Name options
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
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';
import { ArrowLeft } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../constants/Theme';
import { CertificateView } from '../components/CertificateView';
import {
  downloadCertificate,
  shareCertificate,
  captureCertificateRef,
} from '../services/certificateUtils';
import {
  markCertificateShown,
  updateUserName,
  generateAndSaveCertificateNumber,
  getCertificateNumber,
  getUserDisplayName,
} from '../services/onboardingState';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatIssueDate(date: Date): string {
  const day = date.getDate();
  const month = date.toLocaleString('en-IN', { month: 'long' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CertificateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    userName?: string;
    certNumber?: string;
    isFirstTime?: string;
  }>();

  const isFirstTime = params.isFirstTime === 'true';

  // State for when values come from params vs loaded async
  const [userName, setUserName] = useState(params.userName ?? '');
  const [certNumber, setCertNumber] = useState(params.certNumber ?? '');
  const [issueDate] = useState(formatIssueDate(new Date()));
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Edit name modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editNameInput, setEditNameInput] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // ViewShot ref for capture
  const certificateRef = useRef<any>(null);

  // ── Load from storage if params not provided ──
  useEffect(() => {
    async function loadFromStorage() {
      if (!userName) {
        const storedName = await getUserDisplayName();
        setUserName(storedName ?? 'Friend');
      }
      if (!certNumber) {
        const storedCert = await getCertificateNumber();
        if (storedCert) {
          setCertNumber(storedCert);
        } else {
          // Generate one if it doesn't exist
          const newCert = await generateAndSaveCertificateNumber();
          setCertNumber(newCert);
        }
      }
    }
    loadFromStorage();
  }, []);

  // ── Download ──
  const handleDownload = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const result = await downloadCertificate(certificateRef);
      if (result.success) {
        Alert.alert(
          '✅ Saved!',
          result.usedShareFallback
            ? 'Certificate shared via share sheet.'
            : 'Certificate saved to your gallery!',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Could not save certificate. Please try again.');
      }
    } catch (_err) {
      Alert.alert('Error', 'Could not save certificate. Please try again.');
    } finally {
      setDownloading(false);
    }
  }, [downloading]);

  // ── Share ──
  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await captureCertificateRef(certificateRef);
      await shareCertificate(uri);
    } catch (_err) {
      Alert.alert('Error', 'Could not share certificate. Please try again.');
    } finally {
      setSharing(false);
    }
  }, [sharing]);

  // ── Continue to app (first time mode) ──
  const handleContinueToApp = useCallback(async () => {
    await markCertificateShown();
    router.replace('/(tabs)');
  }, [router]);

  // ── Edit Name ──
  const openEditModal = useCallback(() => {
    setEditNameInput(userName);
    setEditModalVisible(true);
  }, [userName]);

  const handleSaveEditedName = useCallback(async () => {
    const trimmed = editNameInput.trim();
    if (!trimmed) return;
    setEditLoading(true);
    try {
      await updateUserName(trimmed);
      setUserName(trimmed);
      setEditModalVisible(false);
      // Sync RevenueCat attributes on edit (non-blocking)
      import('../services/revenueCatSync').then(m => m.syncUserAttributes()).catch(() => {});
    } catch (_err) {
      Alert.alert('Error', 'Could not update name. Please try again.');
    } finally {
      setEditLoading(false);
    }
  }, [editNameInput]);

  // ─── Render: First Time Mode ───────────────────────────────────────────────

  if (isFirstTime) {
    return (
      <LinearGradient
        colors={[Colors.primary[600], Colors.primary[700]]}
        style={styles.firstTimeContainer}
      >
        <ScrollView
          contentContainerStyle={[
            styles.firstTimeScrollContent,
            { paddingTop: insets.top + Layout.spacing.md },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Text style={styles.firstTimeTitle}>🎉 Welcome to Gastos!</Text>
          <Text style={styles.firstTimeSubtitle}>
            Your Financial Commitment Certificate
          </Text>

          {/* Certificate */}
          <View style={styles.certificateWrapper}>
            <ViewShot
              ref={certificateRef}
              options={{ format: 'png', quality: 1.0 }}
              style={styles.viewShotWrapper}
              collapsable={false}
            >
              <CertificateView
                userName={userName || 'Friend'}
                certificateNumber={certNumber || 'CERT-2026-00000'}
                issueDate={issueDate}
                appName="Gastos"
              />
            </ViewShot>
          </View>

          {/* Buttons */}
          <View
            style={[
              styles.firstTimeButtons,
              { paddingBottom: insets.bottom + Layout.spacing.md },
            ]}
          >
            {/* Download */}
            <Pressable
              onPress={handleDownload}
              disabled={downloading}
              style={({ pressed }) => [
                styles.downloadBtnFirst,
                pressed && styles.btnPressed,
              ]}
            >
              {downloading ? (
                <ActivityIndicator color={Colors.primary[600]} size="small" />
              ) : (
                <Text style={styles.downloadBtnFirstText}>
                  ⬇ Download Certificate
                </Text>
              )}
            </Pressable>

            {/* Continue to App */}
            <Pressable
              onPress={handleContinueToApp}
              style={({ pressed }) => [
                styles.continueToAppBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.continueToAppBtnText}>
                Continue to App →
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </LinearGradient>
    );
  }

  // ─── Render: Normal Mode (from Quick Guide) ────────────────────────────────

  return (
    <SafeAreaView style={styles.normalContainer} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <ArrowLeft size={24} color={Colors.gray[800]} />
        </Pressable>
        <Text style={styles.headerTitle}>My Certificate</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.normalScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Certificate Preview */}
        <View style={styles.certificateWrapper}>
          <ViewShot
            ref={certificateRef}
            options={{ format: 'png', quality: 1.0 }}
            style={styles.viewShotWrapper}
            collapsable={false}
          >
            <CertificateView
              userName={userName || 'Friend'}
              certificateNumber={certNumber || 'CERT-2026-00000'}
              issueDate={issueDate}
              appName="Gastos"
            />
          </ViewShot>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {/* Download */}
          <Pressable
            onPress={handleDownload}
            disabled={downloading}
            style={({ pressed }) => [
              styles.primaryActionBtn,
              pressed && styles.btnPressed,
            ]}
          >
            {downloading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryActionBtnText}>
                ⬇  Download Certificate
              </Text>
            )}
          </Pressable>

          {/* Share */}
          <Pressable
            onPress={handleShare}
            disabled={sharing}
            style={({ pressed }) => [
              styles.secondaryActionBtn,
              pressed && styles.btnPressed,
            ]}
          >
            {sharing ? (
              <ActivityIndicator color={Colors.primary[600]} size="small" />
            ) : (
              <Text style={styles.secondaryActionBtnText}>
                📤  Share Certificate
              </Text>
            )}
          </Pressable>

          {/* Edit Name */}
          <Pressable
            onPress={openEditModal}
            style={styles.editNameBtn}
          >
            <Text style={styles.editNameBtnText}>Edit Name</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Edit Name Modal ── */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Your Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editNameInput}
              onChangeText={setEditNameInput}
              placeholder="Enter your full name"
              placeholderTextColor={Colors.gray[300]}
              autoFocus
              autoCapitalize="words"
              maxLength={50}
            />
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setEditModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveEditedName}
                disabled={editLoading || editNameInput.trim().length === 0}
                style={[
                  styles.modalSaveBtn,
                  editNameInput.trim().length === 0 && styles.modalSaveBtnDisabled,
                ]}
              >
                {editLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── First Time Mode ──
  firstTimeContainer: {
    flex: 1,
  },
  firstTimeScrollContent: {
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
  },
  firstTimeTitle: {
    fontSize: Typography.size.xxl,
    fontFamily: Typography.family.bold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  firstTimeSubtitle: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: Layout.spacing.xs,
    marginBottom: Layout.spacing.xl,
  },

  // ── Normal Mode ──
  normalContainer: {
    flex: 1,
    backgroundColor: Colors.gray[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    backgroundColor: Colors.white,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  headerSpacer: {
    width: 32,
  },
  normalScrollContent: {
    flexGrow: 1,
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.xxl,
    alignItems: 'center',
  },

  // ── Certificate Wrapper ──
  certificateWrapper: {
    width: '100%',
    alignItems: 'center',
    marginVertical: Layout.spacing.sm,
  },
  viewShotWrapper: {
    alignItems: 'center',
  },

  // ── Buttons: First Time ──
  firstTimeButtons: {
    width: '100%',
    marginTop: Layout.spacing.lg,
    gap: Layout.spacing.sm,
  },
  downloadBtnFirst: {
    height: 52,
    borderRadius: Layout.radius.full,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtnFirstText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.primary[600],
  },
  continueToAppBtn: {
    height: 48,
    borderRadius: Layout.radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueToAppBtnText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: '#FFFFFF',
  },

  // ── Buttons: Normal Mode ──
  actionButtons: {
    width: '100%',
    gap: Layout.spacing.sm,
    marginTop: Layout.spacing.md,
  },
  primaryActionBtn: {
    height: 52,
    borderRadius: Layout.radius.full,
    backgroundColor: Colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    height: 48,
    borderRadius: Layout.radius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  secondaryActionBtnText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.primary[600],
  },
  editNameBtn: {
    alignItems: 'center',
    paddingVertical: Layout.spacing.sm,
  },
  editNameBtnText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: Colors.gray[400],
    textDecorationLine: 'underline',
  },

  // ── Shared ──
  btnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.97 }],
  },

  // ── Edit Name Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Layout.spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg,
    width: '100%',
    ...Layout.shadows.lg,
  },
  modalTitle: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: Layout.spacing.md,
  },
  modalInput: {
    height: 48,
    backgroundColor: Colors.gray[100],
    borderRadius: Layout.radius.md,
    paddingHorizontal: Layout.spacing.md,
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: Layout.spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[600],
  },
  modalSaveBtn: {
    flex: 1,
    height: 44,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnDisabled: {
    backgroundColor: Colors.gray[200],
  },
  modalSaveText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: '#FFFFFF',
  },
});
