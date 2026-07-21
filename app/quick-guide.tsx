import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  LayoutAnimation, Platform, UIManager, Pressable 
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  ArrowLeft, ChevronDown, ChevronUp, Lock, HelpCircle, 
  Wallet, Target, Clock, PiggyBank, Calendar, FileText, Send, Sparkles,
  BookOpen, CreditCard, Users, RefreshCw, CalendarClock, Tag
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Layout } from '../constants/Theme';
import { useSubscription } from '../src/subscription/useSubscription';
import { LinearGradient } from 'expo-linear-gradient';
import { getUserDisplayName, getCertificateNumber } from '../services/onboardingState';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface GuideSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  isPremium: boolean;
  content: string[];
}

export default function QuickGuideScreen() {
  const router = useRouter();
  const { isPremium, isTrialActive } = useSubscription();
  const isFreeUser = !isPremium && !isTrialActive;

  const [expandedId, setExpandedId] = useState<string | null>('getting-started');
  const [certUserName, setCertUserName] = useState<string>('');
  const [certNumber, setCertNumber] = useState<string>('');
  const [showTrialTour, setShowTrialTour] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadCertData() {
      try {
        const name = await getUserDisplayName();
        const cert = await getCertificateNumber();
        if (!cancelled) {
          setCertUserName(name ?? '');
          setCertNumber(cert ?? '');
        }
      } catch (e) {
        console.warn('QuickGuide: failed to load cert data:', e);
      }
    }
    loadCertData();

    async function checkTrialTourStatus() {
      try {
        const val = await AsyncStorage.getItem('trial_feature_tour_shown');
        if (val !== 'true' && isTrialActive) {
          setShowTrialTour(true);
        }
      } catch (e) {
        console.warn('Failed to check trial feature tour status:', e);
      }
    }
    checkTrialTourStatus();

    return () => { cancelled = true; };
  }, [isTrialActive]);

  const handleStartTrialTour = async (route: string) => {
    try {
      await AsyncStorage.setItem('trial_feature_tour_shown', 'true');
      setShowTrialTour(false);
      router.push(route as any);
    } catch (e) {
      console.warn('Failed to start trial tour:', e);
    }
  };

  const toggleSection = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const sections: GuideSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: <Wallet size={20} color="#2563EB" />,
      isPremium: false,
      content: [
        'Gastos helps you track all your accounts and expenses in one single place.',
        '• Accounts: Keep track of Cash, Bank accounts, Credit Cards, or digital wallets. Set custom initial balances.',
        '• Logging Transactions: Tap the "+" button at the bottom navigation bar to record Expenses, Income, or Transfers between accounts.',
        '• Subcategories & Notes: Group expenses into categories (e.g. Food → Groceries) and add descriptions to remember details.'
      ]
    },
    {
      id: 'budgets',
      title: 'Category Budgets',
      icon: <Target size={20} color="#059669" />,
      isPremium: false,
      content: [
        'Keep your spending under control by setting monthly limits on categories.',
        '• Create Budgets: Navigate to Settings → Category Budgets. Set custom monthly limits.',
        '• Visual Status: Budgets show progress bars matching your spending level:',
        '  - Green: Safe and on track.',
        '  - Orange: Caution (approaching budget).',
        '  - Red: Warning (exceeded budget limit).'
      ]
    },
    {
      id: 'upcoming-bills',
      title: 'Upcoming Bills Manager',
      icon: <Calendar size={20} color={Colors.primary[600]} />,
      isPremium: true,
      content: [
        'Never forget utility bills, rent, credit card dues, or subscriptions.',
        '• Add a Bill: Set the name, amount, due date, pay account, and recurrence (Once, Weekly, Monthly, Yearly).',
        '• Multi-Tier Reminders: Automatically schedules notification reminders 7, 3, 2, and 1 day before the bill is due.',
        '• Quick Mark Paid: Tapping the checkmark silently records the expense in the background, updates your account balance, and updates the bill status. No extra screens required.'
      ]
    },
    {
      id: 'scheduled-expenses',
      title: 'Scheduled Expenses',
      icon: <Clock size={20} color="#7C3AED" />,
      isPremium: true,
      content: [
        'Automate recurring transactions that happen periodically.',
        '• Auto-Run Enabled: Gastos will automatically log the transaction in the background when the scheduled time is reached, notifying you of the action.',
        '• Approval Flow: If Auto-Run is disabled, you will receive a push notification asking to Approve or Reject the transaction when it triggers.'
      ]
    },
    {
      id: 'sinking-funds',
      title: 'Sinking Funds',
      icon: <PiggyBank size={20} color="#14B8A6" />,
      isPremium: true,
      content: [
        'Save gradually for predictable big expenses in the future (e.g. annual insurance premiums, festivals, holiday trips).',
        '• Set a Target: Enter the total amount needed and target date.',
        '• Auto Target Saving: Gastos automatically calculates the monthly contribution needed to reach your goal.',
        '• Fund Contributions: Log savings transfers to track your progress.'
      ]
    },
    {
      id: 'future-calendar',
      title: 'Future Calendar (Forecast)',
      icon: <Sparkles size={20} color="#0BA5EC" />,
      isPremium: true,
      content: [
        'See your future financial position before it happens.',
        '• 30-Day Timeline: Graphs a projection of your daily running balance over the next 30 days.',
        '• Upcoming Events: Combines upcoming bills, subscriptions, scheduled expenses, and AI-predicted transaction patterns to forewarn you if your balance will dip below zero.'
      ]
    },
    {
      id: 'tax-planner',
      title: 'Tax Planner',
      icon: <FileText size={20} color="#059669" />,
      isPremium: true,
      content: [
        'Estimate your annual tax liability and plan deductions.',
        '• Old vs New Regime: Input your salary, HRA, rent, and basic details to view side-by-side comparison charts of tax payable under both schemes.',
        '• Investment Tracking: Log Section 80C (PPF, ELSS, Insurance) and 80D investments to see real-time updates of deductions and tax savings.'
      ]
    },
    {
      id: 'telegram-bot',
      title: 'Telegram Bot Integration',
      icon: <Send size={20} color="#0088CC" />,
      isPremium: false,
      content: [
        'Log transactions on the go without even opening the app.',
        '• Link Account: Settings → Telegram Bot. Link your account by starting a chat with our Telegram bot.',
        '• Simple Commands: Send text commands like "150 Coffee" or "500 Petrol" directly to the bot. It parses the amount and category, logging it immediately into your app.'
      ]
    },
    {
      id: 'accounts',
      title: 'Account Management',
      icon: <Wallet size={20} color={Colors.primary[600]} />,
      isPremium: false,
      content: [
        'Manage all your money pools — Cash, Bank, Credit Card, UPI Wallets — in one place.',
        '• Add Account: Settings → Manage Accounts. Set a custom name, type, and initial balance.',
        '• Balance Updates: Every transaction automatically adjusts the linked account balance in real time.',
        '• Transfers: Use the Transfer feature to move money between your own accounts (e.g. Cash to Bank) without affecting total net worth.',
      ]
    },
    {
      id: 'categories',
      title: 'Custom Categories & Subcategories',
      icon: <Tag size={20} color="#7C3AED" />,
      isPremium: false,
      content: [
        'Organize your spending exactly the way you think about it.',
        '• Manage Categories: Settings → Manage Categories. Add, rename or delete expense categories.',
        '• Subcategories: Each category can have multiple subcategories (e.g. Food → Groceries, Dining, Snacks).',
        '• Recharge Categories: Mark any category as "Recurring Recharge" to auto-suggest validity periods (e.g. Mobile Recharge valid 28 days).',
      ]
    },
    {
      id: 'debt-tracker',
      title: 'Debt Tracker',
      icon: <CreditCard size={20} color="#EF4444" />,
      isPremium: true,
      content: [
        'Track all money you owe or are owed in one organized place.',
        '• I Owe (Debt): Record borrowed money, loans from friends, or credit card debt. Set due dates and get overdue alerts.',
        '• They Owe Me (Credit): Track money you have lent out. Gastos reminds you when repayment is overdue.',
        '• Mark Paid: Settling a debt automatically creates a transaction in the linked account.',
        '• Distribution Chart: See at a glance how much you owe across different people or institutions.',
      ]
    },
    {
      id: 'emi-tracker',
      title: 'EMI Tracker',
      icon: <Calendar size={20} color="#9C27B0" />,
      isPremium: true,
      content: [
        'Never miss an EMI payment for loans, credit cards or subscriptions.',
        '• Add EMI: Set loan name, total amount, EMI amount, start date and number of installments.',
        '• Auto-Pay: Enable Auto-Pay to automatically record EMI deductions on the due date.',
        '• Progress Tracking: See how many installments remain and total amount paid vs. outstanding.',
        '• Payment Reminders: Get notified before each EMI due date.',
      ]
    },
    {
      id: 'chit-funds',
      title: 'Chit Funds',
      icon: <Users size={20} color="#10B981" />,
      isPremium: true,
      content: [
        'Track traditional chit fund investments and monthly contributions.',
        '• Add Chit: Set chit name, total value, duration (months), and monthly contribution.',
        '• Monthly Reminders: Gastos notifies you at the start of each month for your contribution.',
        '• Winning Month: Mark the month you won the chit pot — the amount is credited to your account.',
        '• Status Overview: Track total contributed, remaining months, and whether you have won.',
      ]
    },
    {
      id: 'expense-book',
      title: 'Expense Book (Khata)',
      icon: <BookOpen size={20} color={Colors.primary[600]} />,
      isPremium: false,
      content: [
        'Maintain a traditional ledger-style book for informal tracking with friends, family, or vendors.',
        '• Create Book: Give it a name and description (e.g. "Shared Flat Expenses", "Vendor Account").',
        '• Log Entries: Add credit (you paid) or debit (they paid) entries with dates and notes.',
        '• Running Balance: The book automatically shows the net balance and running total.',
      ]
    },
    {
      id: 'bill-splitter',
      title: 'Bill Splitter',
      icon: <Users size={20} color="#0088CC" />,
      isPremium: false,
      content: [
        'Split shared expenses fairly among a group of friends.',
        '• Create Group: Name your group (e.g. "Goa Trip", "Office Lunch") and add members.',
        '• Add Expense: Log who paid and split the amount equally or by custom shares.',
        '• Balances: Gastos calculates exactly who owes what to whom to settle the group.',
      ]
    },
    {
      id: 'subscriptions',
      title: 'Subscription Tracker',
      icon: <RefreshCw size={20} color="#0BA5EC" />,
      isPremium: true,
      content: [
        'Track all your recurring subscriptions and never get surprised by a renewal.',
        '• Add Subscription: Enter name, amount, billing cycle (Monthly/Yearly), and renewal date.',
        '• Renewal Alerts: Get notified a few days before a subscription renews.',
        '• Total Spend: See your total monthly and yearly spend across all active subscriptions.',
      ]
    },
    {
      id: 'financial-report',
      title: 'Financial Report',
      icon: <FileText size={20} color="#059669" />,
      isPremium: true,
      content: [
        'Generate comprehensive monthly or custom-period financial summaries.',
        '• Income vs Expense: Bar chart comparison of earnings vs spending for any period.',
        '• Category Breakdown: Pie chart showing where your money went.',
        '• Savings Rate: Calculates your savings percentage for the selected period.',
        '• Export: Share the report as a PDF or CSV file.',
      ]
    },
    {
      id: 'savings-goals',
      title: 'Savings Goals',
      icon: <Target size={20} color="#E8917A" />,
      isPremium: true,
      content: [
        'Set financial goals and track your progress towards achieving them.',
        '• Create Goal: Name your goal (e.g. "Emergency Fund", "Vacation"), set a target amount and deadline.',
        '• Contributions: Log savings contributions to track progress on each goal.',
        '• Progress Visualization: Color-coded progress bars and percentage completion.',
        '• Completion Alert: Get notified when you achieve a goal.',
      ]
    },
    {
      id: 'app-lock',
      title: 'App Security & Lock',
      icon: <Lock size={20} color={Colors.gray[800] || Colors.gray[900]} />,
      isPremium: false,
      content: [
        'Keep your financial data private and secure.',
        '• PIN Lock: Set a 4 or 6-digit PIN from Settings → App Lock.',
        '• Biometric: Enable fingerprint or face unlock if supported by your device.',
        '• Auto-Lock Timeout: Choose how long to wait before locking (Immediately, 1 min, 5 min, 15 min, 1 hour).',
        '• The lock screen activates automatically when the app goes to the background for longer than your chosen timeout.',
      ]
    },
    {
      id: 'cash-flow',
      title: 'Cash Flow Calendar',
      icon: <CalendarClock size={20} color="#6366F1" />,
      isPremium: true,
      content: [
        'Visualize your daily cash inflows and outflows across a month.',
        '• Monthly Calendar View: Each day shows a green (income) or red (expense) indicator.',
        '• Day Detail: Tap any day to see all transactions logged on that date.',
        '• Running Balance Projection: Combines your current balance with upcoming bills and scheduled expenses to show your future balance on any day.',
      ]
    }
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Quick Guide</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        {/* ── Certificate Card ── */}
        <Pressable
          onPress={() => router.push({
            pathname: '/certificate' as any,
            params: { isFirstTime: 'false' },
          })}
          style={({ pressed }) => pressed ? { opacity: 0.92 } : {}}
        >
          <LinearGradient
            colors={[Colors.primary[600], Colors.primary[700]]}
            style={styles.certCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.certCardContent}>
              {/* Left: mini certificate placeholder */}
              <View style={styles.certMiniPreview}>
                <Text style={styles.certMiniEmoji}>🏆</Text>
                <View style={styles.certMiniLine} />
                <Text style={styles.certMiniText} numberOfLines={1}>
                  {certUserName || 'Your Name'}
                </Text>
              </View>

              {/* Right: details + download button */}
              <View style={styles.certCardRight}>
                <Text style={styles.certCardLabel}>🏆 Your Certificate</Text>
                <Text style={styles.certCardSub}>Financial Commitment</Text>
                {certUserName ? (
                  <Text style={styles.certCardName} numberOfLines={1}>
                    {certUserName}
                  </Text>
                ) : null}
                {certNumber ? (
                  <Text style={styles.certCardNum}>{certNumber}</Text>
                ) : null}

                <Pressable
                  onPress={() => router.push({
                    pathname: '/certificate' as any,
                    params: { isFirstTime: 'false' },
                  })}
                  style={({ pressed }) => [
                    styles.certDownloadBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.certDownloadBtnText}>Download</Text>
                </Pressable>
              </View>
            </View>
          </LinearGradient>
        </Pressable>

        {/* Start Your Trial (Guided Tour Card) */}
        {showTrialTour && (
          <LinearGradient
            colors={['#7C3AED', '#4F46E5']}
            style={styles.trialTourCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.trialTourContent}>
              <View style={styles.trialTourHeader}>
                <Sparkles size={20} color="#FBBF24" />
                <Text style={styles.trialTourTitle}>Premium Trial is Live!</Text>
              </View>
              <Text style={styles.trialTourBody}>
                {"Let's explore 3 premium features together. Tap any module below to start your guided tour."}
              </Text>
              <View style={styles.trialTourGrid}>
                <Pressable
                  style={({ pressed }) => [styles.trialTourBtn, pressed && styles.trialTourBtnPressed]}
                  onPress={() => handleStartTrialTour('/emi-tracker')}
                >
                  <Text style={styles.trialTourBtnText}>EMI Tracker</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.trialTourBtn, pressed && styles.trialTourBtnPressed]}
                  onPress={() => handleStartTrialTour('/tax-planner')}
                >
                  <Text style={styles.trialTourBtnText}>Tax Planner</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.trialTourBtn, pressed && styles.trialTourBtnPressed]}
                  onPress={() => handleStartTrialTour('/scheduled-expenses')}
                >
                  <Text style={styles.trialTourBtnText}>Scheduled Logs</Text>
                </Pressable>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* Intro Card */}
        <View style={styles.introCard}>
          <HelpCircle size={32} color={Colors.primary[600]} style={{ marginBottom: 12 }} />
          <Text style={styles.introTitle}>Gastos User Guide</Text>
          <Text style={styles.introDesc}>
            Understand how each financial module in Gastos works to manage your money like a pro.
          </Text>
        </View>

        {/* Accordions */}
        {sections.map((section) => {
          const isExpanded = expandedId === section.id;
          return (
            <View key={section.id} style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionHeader}
                activeOpacity={0.8}
                onPress={() => toggleSection(section.id)}
              >
                <View style={styles.sectionTitleRow}>
                  <View style={styles.iconContainer}>{section.icon}</View>
                  <Text style={styles.sectionTitleText}>{section.title}</Text>
                  {section.isPremium && (
                    <View style={styles.premiumBadge}>
                      <Lock size={10} color="#D97706" style={{ marginRight: 2 }} />
                      <Text style={styles.premiumBadgeText}>PREMIUM</Text>
                    </View>
                  )}
                </View>
                {isExpanded ? (
                  <ChevronUp size={20} color={Colors.gray[400]} />
                ) : (
                  <ChevronDown size={20} color={Colors.gray[400]} />
                )}
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.sectionContent}>
                  {section.content.map((paragraph, index) => (
                    <Text key={index} style={styles.contentText}>
                      {paragraph}
                    </Text>
                  ))}
                  {section.isPremium && isFreeUser && (
                    <TouchableOpacity
                      style={styles.unlockBtn}
                      onPress={() => router.push('/paywall')}
                    >
                      <Text style={styles.unlockBtnText}>Unlock Feature</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray[50],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  introCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.xl,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gray[100],
    ...Layout.shadows.sm,
    marginBottom: 8,
  },
  introTitle: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 4,
  },
  introDesc: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.lg,
    borderWidth: 1,
    borderColor: Colors.gray[100],
    overflow: 'hidden',
    ...Layout.shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.gray[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitleText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[800],
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Layout.radius.full,
    marginLeft: 8,
  },
  premiumBadgeText: {
    fontSize: 8,
    fontFamily: Typography.family.bold,
    color: '#D97706',
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[50],
    paddingTop: 12,
  },
  contentText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.gray[600],
    lineHeight: 22,
    marginBottom: 8,
  },
  unlockBtn: {
    backgroundColor: Colors.primary[50],
    paddingVertical: 10,
    borderRadius: Layout.radius.md,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.primary[100],
  },
  unlockBtnText: {
    color: Colors.primary[600],
    fontFamily: Typography.family.bold,
    fontSize: Typography.size.sm,
  },
  // ── Certificate Card ──
  certCard: {
    borderRadius: Layout.radius.xl,
    marginBottom: Layout.spacing.sm,
    overflow: 'hidden',
  },
  certCardContent: {
    flexDirection: 'row',
    padding: Layout.spacing.lg,
    gap: Layout.spacing.md,
    alignItems: 'center',
  },
  certMiniPreview: {
    width: 80,
    aspectRatio: 1.414,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Layout.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Layout.spacing.sm,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  certMiniEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  certMiniLine: {
    width: '80%',
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  certMiniText: {
    fontSize: 7,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: Typography.family.bold,
    textAlign: 'center',
  },
  certCardRight: {
    flex: 1,
  },
  certCardLabel: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: '#FFFFFF',
  },
  certCardSub: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  certCardName: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: '#FFFFFF',
    fontStyle: 'italic',
    marginTop: Layout.spacing.xs,
  },
  certCardNum: {
    fontSize: 10,
    fontFamily: Typography.family.regular,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  certDownloadBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: Layout.radius.full,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.xs,
    alignSelf: 'flex-start',
    marginTop: Layout.spacing.sm,
  },
  certDownloadBtnText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
    color: Colors.primary[600],
  },
  trialTourCard: {
    borderRadius: Layout.radius.xl,
    marginBottom: Layout.spacing.md,
    overflow: 'hidden',
    ...Layout.shadows.md,
  },
  trialTourContent: {
    padding: 20,
  },
  trialTourHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  trialTourTitle: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: '#FFFFFF',
  },
  trialTourBody: {
    fontSize: Typography.size.xs + 1,
    fontFamily: Typography.family.regular,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
    marginBottom: 16,
  },
  trialTourGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  trialTourBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: Layout.radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  trialTourBtnText: {
    fontSize: 11,
    fontFamily: Typography.family.bold,
    color: '#FFFFFF',
  },
  trialTourBtnPressed: {
    opacity: 0.8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
});
