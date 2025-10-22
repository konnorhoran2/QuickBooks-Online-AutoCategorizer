import type { Page } from 'playwright-core';
import { QboSelectors } from './selectors';
import { BankTransaction } from '../types';
import { logger } from '../logger';

export async function gotoBankFeed(page: Page): Promise<void> {
  const navTimeout = 90000;

  logger.info('Waiting for QboSelectors.nav.clientHomepage');
  await page.waitForSelector(QboSelectors.nav.clientHomepage, { timeout: 180000 });
  logger.info('QboSelectors.nav.clientHomepage found, clicking');
  await page.click(QboSelectors.nav.clientHomepage);
  logger.info('Clicked QboSelectors.nav.clientHomepage');

  // Wait for automatic redirect to homepage
  logger.info('Waiting for automatic redirect to homepage...');
  await page.waitForURL('**/app/homepage**', { timeout: 90000 });
  logger.info('Homepage loaded after client selection');

  logger.info('Navigating to banking page');
  await page.goto('https://qbo.intuit.com/app/banking?jobId=accounting', { waitUntil: 'domcontentloaded', timeout: navTimeout });
  logger.info('Banking page loaded');
}

export async function readForReviewTransactions(page: Page, limit: number = 50): Promise<BankTransaction[]> {
  logger.info('Reading for review transactions');
  await page.waitForSelector(QboSelectors.bankFeed.transactionRows, { timeout: 90000 });
  logger.info('QboSelectors.bankFeed.transactionRows found');
  const rows = await page.$$(QboSelectors.bankFeed.transactionRows);
  logger.info({ rowCount: rows.length - 1 }, 'Found rows');
  const results: BankTransaction[] = [];
  for (let index = 1; index < Math.min(rows.length, limit); index++) {
    const row = rows[index];
    const date = (await row.$eval(QboSelectors.bankFeed.date, el => (el as HTMLElement).innerText).catch(() => '')) as string;
    const description = (await row.$eval(QboSelectors.bankFeed.description, el => (el as HTMLElement).innerText).catch(() => '')) as string;
    const payee = (await row.$eval(QboSelectors.bankFeed.payee, el => (el as HTMLElement).innerText).catch(() => '')) as string;
    const category = (await row.$eval(QboSelectors.bankFeed.category, el => (el as HTMLElement).innerText).catch(() => '')) as string;
    const spent = (await row.$eval(QboSelectors.bankFeed.spent, el => (el as HTMLElement).innerText).catch(() => '')) as string;
    const received = (await row.$eval(QboSelectors.bankFeed.received, el => (el as HTMLElement).innerText).catch(() => '')) as string;

    const rowSelector = `${QboSelectors.bankFeed.transactionRows}:nth-child(${index + 1})`;
    results.push({ date, description, payee, category, spent, received, status: 'For review', rowSelector });
  }
  logger.info({ transactionCount: results.length }, 'Found transactions');
  return results;
}

export async function setTransactionCategoryAndAccept(page: Page, rowHandle: string, category: string): Promise<void> {
  // rowHandle can be a selector or data-id. For simplicity assume it is a selector.
  const row = await page.$(rowHandle);
  if (!row) {
    logger.warn({ rowHandle }, 'Row not found for category update');
    return;
  }
  try {
    // Try to edit the category cell
    const categoryCell = await row.$(QboSelectors.bankFeed.category);
    if (categoryCell) {
      await categoryCell.click();
      await page.keyboard.type(category);
      await page.keyboard.press('Enter');
      logger.info({ category, rowHandle }, 'Updated category');
    }
  } catch (e) {
    logger.warn({ e, rowHandle }, 'Failed to update category');
  }
  // Click an Accept button in the row if present
  try {
    const accept = await row.$('button:has-text("Accept")');
    if (accept) {
      await accept.click();
      logger.info({ rowHandle }, 'Accepted transaction');
    }
  } catch (e) {
    logger.warn({ e, rowHandle }, 'Failed to accept transaction');
  }
}


