import { getDatabase, initDatabase, SavingsGoal, SavingsContribution } from './database';
export { SavingsGoal, SavingsContribution };
import { differenceInWeeks } from 'date-fns';

const ensureDb = async () => {
    const db = getDatabase();
    if (!db) {
        await initDatabase();
        return getDatabase();
    }
    return db;
};

export const addGoal = async (name: string, targetAmount: number, deadline: string, linkedAccountId: number | null, icon: string = '🎯', color: string = '#6941C6') => {
    const db = await ensureDb();
    const timestamp = Date.now();
    const result = await db.runAsync(
        'INSERT INTO savings_goals (name, target_amount, current_amount, deadline, linked_account_id, icon, color, created_at, last_updated, is_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [name, targetAmount, 0, deadline, linkedAccountId, icon, color, timestamp, timestamp, 0]
    );
    return result.lastInsertRowId;
};

export const getGoals = async (): Promise<SavingsGoal[]> => {
    const db = await ensureDb();
    return await db.getAllAsync<SavingsGoal>('SELECT * FROM savings_goals WHERE is_completed = 0 ORDER BY deadline ASC');
};

export const getCompletedGoals = async (): Promise<SavingsGoal[]> => {
    const db = await ensureDb();
    return await db.getAllAsync<SavingsGoal>('SELECT * FROM savings_goals WHERE is_completed = 1 ORDER BY last_updated DESC');
};

export const getGoalById = async (id: number): Promise<SavingsGoal | null> => {
    const db = await ensureDb();
    return await db.getFirstAsync<SavingsGoal>('SELECT * FROM savings_goals WHERE id = ?', [id]);
};

export const updateGoal = async (id: number, updates: Partial<SavingsGoal>) => {
    const db = await ensureDb();
    const timestamp = Date.now();
    
    const fields = [];
    const values = [];
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.target_amount !== undefined) { fields.push('target_amount = ?'); values.push(updates.target_amount); }
    if (updates.deadline !== undefined) { fields.push('deadline = ?'); values.push(updates.deadline); }
    if (updates.linked_account_id !== undefined) { fields.push('linked_account_id = ?'); values.push(updates.linked_account_id); }
    if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon); }
    if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color); }
    
    if (fields.length === 0) return;
    
    fields.push('last_updated = ?');
    values.push(timestamp);
    values.push(id);
    
    await db.runAsync(`UPDATE savings_goals SET ${fields.join(', ')} WHERE id = ?`, values);
};

export const deleteGoal = async (id: number) => {
    const db = await ensureDb();
    await db.runAsync('DELETE FROM savings_goals WHERE id = ?', [id]);
};

export const addContribution = async (goalId: number, amount: number, notes: string = '', autoDetected: boolean = false) => {
    const db = await ensureDb();
    const timestamp = Date.now();
    
    await db.withTransactionAsync(async () => {
        // Add contribution
        await db.runAsync(
            'INSERT INTO savings_contributions (goal_id, amount, date, notes, auto_detected, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [goalId, amount, new Date().toISOString(), notes, autoDetected ? 1 : 0, timestamp]
        );
        
        // Update goal current amount
        const goal = await db.getFirstAsync<SavingsGoal>('SELECT * FROM savings_goals WHERE id = ?', [goalId]);
        if (goal) {
            const newAmount = goal.current_amount + amount;
            const isComplete = newAmount >= goal.target_amount ? 1 : 0;
            await db.runAsync(
                'UPDATE savings_goals SET current_amount = ?, is_completed = ?, last_updated = ? WHERE id = ?',
                [newAmount, isComplete, timestamp, goalId]
            );
        }
    });
};

export const updateContribution = async (id: number, amount: number, notes: string = '') => {
    const db = await ensureDb();
    const timestamp = Date.now();

    await db.withTransactionAsync(async () => {
        const contribution = await db.getFirstAsync<SavingsContribution>(
            'SELECT * FROM savings_contributions WHERE id = ?',
            [id]
        );
        if (!contribution) throw new Error('Contribution not found');

        await db.runAsync(
            'UPDATE savings_contributions SET amount = ?, notes = ? WHERE id = ?',
            [amount, notes, id]
        );

        const goal = await db.getFirstAsync<SavingsGoal>('SELECT * FROM savings_goals WHERE id = ?', [contribution.goal_id]);
        if (goal) {
            const newAmount = goal.current_amount - contribution.amount + amount;
            const isComplete = newAmount >= goal.target_amount ? 1 : 0;
            await db.runAsync(
                'UPDATE savings_goals SET current_amount = ?, is_completed = ?, last_updated = ? WHERE id = ?',
                [newAmount, isComplete, timestamp, contribution.goal_id]
            );
        }
    });
};

export const deleteContribution = async (id: number) => {
    const db = await ensureDb();
    const timestamp = Date.now();

    await db.withTransactionAsync(async () => {
        const contribution = await db.getFirstAsync<SavingsContribution>(
            'SELECT * FROM savings_contributions WHERE id = ?',
            [id]
        );
        if (!contribution) return;

        await db.runAsync('DELETE FROM savings_contributions WHERE id = ?', [id]);

        const goal = await db.getFirstAsync<SavingsGoal>('SELECT * FROM savings_goals WHERE id = ?', [contribution.goal_id]);
        if (goal) {
            const newAmount = Math.max(goal.current_amount - contribution.amount, 0);
            const isComplete = newAmount >= goal.target_amount ? 1 : 0;
            await db.runAsync(
                'UPDATE savings_goals SET current_amount = ?, is_completed = ?, last_updated = ? WHERE id = ?',
                [newAmount, isComplete, timestamp, contribution.goal_id]
            );
        }
    });
};

export const getContributions = async (goalId: number): Promise<SavingsContribution[]> => {
    const db = await ensureDb();
    return await db.getAllAsync<SavingsContribution>('SELECT * FROM savings_contributions WHERE goal_id = ? ORDER BY date DESC', [goalId]);
};

export const calculateWeeklyTarget = (goal: SavingsGoal): number => {
    const weeksLeft = differenceInWeeks(new Date(goal.deadline), new Date());
    if (weeksLeft > 0) {
        const remaining = goal.target_amount - goal.current_amount;
        return remaining > 0 ? remaining / weeksLeft : 0;
    }
    return 0; // Past deadline or due immediately
};

export const getGoalProgress = (goal: SavingsGoal): number => {
    if (goal.target_amount <= 0) return 0;
    return Math.min(Math.max(goal.current_amount / goal.target_amount, 0), 1);
};
