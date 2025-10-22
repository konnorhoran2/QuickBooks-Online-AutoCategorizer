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

    let autoAccepted = 0;
    for (const t of txns) {
      const byRule = categorizeByRules(t);
      const decision = byRule ?? (await categorizeWithAI(t));
      if (!decision) {
        logger.info({ t }, 'No decision');
        continue;
      }
      logger.info({ t, decision }, 'Decision');
      if (decision.action === 'auto_accept' && decision.confidence >= 0.85 && t.rowSelector) {
        try {
          // await setTransactionCategoryAndAccept(session.page, t.rowSelector, decision.category);
          autoAccepted += 1;
          logger.info({ t, decision }, 'Auto-accepted (simulated)');
        } catch (e) {
          logger.warn({ e, row: t.rowSelector }, 'Failed to accept row');
        }
      } else {
        logger.info({ t, confidence: decision?.confidence }, 'Skipping auto-accept (no row selector or low confidence)');
      }
    }
    summary.push(`Auto-accepted (simulated) ${autoAccepted}`);
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


