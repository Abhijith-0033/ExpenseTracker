import { Colors } from '../constants/Theme';

export function formatAmount(amount: number, type?: 'expense' | 'income' | 'transfer' | 'balance') {
  const absAmount = Math.abs(amount);
  // Use Indian locale formatting
  const formatted = '₹' + absAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  
  let prefix = '';
  let color = Colors.gray[900]; // Default to deep navy heading color
  
  if (type === 'expense') {
    prefix = '- ';
    color = '#F04438';
  } else if (type === 'income') {
    prefix = '+ ';
    color = '#12B76A';
  } else if (type === 'transfer') {
    prefix = '↔ ';
    color = '#0BA5EC';
  } else if (type === 'balance') {
    color = amount > 0 ? '#12B76A' : amount < 0 ? '#F04438' : Colors.gray[400];
  }
  
  return { text: prefix + formatted, color };
}
