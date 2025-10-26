import { BankTransaction, CategorizationDecision } from '../types';

export type Rule = {
  name: string;
  match: (t: BankTransaction) => boolean;
  category: string;
  confidence?: number;
  action?: CategorizationDecision['action'];
};

const defaultRules: Rule[] = [
  // Vendor/Payee based rules - Expenses use 'add' action with 90%+ confidence
  { name: 'Amazon -> Office Supplies', match: (t) => includes(t, 'amazon'), category: 'Office Supplies', confidence: 0.95, action: 'add' },
  { name: 'Facebook Ads -> Advertising', match: (t) => includes(t, 'facebook ads') || includes(t, 'meta ads'), category: 'Advertising', confidence: 0.95, action: 'add' },
  { name: 'Stripe Fees -> Bank Charges', match: (t) => includes(t, 'stripe fee') || includes(t, 'stripe payout fee'), category: 'Bank Charges', confidence: 0.98, action: 'add' },
  { name: 'Google Ads -> Advertising', match: (t) => includes(t, 'google ads') || includes(t, 'google adwords'), category: 'Advertising', confidence: 0.95, action: 'add' },
  { name: 'PayPal -> Bank Charges', match: (t) => includes(t, 'paypal'), category: 'Bank Charges', confidence: 0.9, action: 'add' },
  { name: 'Office Depot -> Office Supplies', match: (t) => includes(t, 'office depot'), category: 'Office Supplies', confidence: 0.95, action: 'add' },
  { name: 'Staples -> Office Supplies', match: (t) => includes(t, 'staples'), category: 'Office Supplies', confidence: 0.95, action: 'add' },
  
  // Amount-based rules (using spent field)
  { name: 'Large Expense -> Review', match: (t) => parseAmount(t.spent) > 1000, category: 'Review Required', confidence: 0.7, action: 'mark_for_review' },
  { name: 'Small Expense -> Office Supplies', match: (t) => parseAmount(t.spent) < 50 && includes(t, 'supplies'), category: 'Office Supplies', confidence: 0.9, action: 'add' },
  
  // Description patterns - Expenses use 'add' action with 90%+ confidence
  { name: 'Software Subscriptions -> Software', match: (t) => includes(t, 'subscription') || includes(t, 'software'), category: 'Software', confidence: 0.92, action: 'add' },
  { name: 'Travel Expenses -> Travel', match: (t) => includes(t, 'travel') || includes(t, 'hotel') || includes(t, 'flight'), category: 'Travel', confidence: 0.95, action: 'add' },
  { name: 'Meals -> Meals & Entertainment', match: (t) => includes(t, 'restaurant') || includes(t, 'food') || includes(t, 'meal'), category: 'Meals & Entertainment', confidence: 0.9, action: 'add' },
  
  // Revenue transaction patterns - Revenue uses 'match' action with 90%+ confidence
  { name: 'Stripe Payment -> Sales Revenue', match: (t) => includes(t, 'stripe') && parseAmount(t.received) > 0, category: 'Sales Revenue', confidence: 0.98, action: 'match' },
  { name: 'PayPal Payment -> Sales Revenue', match: (t) => includes(t, 'paypal') && parseAmount(t.received) > 0, category: 'Sales Revenue', confidence: 0.95, action: 'match' },
  { name: 'Square Payment -> Sales Revenue', match: (t) => includes(t, 'square') && parseAmount(t.received) > 0, category: 'Sales Revenue', confidence: 0.95, action: 'match' },
  { name: 'Bank Transfer In -> Sales Revenue', match: (t) => includes(t, 'transfer') && parseAmount(t.received) > 0, category: 'Sales Revenue', confidence: 0.9, action: 'match' },
  { name: 'Client Payment -> Sales Revenue', match: (t) => (includes(t, 'client') || includes(t, 'customer')) && parseAmount(t.received) > 0, category: 'Sales Revenue', confidence: 0.92, action: 'match' },
];

export function categorizeByRules(t: BankTransaction, rules: Rule[] = defaultRules): CategorizationDecision | null {
  for (const r of rules) {
    if (r.match(t)) {
      // Use the action specified in the rule, or determine based on transaction type
      let action: CategorizationDecision['action'] = r.action ?? 'mark_for_review';
      
      // For revenue transactions (received > 0), always use 'match' action
      if (parseAmount(t.received) > 0) {
        action = 'match';
      }
      // For expense transactions (spent > 0), use 'add' action if not specified
      else if (parseAmount(t.spent) > 0 && !r.action) {
        action = 'add';
      }
      
      return {
        category: r.category,
        confidence: r.confidence ?? 0.8,
        action,
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


