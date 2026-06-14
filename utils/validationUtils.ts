/**
 * Validation utilities for forms and models.
 */

export function isValidAmount(value: any): boolean {
    if (value === null || value === undefined) return false;
    const num = Number(value);
    return !isNaN(num) && num > 0;
}

export function isValidDate(dateString: string | null | undefined): boolean {
    if (!dateString) return false;
    const d = new Date(dateString);
    return !isNaN(d.getTime());
}

export function isValidEmail(email: string): boolean {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

export function isNotEmpty(value: string | null | undefined): boolean {
    if (value === null || value === undefined) return false;
    return value.trim().length > 0;
}

export interface TransactionForm {
    amount: number;
    categoryId: string;
    accountId: number | null;
    date: Date | string;
}

export function validateTransaction(form: TransactionForm): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!isValidAmount(form.amount)) {
        errors.amount = 'Amount must be greater than 0';
    }
    if (!isNotEmpty(form.categoryId)) {
        errors.categoryId = 'Category is required';
    }
    if (!form.accountId) {
        errors.accountId = 'Account is required';
    }
    if (!isValidDate(form.date as string)) {
        errors.date = 'Valid date is required';
    }
    return errors;
}
