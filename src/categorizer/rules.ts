import { BankTransaction, CategorizationDecision } from '../types';

export type Rule = {
  name: string;
  match: (t: BankTransaction) => boolean;
  category: string;
  confidence?: number;
  action?: CategorizationDecision['action'];
};

const defaultRules: Rule[] = [
  // Vendor/Payee based rules
  { name: 'Amazon -> Office Supplies', match: (t) => includes(t, 'amazon'), category: 'Office Supplies', confidence: 0.9, action: 'auto_accept' },
  { name: 'Facebook Ads -> Advertising', match: (t) => includes(t, 'facebook ads') || includes(t, 'meta ads'), category: 'Advertising', confidence: 0.9, action: 'auto_accept' },
  { name: 'Stripe Fees -> Bank Charges', match: (t) => includes(t, 'stripe fee') || includes(t, 'stripe payout fee'), category: 'Bank Charges', confidence: 0.95, action: 'auto_accept' },
  { name: 'Google Ads -> Advertising', match: (t) => includes(t, 'google ads') || includes(t, 'google adwords'), category: 'Advertising', confidence: 0.9, action: 'auto_accept' },
  { name: 'PayPal -> Bank Charges', match: (t) => includes(t, 'paypal'), category: 'Bank Charges', confidence: 0.8, action: 'auto_accept' },
  { name: 'Office Depot -> Office Supplies', match: (t) => includes(t, 'office depot'), category: 'Office Supplies', confidence: 0.9, action: 'auto_accept' },
  { name: 'Staples -> Office Supplies', match: (t) => includes(t, 'staples'), category: 'Office Supplies', confidence: 0.9, action: 'auto_accept' },
  
  // Amount-based rules (using spent field)
  { name: 'Large Expense -> Review', match: (t) => parseAmount(t.spent) > 1000, category: 'Review Required', confidence: 0.7, action: 'mark_for_review' },
  { name: 'Small Expense -> Office Supplies', match: (t) => parseAmount(t.spent) < 50 && includes(t, 'supplies'), category: 'Office Supplies', confidence: 0.8, action: 'auto_accept' },
  
  // Description patterns
  { name: 'Software Subscriptions -> Software', match: (t) => includes(t, 'subscription') || includes(t, 'software'), category: 'Software', confidence: 0.85, action: 'auto_accept' },
  { name: 'Travel Expenses -> Travel', match: (t) => includes(t, 'travel') || includes(t, 'hotel') || includes(t, 'flight'), category: 'Travel', confidence: 0.9, action: 'auto_accept' },
  { name: 'Meals -> Meals & Entertainment', match: (t) => includes(t, 'restaurant') || includes(t, 'food') || includes(t, 'meal'), category: 'Meals & Entertainment', confidence: 0.8, action: 'auto_accept' },
];

export function categorizeByRules(t: BankTransaction, rules: Rule[] = defaultRules): CategorizationDecision | null {
  for (const r of rules) {
    if (r.match(t)) {
      return {
        category: r.category,
        confidence: r.confidence ?? 0.8,
        action: r.action ?? 'mark_for_review',
        reason: r.name,
      };
    }
  }
  return null;
}

function includes(t: BankTransaction, needle: string): boolean {
  const hay = `${t.description} ${t.payee} ${t.memo ?? ''}`.toLowerCase();
  return hay.includes(needle.toLowerCase());
}

function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  const cleaned = amountStr.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}


