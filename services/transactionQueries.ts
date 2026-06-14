import { executeQuery } from '../utils/dbUtils';

export interface TelegramTx {
    amount: number;
    category: string;
    date: string;
    description: string;
}

export const getRecentTelegramTransactions = async (limit: number = 5): Promise<TelegramTx[]> => {
    return executeQuery<TelegramTx>(
        `SELECT t.amount, t.category, t.date, t.description
         FROM transactions t
         WHERE t.source = 'telegram'
         ORDER BY t.created_at DESC
         LIMIT ?`,
        [limit]
    );
};
