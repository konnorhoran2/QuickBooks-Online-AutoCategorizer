import OpenAI from 'openai';
import { BankTransaction, CategorizationDecision } from '../types';

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function categorizeWithAI(t: BankTransaction): Promise<CategorizationDecision | null> {
  if (!client) return null;
  const amountAbs = parseAmount(t.spent) > 0 ? parseAmount(t.spent) : parseAmount(t.received);
  const debitCredit = parseAmount(t.spent) > 0 ? 'debit' : 'credit';
  const compact = {
    date: t.date,
    description: t.description,
    payee: t.payee,
    memo: t.memo ?? '',
    currentCategory: t.category ?? '',
    amount: amountAbs,
    side: debitCredit,
  };
  const prompt = [
    'You are an experienced accountant categorizing QuickBooks Online bank feed transactions.',
    'Return STRICT JSON only: {"category": string, "confidence": number, "reason": string}.',
    'Confidence is 0..1. Choose a QBO-friendly category name (e.g., "Office Supplies", "Advertising", "Bank Charges", "Software", "Travel", "Meals & Entertainment").',
    'If uncertain, pick the most likely category and reduce confidence.',
    `Transaction: ${JSON.stringify(compact)}`,
  ].join('\n');
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Reply with strict JSON only. Do not include backticks or prose.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
  });
  const text = res.choices[0]?.message?.content?.trim() ?? '';
  try {
    const parsed = JSON.parse(text) as { category: string; confidence?: number; reason?: string };
    const confidence = clamp01(parsed.confidence ?? 0.6);
    return {
      category: parsed.category,
      confidence,
      reason: parsed.reason,
      action: confidence >= 0.85 ? 'auto_accept' : 'mark_for_review',
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


