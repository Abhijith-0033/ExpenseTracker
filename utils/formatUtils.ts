import { Colors, SemanticColors } from '../constants/Theme';

export function formatCurrency(amount: number): string {
    if (isNaN(amount) || amount === null) return '₹0.00';
    return `₹${amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

export function formatAmount(amount: number, type: 'expense' | 'income' | 'transfer' | 'neutral'): string {
    const formatted = formatCurrency(Math.abs(amount));
    if (type === 'expense') return `-${formatted}`;
    if (type === 'income') return `+${formatted}`;
    return formatted; // transfer or neutral
}

export function getAmountColor(type: 'expense' | 'income' | 'transfer' | 'neutral'): string {
    switch (type) {
        case 'expense': return SemanticColors.expense;
        case 'income': return SemanticColors.income;
        case 'transfer': return SemanticColors.transfer;
        default: return Colors.gray[900];
    }
}

export function formatPercentage(value: number, decimals: number = 1): string {
    if (isNaN(value) || value === null) return '0%';
    return `${value.toFixed(decimals)}%`;
}

export function truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

export function formatRelativeTime(dateInput: string | Date | number): string {
    const date = new Date(dateInput);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatMonthYear(dateInput: string | Date | number): string {
    return new Date(dateInput).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function formatShortDate(dateInput: string | Date | number): string {
    return new Date(dateInput).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}
