import { format } from 'date-fns';
import { getMonthlyIncomeExpense, getCategoryTotals } from './analysis';
import { SatisfactionEngine } from '../satisfaction/SatisfactionEngine';
import { getAccounts } from './database';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export interface MonthlyReport {
    monthStr: string; // e.g. "August 2026"
    incomeTotal: number;
    expenseTotal: number;
    savingsRate: number;
    satisfactionScore: number;
    categoryBreakdown: { category: string, total: number }[];
    monthOverMonth: {
        incomeChange: number; // percentage
        expenseChange: number; // percentage
    };
    accountBalances: { name: string, balance: number }[];
}

export const generateMonthlyReportData = async (month: Date): Promise<MonthlyReport> => {
    const monthStr = format(month, 'MMMM yyyy');
    
    const [
        currentMonthStats, 
        prevMonthStats, 
        catTotals,
        satisfaction, 
        accounts
    ] = await Promise.all([
        getMonthlyIncomeExpense(month),
        getMonthlyIncomeExpense(new Date(month.getFullYear(), month.getMonth() - 1, 1)),
        getCategoryTotals(month),
        SatisfactionEngine.compute('month'), // Ensure the engine uses the passed month if we modified it to accept date
        getAccounts()
    ]);
    
    const incomeChange = prevMonthStats.income > 0 
        ? ((currentMonthStats.income - prevMonthStats.income) / prevMonthStats.income) * 100 
        : 100;
        
    const expenseChange = prevMonthStats.expense > 0 
        ? ((currentMonthStats.expense - prevMonthStats.expense) / prevMonthStats.expense) * 100 
        : 100;

    const savingsRate = currentMonthStats.income > 0 
        ? ((currentMonthStats.income - currentMonthStats.expense) / currentMonthStats.income) * 100 
        : 0;

    return {
        monthStr,
        incomeTotal: currentMonthStats.income,
        expenseTotal: currentMonthStats.expense,
        savingsRate,
        satisfactionScore: satisfaction.finalScore,
        categoryBreakdown: catTotals,
        monthOverMonth: { incomeChange, expenseChange },
        accountBalances: accounts
    };
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

export const generateReportHTML = (report: MonthlyReport): string => {
    const { monthStr, incomeTotal, expenseTotal, savingsRate, satisfactionScore, categoryBreakdown, monthOverMonth, accountBalances } = report;
    
    const coral = '#E8917A';
    const mint = '#D6F0E0';
    const rose = '#FCE4EC';
    const textMain = '#1A1A2E';
    const textSec = '#737370';

    const renderCatRows = () => categoryBreakdown.map(c => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #EAEAE7; color: ${textMain};">${c.category}</td>
            <td style="padding: 12px; border-bottom: 1px solid #EAEAE7; text-align: right; color: ${textMain}; font-weight: bold;">${formatCurrency(c.total)}</td>
        </tr>
    `).join('');

    const renderAccountRows = () => accountBalances.map(a => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #EAEAE7; color: ${textMain};">${a.name}</td>
            <td style="padding: 12px; border-bottom: 1px solid #EAEAE7; text-align: right; color: ${textMain}; font-weight: bold;">${formatCurrency(a.balance)}</td>
        </tr>
    `).join('');

    return `
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
            @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
            body { font-family: 'DM Sans', sans-serif; background-color: #FAFAF8; padding: 40px; margin: 0; color: ${textMain}; }
            .header { text-align: center; margin-bottom: 40px; }
            .title { font-size: 32px; font-weight: bold; margin: 0; color: ${coral}; }
            .subtitle { font-size: 18px; color: ${textSec}; margin-top: 8px; }
            .grid { display: flex; gap: 20px; margin-bottom: 40px; }
            .card { flex: 1; padding: 24px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .card-title { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0; }
            .card-val { font-size: 28px; font-weight: bold; margin: 0; }
            .card-sub { font-size: 14px; margin-top: 8px; }
            .section-title { font-size: 20px; font-weight: bold; margin-bottom: 16px; margin-top: 40px; border-bottom: 2px solid ${coral}; padding-bottom: 8px; display: inline-block; }
            table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
            th { text-align: left; padding: 16px 12px; background: #EAEAE7; font-weight: bold; font-size: 14px; text-transform: uppercase; color: ${textSec}; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1 class="title">Gastos Financial Report</h1>
            <p class="subtitle">${monthStr}</p>
        </div>

        <div class="grid">
            <div class="card" style="background-color: ${mint};">
                <p class="card-title" style="color: #265E3F;">Total Income</p>
                <p class="card-val" style="color: #0C2618;">${formatCurrency(incomeTotal)}</p>
                <p class="card-sub" style="color: #377A55;">${monthOverMonth.incomeChange > 0 ? '↑' : '↓'} ${Math.abs(monthOverMonth.incomeChange).toFixed(1)}% vs last month</p>
            </div>
            <div class="card" style="background-color: ${rose};">
                <p class="card-title" style="color: #8F2626;">Total Expense</p>
                <p class="card-val" style="color: #420C0C;">${formatCurrency(expenseTotal)}</p>
                <p class="card-sub" style="color: #B53737;">${monthOverMonth.expenseChange > 0 ? '↑' : '↓'} ${Math.abs(monthOverMonth.expenseChange).toFixed(1)}% vs last month</p>
            </div>
        </div>

        <div class="grid" style="margin-top: 20px;">
            <div class="card" style="background-color: white;">
                <p class="card-title" style="color: ${textSec};">Savings Rate</p>
                <p class="card-val">${savingsRate.toFixed(1)}%</p>
            </div>
            <div class="card" style="background-color: white;">
                <p class="card-title" style="color: ${textSec};">Health Score</p>
                <p class="card-val">${satisfactionScore}/100</p>
            </div>
        </div>

        <h2 class="section-title">Spending by Category</h2>
        <table>
            <thead>
                <tr><th>Category</th><th style="text-align: right;">Amount</th></tr>
            </thead>
            <tbody>
                ${renderCatRows()}
            </tbody>
        </table>

        <h2 class="section-title">End of Month Balances</h2>
        <table>
            <thead>
                <tr><th>Account</th><th style="text-align: right;">Balance</th></tr>
            </thead>
            <tbody>
                ${renderAccountRows()}
            </tbody>
        </table>

        <div style="margin-top: 60px; text-align: center; color: ${textSec}; font-size: 12px;">
            <p>Generated by Gastos Expense Tracker on ${new Date().toLocaleDateString()}</p>
        </div>
    </body>
    </html>
    `;
};

export const exportReportAsPDF = async (month: Date) => {
    try {
        const report = await generateMonthlyReportData(month);
        const html = generateReportHTML(report);
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        }
    } catch (e) {
        console.error("PDF export failed", e);
        throw e;
    }
};
