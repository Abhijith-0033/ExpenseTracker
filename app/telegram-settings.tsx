import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Switch, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { ArrowLeft, Send, CheckCircle, AlertCircle, RefreshCw, LogOut } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../constants/Theme';
import { getCategories } from '../services/database';
import { getRecentTelegramTransactions } from '../services/transactionQueries';
import { TELEGRAM_KEYS, checkServerHealth, syncCategories } from '../telegram/TelegramService';
import { startPolling, stopPolling, unregisterBackgroundTask } from '../telegram/TelegramPoller';

export default function TelegramSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isLinked, setIsLinked] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [connectionCode, setConnectionCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  
  const [isEnabled, setIsEnabled] = useState(true);
  const [lastPoll, setLastPoll] = useState<string | null>(null);
  const [storedUserId, setStoredUserId] = useState<string | null>(null);
  const [storedServerUrl, setStoredServerUrl] = useState<string | null>(null);
  
  const [recentTelegramTx, setRecentTelegramTx] = useState<any[]>([]);
  
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'fail'>('idle');

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    try {
      const [userId, sUrl, enabled, last] = await Promise.all([
        SecureStore.getItemAsync(TELEGRAM_KEYS.APP_USER_ID),
        AsyncStorage.getItem(TELEGRAM_KEYS.SERVER_URL),
        AsyncStorage.getItem(TELEGRAM_KEYS.ENABLED),
        AsyncStorage.getItem(TELEGRAM_KEYS.LAST_POLL),
      ]);

      const linked = !!userId;
      setIsLinked(linked);
      setStoredUserId(userId);
      setStoredServerUrl(sUrl);
      setIsEnabled(enabled !== 'false');
      setLastPoll(last);

      if (linked) {
        // Load recent Telegram transactions
        const txs = await getRecentTelegramTransactions(5);
        setRecentTelegramTx(txs || []);
      }
    } catch (err) {
      console.error('[TelegramSettings] Failed to load state:', err);
    }
  };

  const handleConnect = async () => {
    if (!serverUrl.trim()) {
      setConnectError('Please enter your Telegram server URL.');
      return;
    }
    if (!connectionCode.trim()) {
      setConnectError('Please enter your unique connection code.');
      return;
    }

    setIsConnecting(true);
    setConnectError('');

    let formattedUrl = serverUrl.trim();
    // Normalize URL format
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }
    if (formattedUrl.endsWith('/')) {
      formattedUrl = formattedUrl.slice(0, -1);
    }

    try {
      // Step 1: Health check
      const healthy = await checkServerHealth(formattedUrl);
      if (!healthy) {
        setConnectError('Could not connect to the server. Please check the URL and make sure the server is online.');
        setIsConnecting(false);
        return;
      }

      // Step 2: Save to storage
      await AsyncStorage.multiSet([
        [TELEGRAM_KEYS.SERVER_URL, formattedUrl],
        [TELEGRAM_KEYS.ENABLED, 'true'],
      ]);
      await SecureStore.setItemAsync(TELEGRAM_KEYS.APP_USER_ID, connectionCode.trim());

      // Step 3: Sync category list to server for custom mapping
      const cats = await getCategories();
      await syncCategories(connectionCode.trim(), cats.map(c => c.name));

      // Step 4: Start polling
      await startPolling();

      setIsLinked(true);
      setStoredUserId(connectionCode.trim());
      setStoredServerUrl(formattedUrl);
      setIsEnabled(true);
      setLastPoll(new Date().toISOString());



      Alert.alert('Connected!', 'Your app is now linked to your Telegram Bot.');
      loadState();
    } catch (err) {
      setConnectError('An error occurred during connection: ' + (err as Error).message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Bot',
      'Are you sure you want to disconnect the Telegram bot? The bot will no longer be able to add transactions to this app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await stopPolling();
            await unregisterBackgroundTask();
            await AsyncStorage.multiRemove([
              TELEGRAM_KEYS.SERVER_URL,
              TELEGRAM_KEYS.ENABLED,
              TELEGRAM_KEYS.LAST_POLL,
            ]);
            await SecureStore.deleteItemAsync(TELEGRAM_KEYS.APP_USER_ID);
            setIsLinked(false);
            setStoredUserId(null);
            setStoredServerUrl(null);
            setRecentTelegramTx([]);
            Alert.alert('Disconnected', 'Telegram Bot has been disconnected.');
          },
        },
      ]
    );
  };

  const handleToggle = async (value: boolean) => {
    setIsEnabled(value);
    await AsyncStorage.setItem(TELEGRAM_KEYS.ENABLED, value ? 'true' : 'false');
    if (value) {
      await startPolling();
    } else {
      stopPolling();
    }
  };



  const handleTestConnection = async () => {
    if (!storedServerUrl) return;
    setIsTesting(true);
    setTestResult('idle');
    try {
      const healthy = await checkServerHealth(storedServerUrl);
      if (healthy) {
        setTestResult('success');
        // Sync categories just in case they were updated
        const cats = await getCategories();
        if (storedUserId) {
          await syncCategories(storedUserId, cats.map(c => c.name));
        }
      } else {
        setTestResult('fail');
      }
    } catch {
      setTestResult('fail');
    } finally {
      setIsTesting(false);
    }
  };

  const formatLastPollTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    } catch {
      return isoString;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top || 40 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Telegram Bot</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {!isLinked ? (
          /* UNLINKED SETUP FLOW */
          <View>
            <View style={styles.promoContainer}>
              <View style={[styles.promoIconContainer, { backgroundColor: 'rgba(0, 136, 204, 0.1)' }]}>
                <Send size={40} color="#0088CC" />
              </View>
              <Text style={styles.promoTitle}>Quick Expense Input</Text>
              <Text style={styles.promoDescription}>
                Link a Telegram Bot to instantly message your transactions e.g. &quot;food 150 lunch&quot; and have them added automatically!
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Setup Instructions</Text>
              <View style={styles.instructionRow}>
                <Text style={styles.instructionNumber}>1</Text>
                <Text style={styles.instructionText}>
                  Find or create your bot on Telegram (see BotFather).
                </Text>
              </View>
              <View style={styles.instructionRow}>
                <Text style={styles.instructionNumber}>2</Text>
                <Text style={styles.instructionText}>
                  Send <Text style={{ fontWeight: 'bold' }}>/start</Text> to the bot to obtain your unique connection code.
                </Text>
              </View>
              <View style={styles.instructionRow}>
                <Text style={styles.instructionNumber}>3</Text>
                <Text style={styles.instructionText}>
                  Enter the server URL and connection code below to link the app.
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Connection Details</Text>
              
              <Text style={styles.inputLabel}>Telegram Server URL</Text>
              <TextInput
                style={styles.input}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="https://your-bot-server.railway.app"
                placeholderTextColor={Colors.gray[400]}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>Connection Code</Text>
              <TextInput
                style={styles.input}
                value={connectionCode}
                onChangeText={setConnectionCode}
                placeholder="Paste code from Bot"
                placeholderTextColor={Colors.gray[400]}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {connectError ? (
                <View style={styles.errorContainer}>
                  <AlertCircle size={16} color={Colors.danger[600]} style={{ marginRight: 6 }} />
                  <Text style={styles.errorText}>{connectError}</Text>
                </View>
              ) : null}

              <TouchableOpacity 
                style={[styles.primaryButton, isConnecting && styles.disabledButton]} 
                onPress={handleConnect}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Connect Bot</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* LINKED STATUS FLOW */
          <View>
            {/* Connection Status Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <View style={[styles.statusIndicator, { backgroundColor: isEnabled ? Colors.success[500] : Colors.warning[500] }]} />
                <Text style={styles.statusText}>
                  {isEnabled ? 'Bot Connected & Active' : 'Bot Connected (Paused)'}
                </Text>
              </View>
              
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Server:</Text>
                <Text style={styles.statusValue} numberOfLines={1} ellipsizeMode="tail">
                  {storedServerUrl}
                </Text>
              </View>

              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>User ID:</Text>
                <Text style={styles.statusValue} numberOfLines={1}>
                  {storedUserId ? `${storedUserId.substring(0, 8)}...` : 'N/A'}
                </Text>
              </View>

              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Last Sync:</Text>
                <Text style={styles.statusValue}>{formatLastPollTime(lastPoll)}</Text>
              </View>
            </View>

            {/* General Toggles and Selectors */}
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Enable Bot Processing</Text>
                  <Text style={styles.toggleSubtitle}>Turn off to temporarily stop polling expenses</Text>
                </View>
                <Switch
                  value={isEnabled}
                  onValueChange={handleToggle}
                  trackColor={{ true: Colors.primary[500], false: Colors.gray[200] }}
                  thumbColor={Colors.white}
                />
              </View>

            </View>

            {/* Test Connection Button */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Troubleshooting</Text>
              
              <TouchableOpacity 
                style={styles.outlineButton}
                onPress={handleTestConnection}
                disabled={isTesting}
              >
                {isTesting ? (
                  <ActivityIndicator color={Colors.primary[600]} />
                ) : (
                  <View style={styles.outlineButtonContent}>
                    <RefreshCw size={18} color={Colors.primary[600]} style={{ marginRight: 8 }} />
                    <Text style={styles.outlineButtonText}>Test Connection</Text>
                  </View>
                )}
              </TouchableOpacity>

              {testResult === 'success' && (
                <View style={[styles.testResultContainer, styles.successResult]}>
                  <CheckCircle size={16} color={Colors.success[700]} style={{ marginRight: 6 }} />
                  <Text style={styles.successResultText}>Connection active. Categories synced successfully!</Text>
                </View>
              )}

              {testResult === 'fail' && (
                <View style={[styles.testResultContainer, styles.failResult]}>
                  <AlertCircle size={16} color={Colors.danger[700]} style={{ marginRight: 6 }} />
                  <Text style={styles.failResultText}>Connection failed. Check server status.</Text>
                </View>
              )}
            </View>

            {/* Recent Additions */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent Telegram Transactions</Text>
              {recentTelegramTx.length === 0 ? (
                <Text style={styles.emptyListText}>No transactions added via Telegram yet.</Text>
              ) : (
                recentTelegramTx.map((tx, idx) => (
                  <View key={idx} style={[styles.txItem, idx === recentTelegramTx.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txCategory}>{tx.category}</Text>
                      <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                      <Text style={styles.txDate}>
                        {new Date(tx.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                    <Text style={styles.txAmount}>
                      ₹{tx.amount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {/* Disconnect Button */}
            <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
              <LogOut size={18} color={Colors.danger[600]} style={{ marginRight: 8 }} />
              <Text style={styles.disconnectButtonText}>Disconnect Telegram Bot</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
    backgroundColor: Colors.white,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  promoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  promoIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  promoTitle: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 8,
  },
  promoDescription: {
    fontSize: Typography.size.sm,
    color: Colors.gray[600],
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: Typography.family.regular,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.lg,
    padding: 16,
    marginBottom: 16,
    ...Layout.shadows.sm,
  },
  cardTitle: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 12,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary[50],
    color: Colors.primary[600],
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: Typography.family.bold,
    marginRight: 12,
    overflow: 'hidden',
  },
  instructionText: {
    flex: 1,
    fontSize: Typography.size.sm,
    color: Colors.gray[700],
    lineHeight: 20,
    fontFamily: Typography.family.regular,
  },
  inputLabel: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[700],
    marginBottom: 6,
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
    marginBottom: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger[50],
    padding: 10,
    borderRadius: Layout.radius.md,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: Colors.danger[700],
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
  },
  primaryButton: {
    backgroundColor: Colors.primary[600],
    borderRadius: Layout.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: Colors.primary[300],
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
  },
  statusCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.lg,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary[500],
    ...Layout.shadows.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  statusRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  statusLabel: {
    width: 80,
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[500],
  },
  statusValue: {
    flex: 1,
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.gray[700],
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTitle: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  toggleSubtitle: {
    fontSize: Typography.size.xs,
    color: Colors.gray[500],
    marginTop: 2,
    fontFamily: Typography.family.regular,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.gray[200],
    marginVertical: 16,
  },
  pickerSection: {
    marginTop: 4,
  },
  pickerLabel: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[700],
    marginBottom: 8,
  },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: Layout.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.gray[50],
  },
  pickerValue: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.medium,
    color: Colors.gray[900],
  },
  pickerDropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  pickerItemText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.gray[700],
  },
  selectedPickerItemText: {
    fontFamily: Typography.family.medium,
    color: Colors.primary[600],
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: Colors.primary[600],
    borderRadius: Layout.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  outlineButtonText: {
    color: Colors.primary[600],
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
  },
  testResultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: Layout.radius.md,
    marginTop: 12,
  },
  successResult: {
    backgroundColor: Colors.success[50],
  },
  successResultText: {
    flex: 1,
    color: Colors.success[700],
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
  },
  failResult: {
    backgroundColor: Colors.danger[50],
  },
  failResultText: {
    flex: 1,
    color: Colors.danger[700],
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
  },
  emptyListText: {
    fontSize: Typography.size.sm,
    color: Colors.gray[400],
    textAlign: 'center',
    paddingVertical: 12,
    fontFamily: Typography.family.regular,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  txCategory: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  txDesc: {
    fontSize: Typography.size.xs,
    color: Colors.gray[500],
    marginTop: 2,
    fontFamily: Typography.family.regular,
  },
  txDate: {
    fontSize: Typography.size.xs,
    color: Colors.gray[400],
    marginTop: 2,
    fontFamily: Typography.family.regular,
  },
  txAmount: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.danger[600],
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger[50],
    borderRadius: Layout.radius.md,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  disconnectButtonText: {
    color: Colors.danger[600],
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
  },
});
