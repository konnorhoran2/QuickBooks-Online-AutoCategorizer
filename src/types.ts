export type BankTransaction = {
  id?: string;
  date: string;
  description: string;
  payee: string;
  category: string;
  spent: string;
  received: string;
  memo?: string;
  status?: 'For review' | 'Accepted' | 'Excluded';
  suggestedCategory?: string;
  rowSelector?: string; // CSS selector to target the row in the banking table
};

export type CategorizationDecision = {
  category: string;
  confidence: number; // 0..1
  reason?: string;
  action: 'auto_accept' | 'mark_for_review' | 'skip';
};


