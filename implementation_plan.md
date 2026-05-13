# Goal Description

The objective is to fix several issues in the Expense Tracker application based on user feedback:
1. Exclude 'Debt/Credit' transactions from 'Total Expense' calculations across the app (Dashboard, Analytics).
2. Add account selection when creating a new Debt/Credit (Add Person) and correctly affect the selected account's balance and transaction history.
3. Add 'Edit' functionality to Savings Goals. (Note: Subscriptions already have edit functionality).
4. Display the total amount in the Category Insights (Breakdown) list.
5. Improve the visibility of graph values in the Analytics screen.

## User Review Required

- **Subscriptions Edit**: The app already supports editing Subscriptions (via long-press or tap -> Edit). No further changes are planned for Subscriptions unless you specify otherwise. Is this acceptable?
- **Total in Category Insights**: The plan will add a "Total Expenses: ₹XXX" summary row at the bottom of the Category Breakdown list.

## Open Questions

- None at the moment. Please review the proposed changes below.

## Proposed Changes

### Database & Services

#### [MODIFY] services/database.ts
- Update the `Transaction` interface to include `debt` as a type: `type?: 'expense' | 'income' | 'transfer' | 'debt';`
- In `getTransactions()`, update the mapping logic so `t.category === 'Debt/Credit'` is mapped to `'debt'` instead of `'expense'`.
- Update `addDebtPerson()` to accept an optional `accountId: number`.
- Inside `addDebtPerson()`, if `initialAmount > 0` and `accountId` is provided, update the account balance (increase/decrease based on `isDebt`) and insert a 'Debt/Credit' transaction into the `transactions` table (similar to `updateDebtAmount`).

#### [MODIFY] services/analysis.ts
- Exclude 'Debt/Credit' from all expense calculation queries. Add `AND category != 'Debt/Credit'` to the `WHERE` clauses in:
  - `getCategoryTotals`
  - `getExpenseDistribution`
  - `getMonthlyCategoryTrend`
  - `getMonthlyTrendInRange`
  - `getDailyIncomeExpense`, `getWeeklyIncomeExpense`, `getMonthlyIncomeExpense`, `getYearlyIncomeExpense`
- For `getMonthlyIncomeVsExpense`, `getDailySpendingTrend`, `getWeeklySpendingTrend`, `getMonthlySpendingTrend`, ensure `category != 'Transfer' AND category != 'Debt/Credit'` is present so debts are not counted as expenses.

#### [MODIFY] services/savingsGoals.ts
- Add a new function `updateGoal(id: number, name: string, target_amount: number, deadline: string)` to update an existing savings goal.

---

### UI Components & Screens

#### [MODIFY] app/debts/index.tsx
- Add `accounts` state and fetch them in `fetchData()`.
- Add an `AccountSelector` UI in the "Add Person" Modal, matching the one in `[id].tsx`.
- Pass the `selectedAccountId` to `addDebtPerson()`.

#### [MODIFY] app/savings-goals.tsx
- Add an `editingGoal` state.
- Add an "Edit" button (pencil icon) to the header of each `goalCard`.
- When "Edit" is pressed, populate the form states (`newName`, `newTarget`, `newDeadline`) and show the `showAddModal`.
- Update `handleAddGoal` to conditionally call `addGoal` or `updateGoal` based on the `editingGoal` state.

#### [MODIFY] components/CategoryBreakdownList.tsx
- Add a total summary row at the bottom of the list displaying the sum of all categories.

#### [MODIFY] app/(tabs)/analytics.tsx
- Pass the calculated `totalExpense` to `CategoryBreakdownList`.

#### [MODIFY] components/AnalysisCharts.tsx
- Improve chart label visibility:
  - `WeeklyBarChart`: Increase `topLabelComponent` font size from 9 to 11 and set `fontWeight: 'bold'`, color to `Colors.gray[700]`.
  - `ExpenseHistogram`: Increase `topLabel` font size and weight.
  - `TrendLineChart` & `IncomeExpenseLineChart`: Adjust `textFontSize`, `textShiftY`, and `textColor` to ensure text doesn't overlap and is readable against the background. Add a small background to text if needed.

## Verification Plan

### Automated/Manual Tests
1. **Total Expense Calculation**: Add a new Debt transaction. Verify that the Dashboard "This Month's Spending" (Expense) and Analytics "Total Expense" do not increase.
2. **Debt Account Linkage**: Add a new Debt Person with an initial amount and select an account. Verify that the selected account balance correctly increases/decreases, and a new transaction appears in the Dashboard list.
3. **Savings Goal Edit**: Navigate to Savings Goals, click the edit icon on an existing goal, change the target amount, and verify the changes save correctly.
4. **Analytics Visuals**: Navigate to the Analytics tab. Verify the total amount is visible at the bottom of the Category Breakdown list, and check the charts for improved label readability.
