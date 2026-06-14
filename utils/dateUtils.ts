import { format, parse, isValid, addMonths as dateFnsAddMonths, startOfMonth, endOfMonth, isSameDay as dateFnsIsSameDay, differenceInDays } from 'date-fns';

/**
 * Parses a string into a Date object safely.
 */
export function parseDate(dateString: string | null | undefined): Date | null {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (!isValid(date) || isNaN(date.getTime())) {
        return null;
    }
    return date;
}

/**
 * Returns a consistent formatted date display.
 */
export function formatDate(dateInput: string | Date | number, formatStr: string = 'dd MMM yyyy'): string {
    const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (!isValid(date)) return '';
    return format(date, formatStr);
}

/**
 * Calculates days between two dates.
 */
export function daysBetween(date1: Date | string, date2: Date | string): number {
    const d1 = typeof date1 === 'string' ? parseDate(date1) : date1;
    const d2 = typeof date2 === 'string' ? parseDate(date2) : date2;
    if (!d1 || !d2) return 0;
    return differenceInDays(d1, d2);
}

/**
 * Safe month arithmetic (avoids month-end leap errors).
 */
export function addMonths(dateInput: Date | string, months: number): Date {
    const date = typeof dateInput === 'string' ? parseDate(dateInput) || new Date() : dateInput;
    
    // Explicit logic as requested:
    // This handles month-end correctly.
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() < day) d.setDate(0);
    return d;
}

/**
 * Safe day arithmetic.
 */
export function addDays(dateInput: Date | string, days: number): Date {
    const d = typeof dateInput === 'string' ? parseDate(dateInput) || new Date() : new Date(dateInput);
    d.setDate(d.getDate() + days);
    return d;
}

export function isSameDay(date1: Date | string, date2: Date | string): boolean {
    const d1 = typeof date1 === 'string' ? parseDate(date1) : date1;
    const d2 = typeof date2 === 'string' ? parseDate(date2) : date2;
    if (!d1 || !d2) return false;
    return dateFnsIsSameDay(d1, d2);
}

export { startOfMonth, endOfMonth };

export function getWeekRange(dateInput: Date | string): { start: Date, end: Date } {
    const date = typeof dateInput === 'string' ? parseDate(dateInput) || new Date() : new Date(dateInput);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
    const start = new Date(date.setDate(diff));
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23,59,59,999);
    return { start, end };
}
