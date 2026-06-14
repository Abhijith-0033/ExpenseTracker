/**
 * Utility functions for safe mathematical operations and financial formulas.
 */

/**
 * Safely divides two numbers, guarding against division by zero and returning a fallback value.
 * @param numerator The number to be divided
 * @param denominator The number to divide by
 * @param fallback The value to return if denominator is 0, null, or undefined. Default is 0.
 * @returns Result of division or fallback.
 */
export function safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
    if (!denominator || denominator === 0 || isNaN(denominator)) {
        return fallback;
    }
    const result = numerator / denominator;
    return isNaN(result) ? fallback : result;
}

/**
 * Clamps a value between a minimum and maximum.
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Safely rounds a number to the specified number of decimal places.
 */
export function roundToDecimal(value: number, decimals: number = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

/**
 * Calculates exact EMI using standard amortization formula.
 * @param principal Loan principal amount
 * @param annualRate Annual interest rate in percentage (e.g., 12 for 12%)
 * @param tenureMonths Total duration in months
 * @returns Monthly EMI amount
 */
export function calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
    if (principal <= 0 || tenureMonths <= 0) return 0;
    if (annualRate === 0) return roundToDecimal(principal / tenureMonths);
    
    const r = annualRate / 100 / 12;
    const n = tenureMonths;
    const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    
    return roundToDecimal(emi);
}

/**
 * Calculates compound interest.
 * @param P Principal amount
 * @param r Annual interest rate in percentage (e.g., 12 for 12%)
 * @param n Number of times interest is compounded per year
 * @param t Time in years
 * @returns Total amount due (Principal + Interest)
 */
export function calculateCompoundInterest(P: number, r: number, n: number, t: number): number {
    if (P <= 0 || t < 0) return P;
    const rateDecimal = r / 100;
    const amount = P * Math.pow((1 + rateDecimal / n), n * t);
    return roundToDecimal(amount);
}

/**
 * Calculates simple interest.
 * @param P Principal amount
 * @param r Annual interest rate in percentage (e.g., 12 for 12%)
 * @param t Time in years
 * @returns Total amount due (Principal + Interest)
 */
export function calculateSimpleInterest(P: number, r: number, t: number): number {
    if (P <= 0 || t < 0) return P;
    const rateDecimal = r / 100;
    const amount = P * (1 + rateDecimal * t);
    return roundToDecimal(amount);
}
