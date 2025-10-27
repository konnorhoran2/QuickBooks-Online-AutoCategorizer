import { createBrowserSession } from './browserbase';
import { loginToQbo } from './qbo/login';
import { gotoBankFeed, readForReviewTransactions, setTransactionCategoryAndAccept } from './qbo/bankFeed';
import { categorizeByRules } from './categorizer/rules';
import { categorizeWithAI } from './categorizer/ai';
import { logger } from './logger';
import { sendSlackSummary } from './notifier/slack';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export async function runOnce(): Promise<void> {
  const summary: string[] = [];
  let session = null;
  try {
    logger.info('Starting QBO automation run');
    session = await createBrowserSession();
    
    const mfaCodeProvider = async (): Promise<string> => {
      if (process.env.QBO_MFA_CODE && process.env.QBO_MFA_CODE.trim().length > 0) {
        return process.env.QBO_MFA_CODE.trim();
      }
      const rl = createInterface({ input, output });
      const code = await rl.question('Enter verification code: ');
      rl.close();
      return code.trim();
    };

    await loginToQbo(session.page, { mfaCodeProvider });
    await gotoBankFeed(session.page);
    const txns = await readForReviewTransactions(session.page, 50);
    summary.push(`Loaded ${txns.length} transactions For review`);

    let added = 0;
    let matched = 0;
    let markedForReview = 0;
    
    for (const t of txns) {
      const byRule = categorizeByRules(t);
      const decision = byRule ?? (await categorizeWithAI(t));
      if (!decision) {
        logger.info({ t }, 'No decision');
        markedForReview += 1;
        continue;
      }
      
      logger.info({ t, decision }, 'Decision');
      
      // Execute action based on decision - Target 90% confidence for reliable actions
      if (decision.action === 'add' && decision.confidence >= 0.9 && t.rowSelector) {
        try {
          await setTransactionCategoryAndAccept(session.page, t.rowSelector, decision.category, 'add');
          added += 1;
          logger.info({ t, decision }, 'Added new category with 90%+ confidence');
        } catch (e) {
          logger.warn({ e, row: t.rowSelector }, 'Failed to add category');
        }
      } else if (decision.action === 'match' && decision.confidence >= 0.9 && t.rowSelector) {
        try {
          await setTransactionCategoryAndAccept(session.page, t.rowSelector, decision.category, 'match');
          matched += 1;
          logger.info({ t, decision }, 'Matched revenue transaction with 90%+ confidence');
        } catch (e) {
          logger.warn({ e, row: t.rowSelector }, 'Failed to match transaction');
        }
      } else if (decision.action === 'add' && decision.confidence >= 0.7 && t.rowSelector) {
        // Allow 70%+ confidence for add actions as fallback
        try {
          await setTransactionCategoryAndAccept(session.page, t.rowSelector, decision.category, 'add');
          added += 1;
          logger.info({ t, decision }, 'Added new category with 70%+ confidence');
        } catch (e) {
          logger.warn({ e, row: t.rowSelector }, 'Failed to add category');
        }
      } else if (decision.action === 'match' && decision.confidence >= 0.7 && t.rowSelector) {
        // Allow 70%+ confidence for match actions as fallback
        try {
          await setTransactionCategoryAndAccept(session.page, t.rowSelector, decision.category, 'match');
          matched += 1;
          logger.info({ t, decision }, 'Matched revenue transaction with 70%+ confidence');
        } catch (e) {
          logger.warn({ e, row: t.rowSelector }, 'Failed to match transaction');
        }
      } else {
        markedForReview += 1;
        logger.info({ t, confidence: decision?.confidence, action: decision?.action }, 'Marked for review (low confidence or no row selector)');
      }
    }
    summary.push(`Added new categories: ${added}`);
    summary.push(`Matched revenue: ${matched}`);
    summary.push(`Marked for review: ${markedForReview}`);
    logger.info({ summary }, 'Run completed successfully');
  } catch (e) {
    logger.error({ e }, 'Run failed');
    throw e;
  } finally {
    if (session) {
      logger.info('Closing browser session');
      await session.close();
      logger.info('Browser session closed');
    }
    await sendSlackSummary(summary);
  }
}


