// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAX ENGINE — India FY 2025-26 / AY 2026-27
// UPDATE THESE SLABS ANNUALLY AFTER EACH UNION BUDGET
// Last updated: June 2026
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface TaxProfile {
  id?: number;
  financial_year: string;       // e.g. "2025-26"
  annual_income: number;
  is_salaried: number;          // 1 | 0
  tax_regime: 'new' | 'old';
  age_category: 'below60' | '60to80' | 'above80';
  hra_received: number;
  rent_paid: number;
  is_metro_city: number;        // 1 | 0
  basic_salary: number;
}

export interface TaxDeduction {
  id?: number;
  financial_year: string;
  section: '80C' | '80D' | '80CCD1B' | '80E' | '80G' | 'HRA' | 'standard_deduction' | 'other';
  instrument_type?: string;
  amount: number;
  date_invested: string;
  notes?: string;
  linked_transaction_id?: number;
}

// ── NEW REGIME SLABS (FY 2025-26) ──────────────────────
const NEW_REGIME_SLABS = [
  { upTo: 300000,   rate: 0 },
  { upTo: 700000,   rate: 0.05 },
  { upTo: 1000000,  rate: 0.10 },
  { upTo: 1200000,  rate: 0.15 },
  { upTo: 1500000,  rate: 0.20 },
  { upTo: Infinity, rate: 0.30 },
];
const NEW_REGIME_STANDARD_DEDUCTION_SALARIED = 75000;
const NEW_REGIME_87A_LIMIT = 700000; // Full rebate if taxable income ≤ 7L

// ── OLD REGIME SLABS ────────────────────────────────────
const OLD_REGIME_SLABS = [
  { upTo: 250000,   rate: 0 },
  { upTo: 500000,   rate: 0.05 },
  { upTo: 1000000,  rate: 0.20 },
  { upTo: Infinity, rate: 0.30 },
];
const OLD_REGIME_STANDARD_DEDUCTION_SALARIED = 50000;
const OLD_REGIME_87A_LIMIT = 500000; // Full rebate if taxable income ≤ 5L

// ── DEDUCTION LIMITS ────────────────────────────────────
const SECTION_80C_LIMIT = 150000;
const SECTION_80D_LIMIT_BELOW60 = 25000;
const SECTION_80D_LIMIT_SENIOR = 50000;
const SECTION_80CCD1B_LIMIT = 50000;
const CESS_RATE = 0.04;

// Compute tax progressively on taxable income
function computeSlabTax(taxableIncome: number, slabs: typeof NEW_REGIME_SLABS): number {
  let tax = 0;
  let prev = 0;
  for (const slab of slabs) {
    if (taxableIncome <= prev) break;
    const chargeable = Math.min(taxableIncome, slab.upTo) - prev;
    tax += chargeable * slab.rate;
    prev = slab.upTo;
  }
  return tax;
}

export function calculateHRAExemption(
  basicSalary: number,
  hraReceived: number,
  rentPaid: number,
  isMetro: boolean
): number {
  if (rentPaid <= 0 || basicSalary <= 0) return 0;
  const rentMinusBasic = Math.max(0, rentPaid - basicSalary * 0.10);
  const hraBasisPercent = isMetro ? 0.50 : 0.40;
  const exemption = Math.min(
    hraReceived,
    rentMinusBasic,
    basicSalary * hraBasisPercent
  );
  return Math.max(0, exemption);
}

export interface OldRegimeDeductionBreakdown {
  standardDeduction: number;
  section80C: number;
  section80D: number;
  section80CCD1B: number;
  section80E: number;
  hraExemption: number;
  totalDeductions: number;
}

export function calculateOldRegimeDeductions(
  profile: TaxProfile,
  deductions: TaxDeduction[]
): OldRegimeDeductionBreakdown {
  const is80DLimit = profile.age_category === 'below60'
    ? SECTION_80D_LIMIT_BELOW60
    : SECTION_80D_LIMIT_SENIOR;

  const sum80C = deductions
    .filter(d => d.section === '80C')
    .reduce((s, d) => s + d.amount, 0);
  const sum80D = deductions
    .filter(d => d.section === '80D')
    .reduce((s, d) => s + d.amount, 0);
  const sumCCD1B = deductions
    .filter(d => d.section === '80CCD1B')
    .reduce((s, d) => s + d.amount, 0);
  const sum80E = deductions
    .filter(d => d.section === '80E')
    .reduce((s, d) => s + d.amount, 0); // No cap

  const section80C    = Math.min(sum80C, SECTION_80C_LIMIT);
  const section80D    = Math.min(sum80D, is80DLimit);
  const section80CCD1B = Math.min(sumCCD1B, SECTION_80CCD1B_LIMIT);
  const section80E    = sum80E;
  const standardDeduction = profile.is_salaried ? OLD_REGIME_STANDARD_DEDUCTION_SALARIED : 0;
  const hraExemption = profile.is_salaried
    ? calculateHRAExemption(
        profile.basic_salary,
        profile.hra_received,
        profile.rent_paid,
        !!profile.is_metro_city
      )
    : 0;

  const totalDeductions = standardDeduction + section80C + section80D
    + section80CCD1B + section80E + hraExemption;

  return {
    standardDeduction, section80C, section80D,
    section80CCD1B, section80E, hraExemption, totalDeductions,
  };
}

export interface TaxCalculationResult {
  grossIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  slabTax: number;
  rebate87A: number;
  cess: number;
  totalTax: number;
  monthlyTDS: number;
  deductionBreakdown?: OldRegimeDeductionBreakdown;
  slabBreakdown: { label: string; rate: string; tax: number }[];
}

export function calculateTax(
  profile: TaxProfile,
  deductions: TaxDeduction[],
  regime: 'new' | 'old'
): TaxCalculationResult {
  const isNew = regime === 'new';

  // Compute deductions
  let totalDeductions = 0;
  let deductionBreakdown: OldRegimeDeductionBreakdown | undefined;

  if (isNew) {
    totalDeductions = profile.is_salaried ? NEW_REGIME_STANDARD_DEDUCTION_SALARIED : 0;
  } else {
    deductionBreakdown = calculateOldRegimeDeductions(profile, deductions);
    totalDeductions = deductionBreakdown.totalDeductions;
  }

  const taxableIncome = Math.max(0, profile.annual_income - totalDeductions);

  // Compute slab tax
  const slabs = isNew ? NEW_REGIME_SLABS : OLD_REGIME_SLABS;
  const slabTax = computeSlabTax(taxableIncome, slabs);

  // 87A Rebate
  const rebateLimit = isNew ? NEW_REGIME_87A_LIMIT : OLD_REGIME_87A_LIMIT;
  const rebate87A = taxableIncome <= rebateLimit ? slabTax : 0;

  const taxAfterRebate = Math.max(0, slabTax - rebate87A);
  const cess = taxAfterRebate * CESS_RATE;
  const totalTax = taxAfterRebate + cess;

  // Build slab breakdown for display
  const slabBreakdown: { label: string; rate: string; tax: number }[] = [];
  let prev = 0;
  for (const slab of slabs) {
    if (taxableIncome <= prev) break;
    const upper = Math.min(taxableIncome, slab.upTo);
    const chargeable = upper - prev;
    slabBreakdown.push({
      label: slab.upTo === Infinity
        ? `Above ₹${formatLakh(prev)}`
        : `₹${formatLakh(prev + 1)} – ₹${formatLakh(slab.upTo)}`,
      rate: `${(slab.rate * 100).toFixed(0)}%`,
      tax: chargeable * slab.rate,
    });
    prev = slab.upTo;
  }

  return {
    grossIncome: profile.annual_income,
    totalDeductions,
    taxableIncome,
    slabTax,
    rebate87A,
    cess,
    totalTax,
    monthlyTDS: totalTax / 12,
    deductionBreakdown,
    slabBreakdown,
  };
}

function formatLakh(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(0)}L`;
  return n.toLocaleString('en-IN');
}

export interface RegimeComparison {
  oldRegimeTax: number;
  newRegimeTax: number;
  recommendedRegime: 'old' | 'new';
  savings: number;
  oldResult: TaxCalculationResult;
  newResult: TaxCalculationResult;
}

export function compareRegimes(profile: TaxProfile, deductions: TaxDeduction[]): RegimeComparison {
  const oldResult = calculateTax(profile, deductions, 'old');
  const newResult = calculateTax(profile, deductions, 'new');

  const recommendedRegime = oldResult.totalTax <= newResult.totalTax ? 'old' : 'new';
  const savings = Math.abs(oldResult.totalTax - newResult.totalTax);

  return { oldRegimeTax: oldResult.totalTax, newRegimeTax: newResult.totalTax, recommendedRegime, savings, oldResult, newResult };
}

export interface InvestmentSuggestion {
  section80CRemaining: number;
  section80DRemaining: number;
  section80CCD1BRemaining: number;
  daysRemainingInFY: number;
  totalPotentialSavings: number;
  marginalRate: number;
}

export function suggestRemainingInvestment(
  profile: TaxProfile,
  deductions: TaxDeduction[]
): InvestmentSuggestion {
  const is80DLimit = profile.age_category === 'below60'
    ? SECTION_80D_LIMIT_BELOW60
    : SECTION_80D_LIMIT_SENIOR;

  const sum80C = deductions.filter(d => d.section === '80C').reduce((s, d) => s + d.amount, 0);
  const sum80D = deductions.filter(d => d.section === '80D').reduce((s, d) => s + d.amount, 0);
  const sumCCD1B = deductions.filter(d => d.section === '80CCD1B').reduce((s, d) => s + d.amount, 0);

  const section80CRemaining    = Math.max(0, SECTION_80C_LIMIT - sum80C);
  const section80DRemaining    = Math.max(0, is80DLimit - sum80D);
  const section80CCD1BRemaining = Math.max(0, SECTION_80CCD1B_LIMIT - sumCCD1B);

  // Days until March 31 of current FY
  const now = new Date();
  const currentYear = now.getMonth() < 3 ? now.getFullYear() : now.getFullYear() + 1; // FY ends March
  const fyEnd = new Date(currentYear, 2, 31); // March 31
  const daysRemainingInFY = Math.max(0, Math.ceil((fyEnd.getTime() - now.getTime()) / 86400000));

  // Marginal rate (old regime)
  const taxableEstimate = Math.max(0, profile.annual_income - OLD_REGIME_STANDARD_DEDUCTION_SALARIED);
  let marginalRate = 0;
  for (const slab of OLD_REGIME_SLABS) {
    if (taxableEstimate > slab.upTo - 1) continue;
    marginalRate = slab.rate;
    break;
  }
  marginalRate = marginalRate || 0.30;

  const totalRemaining = section80CRemaining + section80DRemaining + section80CCD1BRemaining;
  const totalPotentialSavings = totalRemaining * marginalRate * (1 + CESS_RATE);

  return {
    section80CRemaining, section80DRemaining, section80CCD1BRemaining,
    daysRemainingInFY, totalPotentialSavings, marginalRate,
  };
}
