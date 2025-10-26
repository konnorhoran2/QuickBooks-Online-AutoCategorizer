import type { Page } from 'playwright-core';
import { QboSelectors } from './selectors';
import { BankTransaction } from '../types';
import { logger } from '../logger';
import { NAV_TIMEOUT } from '../config/constants';

export async function gotoBankFeed(page: Page): Promise<void> {

  logger.info('Waiting for QboSelectors.nav.clientHomepage');
  await page.waitForSelector(QboSelectors.nav.clientHomepage, { timeout: NAV_TIMEOUT * 2 });
  logger.info('QboSelectors.nav.clientHomepage found, clicking');
  await page.click(QboSelectors.nav.clientHomepage);
  logger.info('Clicked QboSelectors.nav.clientHomepage');

  // Wait for automatic redirect to homepage
  logger.info('Waiting for automatic redirect to homepage...');
  await page.waitForURL('**/app/homepage**', { timeout: NAV_TIMEOUT });
  logger.info('Homepage loaded after client selection');

  logger.info('Navigating to banking page');
  await page.goto('https://qbo.intuit.com/app/banking?jobId=accounting', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  logger.info('Banking page loaded');
}

export async function readForReviewTransactions(page: Page, limit: number = 50): Promise<BankTransaction[]> {
  logger.info('Reading for review transactions');
  await page.waitForSelector(QboSelectors.bankFeed.transactionRows, { timeout: NAV_TIMEOUT });
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

export async function setTransactionCategoryAndAccept(page: Page, rowHandle: string, category: string, action: 'add' | 'match' = 'add'): Promise<void> {
  // rowHandle can be a selector or data-id. For simplicity assume it is a selector.
  const row = await page.$(rowHandle);
  if (!row) {
    logger.warn({ rowHandle }, 'Row not found for category update');
    return;
  }
  
  // try {
  //   // Try to edit the category cell
  //   const categoryCell = await row.$(QboSelectors.bankFeed.category);
  //   if (categoryCell) {
  //     await categoryCell.click();
  //     await page.keyboard.type(category);
  //     await page.keyboard.press('Enter');
  //     logger.info({ category, rowHandle, action }, 'Updated category');
  //   }
  // } catch (e) {
  //   logger.warn({ e, rowHandle }, 'Failed to update category');
  // }
  
  // Handle different actions based on the decision
  try {
    if (action === 'add') {
      // For "add" action, look for "Add" button
      const addButton = await row.$('button:has-text("Add")');
      if (addButton) {
        await addButton.click();
        logger.info({ rowHandle, action }, 'Clicked Add button for new category');
      } else {
        logger.warn({ rowHandle, action }, 'Add button not found');
      }
    } else if (action === 'match') {
      // For "match" action, look for "Match" button
      const matchButton = await row.$('button:has-text("Match")');
      if (matchButton) {
        await matchButton.click();
        logger.info({ rowHandle, action }, 'Clicked Match button for revenue transaction');
      } else {
        logger.warn({ rowHandle, action }, 'Match button not found');
      }
    }
  } catch (e) {
    logger.warn({ e, rowHandle, action }, `Failed to execute ${action} action`);
  }
}


