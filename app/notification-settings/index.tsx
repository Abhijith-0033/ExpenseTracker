import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Linking, ActivityIndicator, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, CheckCircle, AlertCircle, Clock, ChevronRight, Settings } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Layout, Typography } from '../../constants/Theme';
import { 
  SETTINGS_KEYS, 
  checkAndRequestPermission,
  scheduleDailyReminder,
  scheduleDailyReport,
  rescheduleAll,
  cancelByPrefix
} from '../../services/notifications/NotificationManager';
import { Snackbar } from '../../components/Snackbar';

export default function NotificationSettingsScreen() {
  const router = useRouter();
  
  // Permission state
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied'>('checking');
  
  // Settings state
  const [masterEnabled, setMasterEnabled] = useState(true);
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false);
  const [dailyReportEnabled, setDailyReportEnabled] = useState(false);
  const [dailyReminderTime, setDailyReminderTime] = useState('21:00');
  const [dailyReportTime, setDailyReportTime] = useState('22:00');
  const [upcomingBillsEnabled, setUpcomingBillsEnabled] = useState(false);
  const [subscriptionsEnabled, setSubscriptionsEnabled] = useState(false);
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [debtOverdueEnabled, setDebtOverdueEnabled] = useState(false);
  const [debtRemindersEnabled, setDebtRemindersEnabled] = useState(false);
  const [chitMonthlyEnabled, setChitMonthlyEnabled] = useState(false);
  const [chitWinningEnabled, setChitWinningEnabled] = useState(false);
  const [savingsGoalsEnabled, setSavingsGoalsEnabled] = useState(false);
  const [budgetAlertsEnabled, setBudgetAlertsEnabled] = useState(false);
  const [emiRemindersEnabled, setEMIRemindersEnabled] = useState(false);
  const [emiAutopayEnabled, setEMIAutopayEnabled] = useState(false);
  const [telegramAlertsEnabled, setTelegramAlertsEnabled] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  
  // Custom time picker state
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<'reminder' | 'report'>('reminder');
  const [timePickerValue, setTimePickerValue] = useState(new Date());

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    checkPermissionStatus();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await Promise.all([
        AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_MASTER_ENABLED),
        AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_DAILY_REMINDER),
        AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_DAILY_REPORT),
        AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_DAILY_REMINDER_TIME),
        AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_DAILY_REPORT_TIME),
        AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_UPCOMING_BILLS),
        AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_SUBSCRIPTIONS),
        AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_RECURRING),
        AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_DEBT_OVERDUE),
        AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_DEBT_REMINDERS),
        AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_CHIT_MONTHLY),
        AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_CHIT_WINNING),
        AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_SAVINGS_GOALS),
        AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_BUDGET_ALERTS),
        AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_EMI_REMINDERS),
        AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_EMI_AUTOPAY),
        AsyncStorage.getItem(SETTINGS_KEYS.NOTIF_TELEGRAM),
      ]);

      setMasterEnabled(settings[0] === 'true');
      setDailyReminderEnabled(settings[1] === 'true');
      setDailyReportEnabled(settings[2] === 'true');
      setDailyReminderTime(settings[3] || '21:00');
      setDailyReportTime(settings[4] || '22:00');
      setUpcomingBillsEnabled(settings[5] === 'true');
      setSubscriptionsEnabled(settings[6] === 'true');
      setRecurringEnabled(settings[7] === 'true');
      setDebtOverdueEnabled(settings[8] === 'true');
      setDebtRemindersEnabled(settings[9] === 'true');
      setChitMonthlyEnabled(settings[10] === 'true');
      setChitWinningEnabled(settings[11] === 'true');
      setSavingsGoalsEnabled(settings[12] === 'true');
      setBudgetAlertsEnabled(settings[13] === 'true');
      setEMIRemindersEnabled(settings[14] === 'true');
      setEMIAutopayEnabled(settings[15] === 'true');
      setTelegramAlertsEnabled(settings[16] === 'true');
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  };

  const checkPermissionStatus = async () => {
    setPermissionStatus('checking');
    const hasPermission = await checkAndRequestPermission();
    setPermissionStatus(hasPermission ? 'granted' : 'denied');
  };

  const updateSetting = async (key: string, value: boolean) => {
    try {
      await AsyncStorage.setItem(key, value ? 'true' : 'false');
      setSnackbarMessage(`${value ? 'Enabled' : 'Disabled'} successfully`);
      setSnackbarVisible(true);
      
      // Reschedule notifications after setting change
      await rescheduleAll();
    } catch (error) {
      console.error('Failed to update setting:', error);
      setSnackbarMessage('Failed to update setting');
      setSnackbarVisible(true);
    }
  };

  const updateTimeSetting = async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
      setSnackbarMessage('Time updated successfully');
      setSnackbarVisible(true);
      
      // Reschedule affected notifications
      if (key === SETTINGS_KEYS.NOTIF_DAILY_REMINDER_TIME) {
        await scheduleDailyReminder();
      } else if (key === SETTINGS_KEYS.NOTIF_DAILY_REPORT_TIME) {
        await scheduleDailyReport();
      }
    } catch (error) {
      console.error('Failed to update time setting:', error);
      setSnackbarMessage('Failed to update time');
      setSnackbarVisible(true);
    }
  };

  const handleMasterToggle = async (value: boolean) => {
    setMasterEnabled(value);
    await updateSetting(SETTINGS_KEYS.NOTIF_MASTER_ENABLED, value);
    
    if (!value) {
      // Disable all individual settings when master is off
      await Promise.all([
        AsyncStorage.setItem(SETTINGS_KEYS.NOTIF_DAILY_REMINDER, 'false'),
        AsyncStorage.setItem(SETTINGS_KEYS.NOTIF_DAILY_REPORT, 'false'),
        AsyncStorage.setItem(SETTINGS_KEYS.NOTIF_UPCOMING_BILLS, 'false'),
        AsyncStorage.setItem(SETTINGS_KEYS.NOTIF_SUBSCRIPTIONS, 'false'),
        AsyncStorage.setItem(SETTINGS_KEYS.NOTIF_RECURRING, 'false'),
        AsyncStorage.setItem(SETTINGS_KEYS.NOTIF_DEBT_OVERDUE, 'false'),
        AsyncStorage.setItem(SETTINGS_KEYS.NOTIF_DEBT_REMINDERS, 'false'),
        AsyncStorage.setItem(SETTINGS_KEYS.NOTIF_CHIT_MONTHLY, 'false'),
        AsyncStorage.setItem(SETTINGS_KEYS.NOTIF_CHIT_WINNING, 'false'),
        AsyncStorage.setItem(SETTINGS_KEYS.NOTIF_SAVINGS_GOALS, 'false'),
        AsyncStorage.setItem(SETTINGS_KEYS.NOTIF_BUDGET_ALERTS, 'false'),
        AsyncStorage.setItem(SETTINGS_KEYS.NOTIF_EMI_REMINDERS, 'false'),
        AsyncStorage.setItem(SETTINGS_KEYS.NOTIF_EMI_AUTOPAY, 'false'),
        AsyncStorage.setItem(SETTINGS_KEYS.NOTIF_TELEGRAM, 'false'),
      ]);
      
      // Update UI state
      setDailyReminderEnabled(false);
      setDailyReportEnabled(false);
      setUpcomingBillsEnabled(false);
      setSubscriptionsEnabled(false);
      setRecurringEnabled(false);
      setDebtOverdueEnabled(false);
      setDebtRemindersEnabled(false);
      setChitMonthlyEnabled(false);
      setChitWinningEnabled(false);
      setSavingsGoalsEnabled(false);
      setBudgetAlertsEnabled(false);
      setEMIRemindersEnabled(false);
      setEMIAutopayEnabled(false);
      setTelegramAlertsEnabled(false);
      
      // Cancel all notifications
      await cancelByPrefix('');
    } else {
      // Re-enable previously enabled settings
      await loadSettings();
      await rescheduleAll();
    }
  };

  const openDeviceSettings = () => {
    Linking.openSettings();
  };

  const showTimePicker = (currentTime: string, type: 'reminder' | 'report') => {
    const [h, m] = currentTime.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    setTimePickerValue(d);
    setTimePickerTarget(type);
    setShowTimePickerModal(true);
  };

  const handleTimeSelect = (time: string, type: 'reminder' | 'report') => {
    if (type === 'reminder') {
      setDailyReminderTime(time);
      updateTimeSetting(SETTINGS_KEYS.NOTIF_DAILY_REMINDER_TIME, time);
    } else {
      setDailyReportTime(time);
      updateTimeSetting(SETTINGS_KEYS.NOTIF_DAILY_REPORT_TIME, time);
    }
  };

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':');
    const hourNum = parseInt(hour);
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour = hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
    return `${displayHour}:${minute} ${ampm}`;
  };

  const ToggleRow = ({ title, subtitle, value, onToggle, disabled = false }: {
    title: string;
    subtitle?: string;
    value: boolean;
    onToggle: (value: boolean) => void;
    disabled?: boolean;
  }) => (
    <View style={[styles.toggleRow, disabled && styles.disabledRow]}>
      <View style={styles.toggleContent}>
        <Text style={[styles.toggleTitle, disabled && styles.disabledText]}>{title}</Text>
        {subtitle && <Text style={[styles.toggleSubtitle, disabled && styles.disabledText]}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled || !masterEnabled}
        trackColor={{ false: Colors.gray[300], true: Colors.primary[500] }}
        thumbColor={Colors.white}
        ios_backgroundColor={Colors.gray[300]}
      />
    </View>
  );

  const TimeRow = ({ title, time, onPress, disabled = false }: any) => (
    <TouchableOpacity 
      style={[styles.timeRow, disabled && styles.disabledRow]} 
      onPress={onPress}
      disabled={disabled || !masterEnabled}
    >
      <View style={styles.timeContent}>
        <Text style={[styles.timeTitle, disabled && styles.disabledText]}>{title}</Text>
        <Text style={[styles.timeValue, disabled && styles.disabledText]}>{formatTime(time)}</Text>
      </View>
      <ChevronRight size={20} color={disabled ? Colors.gray[400] : Colors.gray[400]} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Permission Status Card */}
        <View style={styles.permissionCard}>
          {permissionStatus === 'checking' && (
            <View style={styles.permissionChecking}>
              <ActivityIndicator size="small" color={Colors.primary[600]} />
              <Text style={styles.permissionText}>Checking permission status...</Text>
            </View>
          )}
          
          {permissionStatus === 'granted' && (
            <View style={styles.permissionGranted}>
              <CheckCircle size={20} color={Colors.success[600]} />
              <Text style={styles.permissionText}>✅ Notifications Allowed</Text>
            </View>
          )}
          
          {permissionStatus === 'denied' && (
            <View style={styles.permissionDenied}>
              <AlertCircle size={20} color={Colors.danger[600]} />
              <View style={styles.permissionContent}>
                <Text style={styles.permissionText}>⚠️ Notifications Blocked</Text>
                <Text style={styles.permissionSubtext}>Tap to open Settings and allow notifications</Text>
                <TouchableOpacity style={styles.openSettingsBtn} onPress={openDeviceSettings}>
                  <Text style={styles.openSettingsText}>Open Settings</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Master Toggle */}
        <View style={styles.masterToggleCard}>
          <View style={styles.masterToggleContent}>
            <View style={styles.masterToggleInfo}>
              <Bell size={24} color={Colors.primary[600]} />
              <View style={styles.masterToggleText}>
                <Text style={styles.masterToggleTitle}>All Notifications</Text>
                <Text style={styles.masterToggleSubtitle}>Master switch for all app notifications</Text>
              </View>
            </View>
            <Switch
              value={masterEnabled}
              onValueChange={handleMasterToggle}
              trackColor={{ false: Colors.gray[300], true: Colors.primary[500] }}
              thumbColor={Colors.white}
              ios_backgroundColor={Colors.gray[300]}
            />
          </View>
        </View>

        {/* Daily Tracking Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DAILY TRACKING</Text>
          
          <ToggleRow
            title="Daily Expense Reminder"
            subtitle="Remind you to log today's expenses"
            value={dailyReminderEnabled}
            onToggle={(value) => {
              setDailyReminderEnabled(value);
              updateSetting(SETTINGS_KEYS.NOTIF_DAILY_REMINDER, value);
            }}
            disabled={!masterEnabled}
          />
          
          {dailyReminderEnabled && (
            <TimeRow
              title="Reminder Time"
              time={dailyReminderTime}
              onPress={() => showTimePicker(dailyReminderTime, 'reminder')}
              disabled={!masterEnabled}
            />
          )}
          
          <ToggleRow
            title="Daily Expense Report"
            subtitle="Evening summary of today's transactions (only sent if you have transactions)"
            value={dailyReportEnabled}
            onToggle={(value) => {
              setDailyReportEnabled(value);
              updateSetting(SETTINGS_KEYS.NOTIF_DAILY_REPORT, value);
            }}
            disabled={!masterEnabled}
          />
          
          {dailyReportEnabled && (
            <TimeRow
              title="Report Time"
              time={dailyReportTime}
              onPress={() => showTimePicker(dailyReportTime, 'report')}
              disabled={!masterEnabled}
            />
          )}
        </View>

        {/* Bills & Payments Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BILLS & PAYMENTS</Text>
          
          <ToggleRow
            title="Upcoming Bill Reminders"
            subtitle="Alerts before bill due dates"
            value={upcomingBillsEnabled}
            onToggle={(value) => {
              setUpcomingBillsEnabled(value);
              updateSetting(SETTINGS_KEYS.NOTIF_UPCOMING_BILLS, value);
            }}
            disabled={!masterEnabled}
          />
          
          <ToggleRow
            title="Subscription Renewals"
            subtitle="Reminders before subscriptions renew"
            value={subscriptionsEnabled}
            onToggle={(value) => {
              setSubscriptionsEnabled(value);
              updateSetting(SETTINGS_KEYS.NOTIF_SUBSCRIPTIONS, value);
            }}
            disabled={!masterEnabled}
          />
          
          <ToggleRow
            title="Recurring Transactions"
            subtitle="Reminders for scheduled transactions"
            value={recurringEnabled}
            onToggle={(value) => {
              setRecurringEnabled(value);
              updateSetting(SETTINGS_KEYS.NOTIF_RECURRING, value);
            }}
            disabled={!masterEnabled}
          />
        </View>

        {/* Debt Tracker Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DEBT TRACKER</Text>
          
          <ToggleRow
            title="Overdue Payment Alerts"
            subtitle="Daily alerts when debt payments are overdue"
            value={debtOverdueEnabled}
            onToggle={(value) => {
              setDebtOverdueEnabled(value);
              updateSetting(SETTINGS_KEYS.NOTIF_DEBT_OVERDUE, value);
            }}
            disabled={!masterEnabled}
          />
          
          <ToggleRow
            title="Upcoming Payment Reminders"
            subtitle="Alerts 7, 3, and 1 day before due date"
            value={debtRemindersEnabled}
            onToggle={(value) => {
              setDebtRemindersEnabled(value);
              updateSetting(SETTINGS_KEYS.NOTIF_DEBT_REMINDERS, value);
            }}
            disabled={!masterEnabled}
          />
        </View>

        {/* Chit Funds Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CHIT FUNDS</Text>
          
          <ToggleRow
            title="Monthly Payment Reminders"
            subtitle="Alerts before your chit payment is due"
            value={chitMonthlyEnabled}
            onToggle={(value) => {
              setChitMonthlyEnabled(value);
              updateSetting(SETTINGS_KEYS.NOTIF_CHIT_MONTHLY, value);
            }}
            disabled={!masterEnabled}
          />
          
          <ToggleRow
            title="Winning Month Alerts"
            subtitle="Alerts when your chit turn is approaching"
            value={chitWinningEnabled}
            onToggle={(value) => {
              setChitWinningEnabled(value);
              updateSetting(SETTINGS_KEYS.NOTIF_CHIT_WINNING, value);
            }}
            disabled={!masterEnabled}
          />
        </View>

        {/* Goals & Budgets Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GOALS & BUDGETS</Text>
          
          <ToggleRow
            title="Savings Goal Progress"
            subtitle="Milestone alerts and deadline reminders"
            value={savingsGoalsEnabled}
            onToggle={(value) => {
              setSavingsGoalsEnabled(value);
              updateSetting(SETTINGS_KEYS.NOTIF_SAVINGS_GOALS, value);
            }}
            disabled={!masterEnabled}
          />
          
          <ToggleRow
            title="Budget Limit Alerts"
            subtitle="Alerts at 80%, 90%, and when budget is exceeded"
            value={budgetAlertsEnabled}
            onToggle={(value) => {
              setBudgetAlertsEnabled(value);
              updateSetting(SETTINGS_KEYS.NOTIF_BUDGET_ALERTS, value);
            }}
            disabled={!masterEnabled}
          />
        </View>

        {/* EMI Tracker Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EMI TRACKER</Text>
          
          <ToggleRow
            title="EMI Payment Reminders"
            subtitle="Alerts 7, 3, and 1 day before EMI due date"
            value={emiRemindersEnabled}
            onToggle={(value) => {
              setEMIRemindersEnabled(value);
              updateSetting(SETTINGS_KEYS.NOTIF_EMI_REMINDERS, value);
            }}
            disabled={!masterEnabled}
          />
          
          <ToggleRow
            title="EMI AutoPay Notifications"
            subtitle="Alerts when AutoPay processes EMI payments"
            value={emiAutopayEnabled}
            onToggle={(value) => {
              setEMIAutopayEnabled(value);
              updateSetting(SETTINGS_KEYS.NOTIF_EMI_AUTOPAY, value);
            }}
            disabled={!masterEnabled}
          />
        </View>

        {/* Integrations Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INTEGRATIONS</Text>
          
          <ToggleRow
            title="Telegram Transaction Alerts"
            subtitle="Notify when Telegram expenses are added or fail"
            value={telegramAlertsEnabled}
            onToggle={(value) => {
              setTelegramAlertsEnabled(value);
              updateSetting(SETTINGS_KEYS.NOTIF_TELEGRAM, value);
            }}
            disabled={!masterEnabled}
          />
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 Tip</Text>
          <Text style={styles.infoText}>
            Notifications help you stay on top of your finances. We recommend keeping Daily Reminder and Budget Alerts enabled.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        message={snackbarMessage}
        onDismiss={() => setSnackbarVisible(false)}
      />

      {/* Time Picker Modal */}
      {showTimePickerModal && (
        <DateTimePicker
          value={timePickerValue}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onChange={(event, selectedDate) => {
            setShowTimePickerModal(false);
            if (selectedDate) {
              const h = selectedDate.getHours().toString().padStart(2, '0');
              const m = selectedDate.getMinutes().toString().padStart(2, '0');
              handleTimeSelect(`${h}:${m}`, timePickerTarget);
            }
          }}
        />
      )}
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: Colors.white,
  },
  backBtn: {
    padding: 4,
    marginLeft: -4,
  },
  headerTitle: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  permissionCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.lg,
    padding: 20,
    marginBottom: 20,
    ...Layout.shadows.sm,
  },
  permissionChecking: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionGranted: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionDenied: {
    alignItems: 'center',
  },
  permissionText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.medium,
    color: Colors.gray[900],
    marginLeft: 8,
  },
  permissionSubtext: {
    fontSize: Typography.size.sm,
    color: Colors.gray[600],
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  permissionContent: {
    alignItems: 'center',
  },
  openSettingsBtn: {
    backgroundColor: Colors.danger[600],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Layout.radius.md,
  },
  openSettingsText: {
    color: 'white',
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
  },
  masterToggleCard: {
    backgroundColor: Colors.primary[100],
    borderRadius: Layout.radius.lg,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  masterToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  masterToggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  masterToggleText: {
    marginLeft: 12,
    flex: 1,
  },
  masterToggleTitle: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.primary[700],
    marginBottom: 2,
  },
  masterToggleSubtitle: {
    fontSize: Typography.size.sm,
    color: Colors.primary[600],
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.lg,
    marginBottom: 20,
    ...Layout.shadows.sm,
  },
  sectionTitle: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[500],
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  disabledRow: {
    opacity: 0.5,
  },
  toggleContent: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.medium,
    color: Colors.gray[900],
    marginBottom: 2,
  },
  disabledText: {
    color: Colors.gray[400],
  },
  toggleSubtitle: {
    fontSize: Typography.size.sm,
    color: Colors.gray[500],
    lineHeight: 18,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    backgroundColor: Colors.gray[50],
    marginLeft: 20,
    marginRight: 20,
    borderRadius: Layout.radius.md,
    marginBottom: 8,
  },
  timeContent: {
    flex: 1,
  },
  timeTitle: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[700],
    marginBottom: 2,
  },
  timeValue: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.primary[600],
  },
  infoCard: {
    backgroundColor: Colors.primary[50],
    borderRadius: Layout.radius.lg,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  infoTitle: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.primary[700],
    marginBottom: 8,
  },
  infoText: {
    fontSize: Typography.size.sm,
    color: Colors.primary[600],
    lineHeight: 20,
  },
});
