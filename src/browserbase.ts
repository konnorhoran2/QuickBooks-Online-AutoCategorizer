import 'dotenv/config';
import { logger } from './logger';
import { Browserbase } from '@browserbasehq/sdk';
import type { Browser, Page } from 'playwright-core';
import { chromium } from 'playwright-core';

export type BrowserSession = {
  close: () => Promise<void>;
  page: Page;
};

export async function createBrowserSession(): Promise<BrowserSession> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) throw new Error('Missing BROWSERBASE_API_KEY or BROWSERBASE_PROJECT_ID');

  const bb = new Browserbase({ apiKey });

  const session = await bb.sessions.create({ projectId });
  logger.info({ sessionId: session.id }, 'Browserbase session created');

  // Connect Playwright to the remote session over CDP
  const browser: Browser = await chromium.connectOverCDP(session.connectUrl);
  const context = browser.contexts()[0] ?? (await browser.newContext({ viewport: { width: 1366, height: 900 } }));
  const page = context.pages()[0] ?? (await context.newPage());

  return {
    page,
    close: async () => {
      // Close Playwright browser and end Browserbase session
      try {
        await browser.close();
      } catch (e) {
        logger.warn({ e }, 'Failed to close Playwright browser');
      }
      try {
        const sessionsAny: any = bb.sessions as any;
        if (typeof sessionsAny.close === 'function') {
          await sessionsAny.close(session.id);
        } else if (typeof sessionsAny.delete === 'function') {
          await sessionsAny.delete(session.id);
        } else if (typeof sessionsAny.end === 'function') {
          await sessionsAny.end(session.id);
        }
      } catch (e) {
        logger.warn({ e }, 'Failed to close Browserbase session');
      }
    },
  };
}


