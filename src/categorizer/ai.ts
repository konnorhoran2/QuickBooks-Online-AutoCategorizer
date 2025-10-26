import OpenAI from 'openai';
import { BankTransaction, CategorizationDecision } from '../types';

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function categorizeWithAI(t: BankTransaction): Promise<CategorizationDecision | null> {
  if (!client) return null;
  
  const amountAbs = parseAmount(t.spent) > 0 ? parseAmount(t.spent) : parseAmount(t.received);
  const debitCredit = parseAmount(t.spent) > 0 ? 'debit' : 'credit';
  const isRevenue = parseAmount(t.received) > 0;
  
  const compact = {
    date: t.date,
    description: t.description,
    payee: t.payee,
    memo: t.memo ?? '',
    currentCategory: t.category ?? '',
    amount: amountAbs,
    side: debitCredit,
    isRevenue,
  };
  
  const prompt = [
    'You are an experienced accountant categorizing QuickBooks Online bank feed transactions.',
    'Your job is to analyze the payee and description to determine the correct category.',
    'IMPORTANT: You must research unknown vendors to understand what type of business they are.',
    'Return STRICT JSON only: {"category": string, "confidence": number, "reason": string, "action": string}.',
    'CONFIDENCE REQUIREMENTS:',
    '- Aim for 0.9+ (90%+) confidence for reliable categorization',
    '- Only return <0.9 if you truly cannot determine the vendor type',
    '- Research the vendor online if needed to reach 90% confidence',
    'ACTION RULES:',
    '- "add" for expense transactions (spent > 0) - creates new category',
    '- "match" for revenue transactions (received > 0) - matches existing transaction',
    '- "mark_for_review" only if confidence < 0.7',
    'CATEGORY NAMES: Use standard QBO categories like "Office Supplies", "Advertising", "Bank Charges", "Software", "Travel", "Meals & Entertainment", "Professional Services", "Utilities", "Rent", "Insurance", "Sales Revenue", etc.',
    'RESEARCH: If the vendor is unknown, research what type of business it is and suggest the most appropriate category.',
    `Transaction to categorize: ${JSON.stringify(compact)}`,
  ].join('\n');
  
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Reply with strict JSON only. Do not include backticks or prose. Research unknown vendors to suggest appropriate categories.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
  });
  
  const text = res.choices[0]?.message?.content?.trim() ?? '';
  try {
    const parsed = JSON.parse(text) as { 
      category: string; 
      confidence?: number; 
      reason?: string; 
      action?: string;
    };
    
    const confidence = clamp01(parsed.confidence ?? 0.6);
    let action: CategorizationDecision['action'] = 'mark_for_review';
    
    // Determine action based on confidence and transaction type
    // Target 90% confidence for reliable categorization
    if (confidence >= 0.9) {
      action = isRevenue ? 'match' : 'add';
    } else if (confidence >= 0.7) {
      action = isRevenue ? 'match' : 'add';
    } else {
      action = 'mark_for_review';
    }
    
    // Override with AI-suggested action if provided and valid
    if (parsed.action && ['add', 'match', 'mark_for_review'].includes(parsed.action)) {
      action = parsed.action as CategorizationDecision['action'];
    }
    
    return {
      category: parsed.category,
      confidence,
      reason: parsed.reason,
      action,
    };
  } catch {
    return null;
  }
}

function parseAmount(amountStr?: string): number {
  if (!amountStr) return 0;
  const cleaned = amountStr.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}


