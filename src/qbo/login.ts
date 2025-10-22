import type { Page } from 'playwright-core';
import { QboSelectors } from './selectors';
import { logger } from '../logger';

export async function loginToQbo(page: Page, opts?: { email?: string; password?: string; mfaCodeProvider?: () => Promise<string>; }): Promise<void> {
  const email = opts?.email ?? process.env.QBO_EMAIL;
  const password = opts?.password ?? process.env.QBO_PASSWORD;
  if (!email || !password) throw new Error('Missing QBO_EMAIL or QBO_PASSWORD');

  const navTimeout = 90000;

  await page.goto('https://accounts.intuit.com/app/sign-in?app_group=QBO', { waitUntil: 'domcontentloaded', timeout: navTimeout });
  logger.info('Navigated to accounts.intuit.com/app/sign-in?app_group=QBO');

  // Step 1: email -> submit
  await page.waitForSelector(QboSelectors.login.email, { timeout: 90000 });
  logger.info('Filling email');
  await page.fill(QboSelectors.login.email, email);
  logger.info('Clicking email-submit');
  await page.click(QboSelectors.login.submit);

  // Wait for reCAPTCHA to be solved automatically by Browserbase
  logger.info('Waiting for reCAPTCHA to be solved...');
  try {
    // Wait for either password field to appear (success) or reCAPTCHA to disappear
    await page.waitForSelector(QboSelectors.login.password, { timeout: 180000 });
    logger.info('Password field appeared - reCAPTCHA solved or not present');
  } catch (e) {
    logger.info('Password field not found, checking for reCAPTCHA...');
    // If password field not found, wait a bit more for reCAPTCHA resolution
    await page.waitForTimeout(5000);
    await page.waitForSelector(QboSelectors.login.password, { timeout: 180000 });
  }

  // Step 2: password -> submit
  logger.info('Filling password');
  await page.fill(QboSelectors.login.password, password);
  logger.info('Clicking submit');
  await page.click(QboSelectors.login.submit);
  logger.info('Clicked submit');

  // Handle "verify it's you" SMS OTP challenge after password
  try {
    await page.waitForSelector(QboSelectors.login.smsOptionButton, { timeout: 30000 });
    logger.info('SMS OTP challenge detected - clicking SMS option');
    await page.click(QboSelectors.login.smsOptionButton);
    logger.info('Clicked SMS OTP option');
    
    // Wait for verification code input
    await page.waitForSelector(QboSelectors.login.otpInput, { timeout: 90000 });
    logger.info('SMS verification code input found');
    
    const code = await (opts?.mfaCodeProvider ? opts.mfaCodeProvider() : promptForMfa());
    logger.info('Filling SMS verification code');
    await page.fill(QboSelectors.login.otpInput, code);
    logger.info('Clicking continue/submit');
    await page.click(QboSelectors.login.submit);
    logger.info('SMS verification submitted');
  } catch {
    logger.info('No MFA challenge detected');
  }
}

async function promptForMfa(): Promise<string> {
  throw new Error('MFA required. Provide mfaCodeProvider that fetches the code.');
}


