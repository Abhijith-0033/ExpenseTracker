export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0, // Show no decimals for cleaner look, or 2 if precision is key. 
        // User requested Indian system "₹1,25,000". Default mimics this.
        // Let's stick to standard behavior but maybe allow optional decimals?
        // User example "₹1,000", "₹12,500". "₹10,00,000". 
        // Typically expense apps hide cents if 0, but show if present.
    }).format(amount);
};
