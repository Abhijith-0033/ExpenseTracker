import { Debt, getDebts, getDebtHistory } from './database';

export interface DebtSummary {
    totalDebt: number;
    totalReceivable: number;
    netPosition: number;
}

export interface DebtDistribution {
    name: string;
    amount: number;
    color: string;
}

export const getDebtSummary = async (): Promise<DebtSummary> => {
    const all = await getDebts();
    const totalDebt = all.filter(d => d.type === 'debt').reduce((sum, d) => sum + d.amount, 0);
    const totalReceivable = all.filter(d => d.type === 'receivable').reduce((sum, d) => sum + d.amount, 0);

    return {
        totalDebt,
        totalReceivable,
        netPosition: totalReceivable - totalDebt
    };
};

export const getTopDebtors = async (limit: number = 5) => {
    const all = await getDebts();
    return all.sort((a, b) => b.amount - a.amount).slice(0, limit);
};

export const getDebtTrend = async (months: number = 6) => {
    // This would require more complex querying of history, 
    // for now we can render current snapshot or implement if history allows reconstruction.
    // Placeholder for advanced trend logic.
    return [];
};
