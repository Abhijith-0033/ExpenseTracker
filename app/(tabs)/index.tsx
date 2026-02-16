
import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, StatusBar, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/ui/Card';
// TransactionList removed as per UX update
import { Wallet, TrendingUp, TrendingDown, ArrowRight, BookOpen, Handshake, CornerRightUp } from 'lucide-react-native';
import { Colors, Layout } from '../../constants/Theme';
import { LinearGradient } from 'expo-linear-gradient';
import { formatCurrency } from '../../utils/currency';
import { getBooks } from '../../services/books';
import { getDebtSummary, DebtSummary } from '../../services/debts';
import { UpcomingExpenses } from '../../components/UpcomingExpenses';

export default function Dashboard() {
  const router = useRouter();
  const { accounts, transactions, refreshData } = useApp();
  const [refreshing, setRefreshing] = React.useState(false);

  // Dashboard Summaries State
  const [bookSummary, setBookSummary] = React.useState({ count: 0, total: 0 });
  const [debtSummary, setDebtSummary] = React.useState<DebtSummary>({ totalDebt: 0, totalReceivable: 0, netPosition: 0 });

  const fetchSummaries = async () => {
    try {
      const books = await getBooks();
      const booksTotal = books.reduce((sum, b) => sum + b.total_spent, 0);
      setBookSummary({ count: books.length, total: booksTotal });

      const debts = await getDebtSummary();
      setDebtSummary(debts);
    } catch (e) {
      console.error("Failed to fetch dashboard summaries", e);
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshData(), fetchSummaries()]);
    setRefreshing(false);
  }, [refreshData]);

  useFocusEffect(
    React.useCallback(() => {
      fetchSummaries();
    }, [])
  );

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const income = transactions.filter(t => t.category === 'Income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.category !== 'Income').reduce((s, t) => s + t.amount, 0);

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.gray[50]} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary[500]} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Overview</Text>
            <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          </View>
          <View style={styles.profilePlaceholder}>
            <Text style={styles.profileInitials}>ME</Text>
          </View>
        </View>

        {/* Main Balance Card */}
        <LinearGradient
          colors={[Colors.primary[600], Colors.primary[800]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceGradient}
        >
          <View style={styles.balanceContent}>
            <View>
              <Text style={styles.balanceLabel}>Total Balance</Text>
              <Text style={styles.balanceValue}>{formatCurrency(totalBalance)}</Text>
            </View>
            <View style={styles.balanceRight}>
              {/* Subtle decorative element */}
              <Wallet size={32} color="rgba(255,255,255,0.2)" />
            </View>
          </View>

          <View style={styles.flowRow}>
            <View style={styles.flowItem}>
              <View style={[styles.flowIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <TrendingUp size={16} color={Colors.white} />
              </View>
              <View>
                <Text style={styles.flowLabel}>Income</Text>
                <Text style={styles.flowValue}>{formatCurrency(income)}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.flowItem}>
              <View style={[styles.flowIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <TrendingDown size={16} color={Colors.white} />
              </View>
              <View>
                <Text style={styles.flowLabel}>Expenses</Text>
                <Text style={styles.flowValue}>{formatCurrency(expense)}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <UpcomingExpenses />

        <Text style={styles.sectionHeaderTitle}>Financial Modules</Text>

        {/* Expense Books Section - Full Width */}
        <TouchableOpacity
          style={styles.bookModuleCard}
          onPress={() => router.push('/books' as any)}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[Colors.primary[50], Colors.white]}
            style={styles.bookModuleGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.iconContainerPrimary}>
              <BookOpen size={24} color={Colors.primary[600]} />
            </View>
            <View style={styles.moduleContent}>
              <Text style={styles.moduleTitle}>Expense Books</Text>
              <Text style={styles.moduleSubtitle}>{bookSummary.count} Active Projects</Text>
            </View>
            <View style={styles.moduleRight}>
              <Text style={styles.moduleAmount}>{formatCurrency(bookSummary.total)}</Text>
              <Text style={styles.moduleLabel}>Total Tracked</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Debts & Receivables - Row Layout */}
        <View style={styles.debtRow}>
          {/* I Owe */}
          <TouchableOpacity
            style={styles.debtModuleCard}
            onPress={() => router.push('/debts?type=debt' as any)}
            activeOpacity={0.9}
          >
            <View style={[styles.iconContainer, { backgroundColor: Colors.danger[50] }]}>
              <TrendingDown size={24} color={Colors.danger[500]} />
            </View>
            <View style={styles.debtContent}>
              <Text style={styles.debtLabel}>I Owe</Text>
              <Text style={[styles.debtAmount, { color: Colors.danger[600] }]} numberOfLines={1}>
                {formatCurrency(debtSummary.totalDebt)}
              </Text>
            </View>
            <View style={styles.actionIcon}>
              <ArrowRight size={16} color={Colors.gray[400]} />
            </View>
          </TouchableOpacity>

          {/* They Owe */}
          <TouchableOpacity
            style={styles.debtModuleCard}
            onPress={() => router.push('/debts?type=receivable' as any)}
            activeOpacity={0.9}
          >
            <View style={[styles.iconContainer, { backgroundColor: Colors.success[50] }]}>
              <TrendingUp size={24} color={Colors.success[500]} />
            </View>
            <View style={styles.debtContent}>
              <Text style={styles.debtLabel}>They Owe</Text>
              <Text style={[styles.debtAmount, { color: Colors.success[600] }]} numberOfLines={1}>
                {formatCurrency(debtSummary.totalReceivable)}
              </Text>
            </View>
            <View style={styles.actionIcon}>
              <ArrowRight size={16} color={Colors.gray[400]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Accounts Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Accounts</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountsScroll}>
            {accounts.map((acc, index) => (
              <Card key={acc.id} style={[styles.accountCard, { marginLeft: index === 0 ? 0 : 12 }]}>
                <View style={styles.accountHeader}>
                  <View style={[styles.accIcon, { backgroundColor: Colors.primary[50] }]}>
                    <Wallet size={20} color={Colors.primary[500]} />
                  </View>
                  <Text style={styles.accountType}>{acc.type}</Text>
                </View>
                <Text style={styles.accountName} numberOfLines={1}>{acc.name}</Text>
                <Text style={styles.accountBalance}>{formatCurrency(acc.balance)}</Text>
              </Card>
            ))}
          </ScrollView>
        </View>

        {/* Spacer for bottom tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: Colors.gray[50],
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: Layout.spacing.md,
    paddingTop: 60, // Space for status bar
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Layout.spacing.lg,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.gray[900],
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 14,
    color: Colors.gray[500],
    marginTop: 4,
    fontWeight: '500',
  },
  profilePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  profileInitials: {
    color: Colors.primary[600],
    fontWeight: '700',
    fontSize: 14,
  },
  balanceGradient: {
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.xl,
    ...Layout.shadows.lg,
    marginBottom: Layout.spacing.xl,
  },
  balanceContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  balanceRight: {
    justifyContent: 'center',
  },
  balanceLabel: {
    color: Colors.primary[100],
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  balanceValue: {
    color: Colors.white,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  flowRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: Layout.radius.lg,
    padding: 12,
  },
  flowItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 16,
  },
  flowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  flowLabel: {
    color: Colors.primary[100],
    fontSize: 12,
    fontWeight: '500',
  },
  flowValue: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[500],
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Book Module
  bookModuleCard: {
    marginBottom: 16,
    borderRadius: Layout.radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    ...Layout.shadows.sm,
  },
  bookModuleGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainerPrimary: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  moduleContent: {
    flex: 1,
  },
  moduleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  moduleSubtitle: {
    fontSize: 14,
    color: Colors.gray[500],
  },
  moduleRight: {
    alignItems: 'flex-end',
  },
  moduleAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary[700],
  },
  moduleLabel: {
    fontSize: 12,
    color: Colors.gray[400],
  },
  // Debt Modules
  debtRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: Layout.spacing.xl,
  },
  debtModuleCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Layout.radius.xl,
    padding: 16,
    ...Layout.shadows.sm,
    justifyContent: 'space-between',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  debtContent: {
    marginBottom: 8,
  },
  debtLabel: {
    fontSize: 14,
    color: Colors.gray[500],
    marginBottom: 4,
  },
  debtAmount: {
    fontSize: 20,
    fontWeight: '800',
  },
  actionIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  section: {
    marginTop: 0,
    marginBottom: Layout.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Layout.spacing.md,
    paddingHorizontal: Layout.spacing.xs,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  accountsScroll: {
    paddingRight: 20,
    paddingBottom: 10, // Shadow space
  },
  accountCard: {
    width: 150,
    height: 140,
    padding: 16,
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 20,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  accIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountType: {
    fontSize: 11,
    color: Colors.gray[400],
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.gray[700],
    marginTop: 12,
  },
  accountBalance: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.gray[900],
  },
});
