import { getDatabase } from '../services/database';

/**
 * Utility wrapper for SQLite operations providing standardized error handling,
 * parameterization enforcement, and logging context.
 */

export async function executeQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
    const db = getDatabase();
    try {
        // Enforce parameterization - warn if inline variables are detected (rough check)
        if (sql.includes('${') && !sql.includes('?')) {
            console.warn(`[SECURITY WARNING] Potential SQL injection in query: ${sql}`);
        }
        
        return await db.getAllAsync<T>(sql, params);
    } catch (error) {
        console.error(`[DB ERROR] Query execution failed: ${sql}`, error, params);
        throw new Error(`Database error executing query. See logs for details.`);
    }
}

export async function executeFirst<T>(sql: string, params: any[] = []): Promise<T | null> {
    const db = getDatabase();
    try {
        return await db.getFirstAsync<T>(sql, params);
    } catch (error) {
        console.error(`[DB ERROR] Query (first) execution failed: ${sql}`, error, params);
        throw new Error(`Database error executing query. See logs for details.`);
    }
}

export async function executeRun(sql: string, params: any[] = []): Promise<number> {
    const db = getDatabase();
    try {
        const result = await db.runAsync(sql, params);
        return result.lastInsertRowId;
    } catch (error) {
        console.error(`[DB ERROR] Run execution failed: ${sql}`, error, params);
        throw new Error(`Database error executing run. See logs for details.`);
    }
}

export async function executeTransaction(operations: (() => Promise<void>)[]): Promise<void> {
    const db = getDatabase();
    try {
        await db.withTransactionAsync(async () => {
            for (const op of operations) {
                await op();
            }
        });
    } catch (error) {
        console.error(`[DB ERROR] Transaction failed`, error);
        throw new Error(`Database transaction failed. See logs for details.`);
    }
}
