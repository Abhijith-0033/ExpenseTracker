import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  LayoutAnimation, Platform, UIManager, Pressable, TextInput, Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, ChevronDown, ChevronUp, Lock, HelpCircle, 
  Wallet, Target, Clock, PiggyBank, Calendar, FileText, Send, Sparkles,
  BookOpen, CreditCard, Users, RefreshCw, CalendarClock, Tag, Search, Mail, PieChart, ShieldCheck, FileSpreadsheet
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Layout } from '../constants/Theme';
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
  tagline: string;
  content: string[];
  steps?: string[];
  tips?: string[];
}

export default function QuickGuideScreen() {
  const router = useRouter();

  const [expandedId, setExpandedId] = useState<string | null>('getting-started');
  const [certUserName, setCertUserName] = useState<string>('');
  const [certNumber, setCertNumber] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'free' | 'premium'>('all');

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

    return () => { cancelled = true; };
  }, []);

  const toggleSection = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const sections: GuideSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started & Daily Tracking',
      icon: <Wallet size={20} color="#2563EB" />,
      isPremium: false,
      tagline: 'Log transactions, manage accounts, and monitor your Net Worth.',
      content: [
        'Gastos is your single command center for tracking every rupee across all accounts, wallets, and cash pools.',
        'Whenever you spend or earn, logging it takes just 3 seconds. Over time, Gastos builds powerful financial insights to help you save more.'
      ],
      steps: [
        '1. Record a Transaction: Tap the "+" button at the bottom center of the navigation bar.',
        '2. Select Type: Choose Expense (red), Income (green), or Transfer (blue).',
        '3. Enter Details: Input the amount, select the category, choose the account, and optionally add subcategories or notes.',
        '4. Save & View: Tap Save. Your account balance and home screen totals update instantly.',
        '5. Edit or Delete: Tap any transaction on the Home or Transaction List screen to modify or remove it.'
      ],
      tips: [
        'Use Transfers (not Expenses) when moving money between your own accounts (e.g. Bank to Cash) so your Net Worth calculation stays accurate without double-counting.'
      ]
    },
    {
      id: 'accounts',
      title: 'Account Management',
      icon: <Wallet size={20} color={Colors.primary[600]} />,
      isPremium: false,
      tagline: 'Keep track of Cash, Bank Accounts, Credit Cards, and UPI Wallets.',
      content: [
        'Gastos lets you organize your money into distinct accounts matching your real-life financial setup.',
        'Supported Account Types: Cash, Savings/Current Bank Account, Credit Card, UPI/E-Wallet, and Investment Accounts.'
      ],
      steps: [
        '1. Go to Settings → Manage Accounts.',
        '2. Tap "Add New Account". Enter the account name, type, and starting balance.',
        '3. Every time you log an expense or income, select the account used.',
        '4. Credit Cards: Set up a Credit Card account with a negative starting balance if you carry a bill, or 0 balance to track monthly spends.',
        '5. Transferring Money: Use the Transfer option on the Add screen to move funds (e.g. ATM withdrawal from Bank to Cash).'
      ],
      tips: [
        'Log all Credit Card purchases under your Credit Card account. Pay your bill by making a Transfer from your Bank account to your Credit Card account.'
      ]
    },
    {
      id: 'categories',
      title: 'Custom Categories & Subcategories',
      icon: <Tag size={20} color="#7C3AED" />,
      isPremium: false,
      tagline: 'Personalize categories to match your exact spending habits.',
      content: [
        'Organize your expenses with hierarchical Parent Categories and Subcategories for micro-level clarity.'
      ],
      steps: [
        '1. Go to Settings → Category Management.',
        '2. Add Parent Category: Choose a custom name, icon, and color.',
        '3. Add Subcategories: Tap any parent category to add sub-items (e.g. Food → Groceries, Dining Out, Snacks).',
        '4. Recurring Recharge Option: Mark categories like Mobile or DTH as "Recurring Recharge" to get automatic validity reminder prompts.'
      ],
      tips: [
        'Grouping transactions under detailed subcategories allows the Analytics module to show you exactly where small leaks occur in your budget.'
      ]
    },
    {
      id: 'budgets',
      title: 'Category Budgets',
      icon: <Target size={20} color="#059669" />,
      isPremium: false,
      tagline: 'Set monthly spending limits and get visual warnings before overspending.',
      content: [
        'Budgets help you enforce financial discipline by capping your monthly expenditure per category.'
      ],
      steps: [
        '1. Go to Settings → Category Budgets.',
        '2. Tap "Set Budget" next to any category and enter your target monthly limit.',
        '3. Monitor Progress: Progress bars change colors based on your spending level:',
        '   • Green (0% - 75%): Safe spending level.',
        '   • Orange (76% - 99%): Approaching monthly limit.',
        '   • Red (100%+): Budget exceeded warning.',
        '4. You will receive an automated alert when spending passes 80% and 100% of your set limit.'
      ],
      tips: [
        'Apply the 50/30/20 Rule: Allocate 50% of income to Needs (Rent, Utilities), 30% to Wants (Dining, Shopping), and 20% to Savings.'
      ]
    },
    {
      id: 'upcoming-bills',
      title: 'Upcoming Bills Manager',
      icon: <Calendar size={20} color={Colors.primary[600]} />,
      isPremium: true,
      tagline: 'Never miss utility bills, rent, or credit card dues.',
      content: [
        'The Bills Manager keeps an automated schedule of all fixed bills with proactive notification reminders.'
      ],
      steps: [
        '1. Open Bills Manager from the side menu or Home screen.',
        '2. Tap "Add Bill": Set name, amount, due date, account, and recurrence (Once, Weekly, Monthly, Yearly).',
        '3. Automated Reminders: Gastos schedules notification alerts 7 days, 3 days, 2 days, and 1 day before the due date.',
        '4. One-Tap Mark Paid: When you pay, tap the checkmark on the bill card. Gastos automatically logs the expense transaction and updates your account balance.'
      ],
      tips: [
        'Add your Credit Card bill payment date here with a 7-day reminder to avoid hefty late fees and interest charges.'
      ]
    },
    {
      id: 'scheduled-expenses',
      title: 'Scheduled Expenses & Auto-Run',
      icon: <Clock size={20} color="#7C3AED" />,
      isPremium: true,
      tagline: 'Automate fixed recurring payments like Rent, SIPs, and Subscriptions.',
      content: [
        'Scheduled Expenses allow Gastos to automatically log transactions in the background when the scheduled date arrives.'
      ],
      steps: [
        '1. Open Scheduled Expenses module.',
        '2. Tap "Add Scheduled Expense": Set amount, category, account, start date, and frequency.',
        '3. Auto-Run Setting:',
        '   • Auto-Run ON: Gastos automatically logs the transaction on the due date and notifies you.',
        '   • Auto-Run OFF: Gastos sends a notification prompt asking you to Approve or Reject the transaction.'
      ],
      tips: [
        'Schedule your monthly Mutual Fund SIPs or LIC premiums with Auto-Run ON so your financial records update automatically without manual intervention.'
      ]
    },
    {
      id: 'sinking-funds',
      title: 'Sinking Funds',
      icon: <PiggyBank size={20} color="#14B8A6" />,
      isPremium: true,
      tagline: 'Save gradually for predictable big future expenses.',
      content: [
        'A Sinking Fund helps you accumulate money over time for large upcoming costs (e.g., Annual Car Insurance, Festival Shopping, Holiday Trips) without taking a lump-sum hit.'
      ],
      steps: [
        '1. Navigate to Sinking Funds.',
        '2. Create Fund: Name your fund, enter the target amount needed, and select the deadline date.',
        '3. Auto Savings Calculation: Gastos automatically calculates the exact amount you need to save each month.',
        '4. Log Contributions: Whenever you set aside money, log a contribution to watch your progress bar fill up.'
      ],
      tips: [
        'Start a "Diwali/Festival" sinking fund in January with ₹1,000/month so you can shop stress-free in October.'
      ]
    },
    {
      id: 'future-calendar',
      title: 'Future Cash Flow Forecast',
      icon: <Sparkles size={20} color="#0BA5EC" />,
      isPremium: true,
      tagline: 'Project your running balance 30 days into the future.',
      content: [
        'The Future Forecast engine uses predictive algorithms to plot your future daily balance based on scheduled transactions, upcoming bills, and historical spending velocity.'
      ],
      steps: [
        '1. Open Cash Flow Calendar or Forecast tab.',
        '2. View 30-Day Line Chart: See how your net balance moves day by day over the next month.',
        '3. Cash Deficit Alert: If predicted expenses exceed your available balance on any upcoming date, the line turns red and warns you in advance.',
        '4. Plan ahead: Postpone non-essential purchases if the graph dips towards zero.'
      ],
      tips: [
        'Check your Future Forecast before planning major discretionary purchases to make sure you won\'t run short before payday.'
      ]
    },
    {
      id: 'tax-planner',
      title: 'Tax Planner & 80C Calculator',
      icon: <FileText size={20} color="#059669" />,
      isPremium: true,
      tagline: 'Estimate annual income tax under Old vs. New Regime and maximize deductions.',
      content: [
        'Compare income tax liabilities and track Section 80C, 80D, and HRA tax savings in real time.'
      ],
      steps: [
        '1. Open Tax Planner.',
        '2. Input Basic Income: Enter annual CTC, basic salary, HRA received, and rent paid.',
        '3. Log Tax Deductions: Record Section 80C investments (ELSS, PPF, EPF, LIC) up to ₹1.5 Lakh, 80D (Health Insurance), and NPS.',
        '4. Compare Regimes: Gastos displays side-by-side tax calculation charts for Old Regime vs New Regime, recommending the one that saves you more tax.'
      ],
      tips: [
        'Log 80C investments as you make them throughout the year so you know exactly how much space remains before the March deadline.'
      ]
    },
    {
      id: 'telegram-bot',
      title: 'Telegram AI Bot Integration',
      icon: <Send size={20} color="#0088CC" />,
      isPremium: false,
      tagline: 'Log transactions on the go using natural language Telegram messages.',
      content: [
        'Our Telegram Bot lets you record expenses without even opening the app. Simply text the bot, and your app syncs instantly.'
      ],
      steps: [
        '1. Go to Settings → Telegram Bot Integration.',
        '2. Tap "Connect Telegram Bot" to open our official bot on Telegram.',
        '3. Tap Start and copy your unique pairing key into the app.',
        '4. Send Messages: Text commands like "250 Coffee", "1200 Groceries", or "5000 Salary" directly to the bot.',
        '5. Instant Sync: The bot uses AI to parse the amount and category, automatically recording it in your Gastos database.'
      ],
      tips: [
        'Pin the Gastos Telegram bot to the top of your Telegram app for lightning-fast 2-second expense logging on the move.'
      ]
    },
    {
      id: 'debt-tracker',
      title: 'Debt & Credit Tracker (Udhar)',
      icon: <CreditCard size={20} color="#EF4444" />,
      isPremium: true,
      tagline: 'Track money you owe to others or money others owe you.',
      content: [
        'Keep clear records of personal loans, informal credit with friends, and money borrowed or lent.'
      ],
      steps: [
        '1. Open Debt Tracker.',
        '2. Choose Tab: "I Owe" (Debts/Liabilities) or "They Owe Me" (Credits/Assets).',
        '3. Add Record: Enter person/entity name, amount, interest rate (if any), and target due date.',
        '4. Record Repayments: Log partial or full repayments over time.',
        '5. Settlement: Tapping "Settle" completes the record and automatically creates a corresponding transaction in your chosen account.'
      ],
      tips: [
        'Track informal cash loans to friends here so you never forget who owes you money.'
      ]
    },
    {
      id: 'emi-tracker',
      title: 'EMI & Loan Tracker',
      icon: <Calendar size={20} color="#9C27B0" />,
      isPremium: true,
      tagline: 'Track home loans, car loans, and gadget EMIs with amortization schedules.',
      content: [
        'Manage long-term loans with clear installment breakdown and payoff dates.'
      ],
      steps: [
        '1. Open EMI Tracker.',
        '2. Add Loan: Enter total principal, interest rate, monthly EMI amount, total tenure (months), and start date.',
        '3. View Schedule: See the full installment schedule showing paid vs remaining EMIs.',
        '4. Enable Auto-Pay: Gastos can automatically deduct and log the monthly EMI on your due date.',
        '5. Prepayment/Closure: Log early partial prepayments to see how your loan tenure shrinks.'
      ],
      tips: [
        'Check the Total Interest tab to see how much extra you are paying over the life of the loan — a great motivator for pre-paying!'
      ]
    },
    {
      id: 'chit-funds',
      title: 'Chit Funds & Kitty Pools',
      icon: <Users size={20} color="#10B981" />,
      isPremium: true,
      tagline: 'Manage traditional monthly chit fund investments and pot winnings.',
      content: [
        'Track monthly chit contributions, dividend payouts, and pot claims.'
      ],
      steps: [
        '1. Open Chit Funds module.',
        '2. Add Chit: Enter chit name, total pot value, tenure (months), and monthly contribution amount.',
        '3. Monthly Log: Record your monthly installment payment.',
        '4. Claiming Pot: When you win the auction, mark the winning month and bid discount. Gastos credits the pot amount to your selected bank account.'
      ],
      tips: [
        'Use this to track residential apartment kitty pools or informal office monthly savings groups.'
      ]
    },
    {
      id: 'expense-book',
      title: 'Expense Book (Digital Khata)',
      icon: <BookOpen size={20} color={Colors.primary[600]} />,
      isPremium: false,
      tagline: 'Maintain traditional ledger books for trips, projects, or vendors.',
      content: [
        'Expense Books act as standalone ledgers to keep dedicated track of specific events or vendors separate from your main daily budget.'
      ],
      steps: [
        '1. Open Expense Book (Khata).',
        '2. Create Book: Name it (e.g., "Home Renovation", "Goa Trip", "Milkman Ledger").',
        '3. Log Entries: Add Credit (You paid) or Debit (Vendor/Other paid) entries with notes.',
        '4. View Running Total: See the net summary balance for that specific project at any time.'
      ],
      tips: [
        'Create a separate Expense Book for house construction or wedding planning to keep project costs strictly isolated.'
      ]
    },
    {
      id: 'bill-splitter',
      title: 'Group Bill Splitter',
      icon: <Users size={20} color="#0088CC" />,
      isPremium: false,
      tagline: 'Split restaurant bills, rent, and trip expenses with friends.',
      content: [
        'Calculates exact balances for shared group expenses and tells everyone who owes what to whom.'
      ],
      steps: [
        '1. Open Bill Splitter.',
        '2. Create Group: Name your group (e.g. "Flatmates", "Weekend Trip") and add member names.',
        '3. Add Shared Expense: Log who paid the bill and select how to split (Equal, Custom Amounts, or Percentage).',
        '4. View Settlement: Tap "Settle Up" to see the optimized payment instructions (e.g., "Rahul pays Priya ₹450").'
      ],
      tips: [
        'Gastos automatically calculates the minimum number of transactions needed to settle a large group bill.'
      ]
    },
    {
      id: 'subscriptions',
      title: 'Subscription Manager',
      icon: <RefreshCw size={20} color="#0BA5EC" />,
      isPremium: true,
      tagline: 'Track Netflix, Spotify, Gym, and SaaS recurring subscriptions.',
      content: [
        'Identify forgotten recurring subscriptions and get alerted before automatic renewals.'
      ],
      steps: [
        '1. Open Subscription Manager.',
        '2. Add Subscription: Enter service name, cost, renewal cycle (Monthly/Yearly), and next billing date.',
        '3. Renewal Alerts: Gastos alerts you 3 days before a subscription renews so you can cancel unused services.',
        '4. Total Overview: View your total monthly and annual outlay for all active subscriptions.'
      ],
      tips: [
        'Review your active subscriptions list once a month to prune unused services and save money instantly.'
      ]
    },
    {
      id: 'financial-report',
      title: 'Financial Reports & Analytics',
      icon: <PieChart size={20} color="#059669" />,
      isPremium: true,
      tagline: 'Deep visual breakdown of spending patterns, trends, and savings rate.',
      content: [
        'Gain complete clarity on where your money goes with multi-period reporting.'
      ],
      steps: [
        '1. Open Analytics & Reports screen.',
        '2. Select Timeframe: View Current Month, Last Month, Year-to-Date, or Custom Date Range.',
        '3. Category Pie Chart: Tap any category slice to drill down into subcategory breakdowns.',
        '4. Income vs Expense Bar Graph: Compare monthly earnings against monthly spending.',
        '5. Savings Rate %: Gastos calculates your net savings rate formula: (Income - Expense) / Income.'
      ],
      tips: [
        'Aim for a monthly savings rate of at least 20% to build your emergency fund and investment portfolio.'
      ]
    },
    {
      id: 'savings-goals',
      title: 'Savings Goals & Milestones',
      icon: <Target size={20} color="#E8917A" />,
      isPremium: true,
      tagline: 'Set targets for Emergency Funds, Vacations, or Gadgets.',
      content: [
        'Visual milestone tracking to turn long-term financial dreams into achievable monthly targets.'
      ],
      steps: [
        '1. Open Savings Goals.',
        '2. Create Goal: Enter goal title, target amount, and target completion date.',
        '3. Add Savings Deposit: Record money set aside towards this goal.',
        '4. Track Progress: Watch your progress percentage move towards 100% with milestone badges.'
      ],
      tips: [
        'Build your Emergency Fund goal first (equal to 6 months of living expenses) before saving for luxury items.'
      ]
    },
    {
      id: 'app-lock',
      title: 'App Security & Biometric Lock',
      icon: <ShieldCheck size={20} color={Colors.gray[800]} />,
      isPremium: false,
      tagline: 'Protect your financial data with PIN or Fingerprint / Face Unlock.',
      content: [
        'Keep your private financial logs safe from curious eyes.'
      ],
      steps: [
        '1. Go to Settings → App Lock & Security.',
        '2. Enable Security: Set a 4-digit Master Security PIN.',
        '3. Biometric Toggle: Turn ON Fingerprint / Face ID unlock for instant access.',
        '4. Auto-Lock Timeout: Choose when the app locks (Immediately, 1 min, 5 min, 15 min, 1 hr).'
      ],
      tips: [
        'Set timeout to "Immediately" so Gastos locks instantly whenever you switch apps.'
      ]
    },
    {
      id: 'cash-flow',
      title: 'Cash Flow Calendar View',
      icon: <CalendarClock size={20} color="#6366F1" />,
      isPremium: true,
      tagline: 'Calendar-based visual map of daily income and expense activity.',
      content: [
        'A monthly grid showing high-activity spending days at a glance.'
      ],
      steps: [
        '1. Open Cash Flow Calendar screen.',
        '2. Color Indicators: Days with income show green dots; days with expenses show red dots.',
        '3. Tap Any Date: View full itemized transaction list recorded on that specific date.',
        '4. Day Net Total: Displays net cash inflow or outflow for each individual day.'
      ],
      tips: [
        'Use the calendar to spot high-spending weekend clusters and balance them with low-spend weekdays.'
      ]
    },
    {
      id: 'backup-export',
      title: 'Data Backup, CSV Export & Restore',
      icon: <FileSpreadsheet size={20} color="#0284C7" />,
      isPremium: false,
      tagline: 'Export data to Excel or backup to JSON for device switching.',
      content: [
        'Your financial data is stored 100% locally on your phone. You own your data entirely.'
      ],
      steps: [
        '1. Go to Settings → Data Management.',
        '2. Export CSV: Exports transactions as an Excel-compatible CSV file for offline accounting.',
        '3. Backup JSON: Generates a complete database snapshot file containing all transactions, categories, and accounts.',
        '4. Restore Data: Tap "Restore from Backup" and select your previously saved JSON file to restore everything onto a new phone.'
      ],
      tips: [
        'Export a JSON backup once a month and email it to yourself so you never lose data if your phone is lost.'
      ]
    }
  ];

  const filteredSections = sections.filter((sec) => {
    const matchesTab = 
      activeTab === 'all' ? true :
      activeTab === 'free' ? !sec.isPremium :
      sec.isPremium;

    const query = searchQuery.toLowerCase().trim();
    if (!query) return matchesTab;

    const matchesTitle = sec.title.toLowerCase().includes(query);
    const matchesTagline = sec.tagline.toLowerCase().includes(query);
    const matchesContent = sec.content.some(c => c.toLowerCase().includes(query));
    const matchesSteps = sec.steps?.some(s => s.toLowerCase().includes(query));
    const matchesTips = sec.tips?.some(t => t.toLowerCase().includes(query));

    return matchesTab && (matchesTitle || matchesTagline || matchesContent || matchesSteps || matchesTips);
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & User Guide</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Certificate Card */}
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
              <View style={styles.certMiniPreview}>
                <Text style={styles.certMiniEmoji}>🏆</Text>
                <View style={styles.certMiniLine} />
                <Text style={styles.certMiniText} numberOfLines={1}>
                  {certUserName || 'Your Name'}
                </Text>
              </View>

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

                <View style={styles.certDownloadBtn}>
                  <Text style={styles.certDownloadBtnText}>View Certificate</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </Pressable>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.gray[400]} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search features, modules, tips..."
            placeholderTextColor={Colors.gray[400]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Category Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity 
            style={[styles.tabPill, activeTab === 'all' && styles.tabPillActive]} 
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>All ({sections.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabPill, activeTab === 'free' && styles.tabPillActive]} 
            onPress={() => setActiveTab('free')}
          >
            <Text style={[styles.tabText, activeTab === 'free' && styles.tabTextActive]}>🟢 Free ({sections.filter(s => !s.isPremium).length})</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabPill, activeTab === 'premium' && styles.tabPillActive]} 
            onPress={() => setActiveTab('premium')}
          >
            <Text style={[styles.tabText, activeTab === 'premium' && styles.tabTextActive]}>👑 Premium ({sections.filter(s => s.isPremium).length})</Text>
          </TouchableOpacity>
        </View>

        {/* Intro Banner */}
        <View style={styles.introCard}>
          <HelpCircle size={28} color={Colors.primary[600]} style={{ marginBottom: 8 }} />
          <Text style={styles.introTitle}>Gastos Complete User Manual</Text>
          <Text style={styles.introDesc}>
            Tap any feature below to expand complete step-by-step usage instructions and pro tips.
          </Text>
        </View>

        {/* Accordions */}
        {filteredSections.length === 0 ? (
          <View style={styles.emptySearchState}>
            <Text style={styles.emptySearchTitle}>No matching features found</Text>
            <Text style={styles.emptySearchSub}>Try searching with a different keyword like "EMI", "Budget", "Debt", or "Export".</Text>
          </View>
        ) : (
          filteredSections.map((section) => {
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
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.sectionTitleText}>{section.title}</Text>
                        {section.isPremium && (
                          <View style={styles.premiumBadge}>
                            <Sparkles size={8} color="#D97706" style={{ marginRight: 2 }} />
                            <Text style={styles.premiumBadgeText}>PREMIUM</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.sectionTagline} numberOfLines={1}>{section.tagline}</Text>
                    </View>
                  </View>
                  {isExpanded ? (
                    <ChevronUp size={20} color={Colors.gray[400]} />
                  ) : (
                    <ChevronDown size={20} color={Colors.gray[400]} />
                  )}
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.sectionContent}>
                    {/* Intro paragraphs */}
                    {section.content.map((paragraph, index) => (
                      <Text key={index} style={styles.contentText}>
                        {paragraph}
                      </Text>
                    ))}

                    {/* Step by step */}
                    {section.steps && section.steps.length > 0 && (
                      <View style={styles.stepsBox}>
                        <Text style={styles.stepsHeader}>📌 How to Use & Steps:</Text>
                        {section.steps.map((step, idx) => (
                          <Text key={idx} style={styles.stepText}>
                            {step}
                          </Text>
                        ))}
                      </View>
                    )}

                    {/* Pro Tips */}
                    {section.tips && section.tips.length > 0 && (
                      <View style={styles.tipsBox}>
                        <Text style={styles.tipsHeader}>💡 Pro Tip:</Text>
                        {section.tips.map((tip, idx) => (
                          <Text key={idx} style={styles.tipText}>
                            {tip}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* Support Banner Card */}
        <View style={styles.supportCard}>
          <View style={styles.supportHeaderRow}>
            <View style={styles.supportIconCircle}>
              <Mail size={22} color={Colors.primary[600]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supportTitle}>Need Help or Have Questions?</Text>
              <Text style={styles.supportSub}>Feel free to reach us anytime, anywhere — we respond fast!</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.supportBtn}
            activeOpacity={0.85}
            onPress={() => Linking.openURL('mailto:gastos.support@gmail.com?subject=Gastos%20App%20Support')}
          >
            <Mail size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.supportBtnText}>Email Support</Text>
          </TouchableOpacity>
        </View>

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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.gray[900],
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  tabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Layout.radius.full,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  tabPillActive: {
    backgroundColor: Colors.primary[600],
    borderColor: Colors.primary[600],
  },
  tabText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: Colors.gray[600],
  },
  tabTextActive: {
    color: Colors.white,
    fontFamily: Typography.family.bold,
  },
  introCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.xl,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gray[100],
    ...Layout.shadows.sm,
    marginBottom: 4,
  },
  introTitle: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 4,
  },
  introDesc: {
    fontSize: Typography.size.xs + 1,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
    textAlign: 'center',
    lineHeight: 18,
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
    padding: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.gray[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitleText: {
    fontSize: Typography.size.sm + 1,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  sectionTagline: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
    marginTop: 2,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Layout.radius.full,
    marginLeft: 6,
  },
  premiumBadgeText: {
    fontSize: 8,
    fontFamily: Typography.family.bold,
    color: '#D97706',
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
    paddingTop: 12,
  },
  contentText: {
    fontSize: Typography.size.xs + 1,
    fontFamily: Typography.family.regular,
    color: Colors.gray[700],
    lineHeight: 20,
    marginBottom: 8,
  },
  stepsBox: {
    backgroundColor: Colors.gray[50],
    borderRadius: Layout.radius.md,
    padding: 12,
    marginTop: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary[500],
  },
  stepsHeader: {
    fontSize: Typography.size.xs + 1,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 6,
  },
  stepText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.gray[700],
    lineHeight: 18,
    marginBottom: 4,
  },
  tipsBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: Layout.radius.md,
    padding: 12,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  tipsHeader: {
    fontSize: Typography.size.xs + 1,
    fontFamily: Typography.family.bold,
    color: '#B45309',
    marginBottom: 4,
  },
  tipText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: '#92400E',
    lineHeight: 18,
  },
  emptySearchState: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.lg,
    padding: 24,
    alignItems: 'center',
  },
  emptySearchTitle: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[800],
    marginBottom: 4,
  },
  emptySearchSub: {
    fontSize: Typography.size.xs + 1,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
    textAlign: 'center',
  },
  /* Certificate Card */
  certCard: {
    borderRadius: Layout.radius.xl,
    marginBottom: Layout.spacing.xs,
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
  /* Support Card */
  supportCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.xl,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.primary[100],
    ...Layout.shadows.sm,
  },
  supportHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  supportIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportTitle: {
    fontSize: Typography.size.sm + 1,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  supportSub: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
    marginTop: 2,
    lineHeight: 16,
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary[600],
    paddingVertical: 12,
    borderRadius: Layout.radius.md,
  },
  supportBtnText: {
    color: '#FFFFFF',
    fontFamily: Typography.family.bold,
    fontSize: Typography.size.sm,
  },
});
