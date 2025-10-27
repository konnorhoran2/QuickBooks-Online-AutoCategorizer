import type { Page } from 'playwright-core';
import { QboSelectors } from './selectors';
import { logger } from '../logger';
import { NAV_TIMEOUT, COMMON_TIMEOUT, RECAPTCHA_TIMEOUT } from '../config/constants';

export async function loginToQbo(page: Page, opts?: { email?: string; password?: string; mfaCodeProvider?: () => Promise<string>; }): Promise<void> {
  const email = opts?.email ?? process.env.QBO_EMAIL;
  const password = opts?.password ?? process.env.QBO_PASSWORD;
  if (!email || !password) throw new Error('Missing QBO_EMAIL or QBO_PASSWORD');

  await page.goto('https://accounts.intuit.com/app/sign-in?app_group=QBO', { waitUntil: 'load', timeout: NAV_TIMEOUT });
  logger.info('Navigated to accounts.intuit.com/app/sign-in?app_group=QBO');

  // Step 1: email -> submit
  await page.waitForSelector(QboSelectors.login.email, { timeout: NAV_TIMEOUT });
  logger.info('Filling email');
  await page.fill(QboSelectors.login.email, email);
  await page.click(QboSelectors.login.submit);
  logger.info('Clicked email-submit');

  // Set up reCAPTCHA solving event listeners
  let captchaSolving = false;
  let captchaSolved = false;
  
  page.on("console", (msg) => {
    if (msg.text() == "browserbase-solving-started") {
      captchaSolving = true;
      logger.info("reCAPTCHA solving in progress...");
    } else if (msg.text() == "browserbase-solving-finished") {
      captchaSolving = false;
      captchaSolved = true;
      logger.info("reCAPTCHA solving completed");
    }
  });

  await page.waitForTimeout(COMMON_TIMEOUT);

  // Wait for reCAPTCHA to be solved automatically by Browserbase with 120s timeout
  const recaptchaStartTime = Date.now();
  while (captchaSolving && (Date.now() - recaptchaStartTime) < RECAPTCHA_TIMEOUT) {
    logger.info('Waiting for reCAPTCHA to be solved...');
    await page.waitForTimeout(COMMON_TIMEOUT);
  }
  
  if (captchaSolved) {
    await page.click(QboSelectors.login.submit);
    logger.info('Clicked reCAPTCHA-submit');
  } else if (captchaSolving) {
    logger.warn(`reCAPTCHA solving timed out after '${RECAPTCHA_TIMEOUT / 1000}' seconds, continuing anyway`);
  }
  
  // Step 2: password -> submit
  await page.waitForSelector(QboSelectors.login.password, { timeout: COMMON_TIMEOUT });
  logger.info('Filling password');
  await page.fill(QboSelectors.login.password, password);
  await page.click(QboSelectors.login.submit);
  logger.info('Clicked password-submit');

  // Handle "verify it's you" SMS OTP challenge after password
  try {
    await page.waitForSelector(QboSelectors.login.smsOptionButton, { timeout: COMMON_TIMEOUT });
    logger.info('SMS OTP challenge detected - clicking SMS option');
    await page.click(QboSelectors.login.smsOptionButton);
    logger.info('Clicked SMS OTP option');
    
    // Wait for verification code input
    await page.waitForSelector(QboSelectors.login.otpInput, { timeout: COMMON_TIMEOUT });
    const code = await (opts?.mfaCodeProvider ? opts.mfaCodeProvider() : promptForMfa());
    logger.info('Filling SMS verification code');
    await page.fill(QboSelectors.login.otpInput, code);
    await page.click(QboSelectors.login.submit);
    logger.info('SMS verification submitted');
  } catch {
    logger.info('No MFA challenge detected');
  }
}

async function promptForMfa(): Promise<string> {
  throw new Error('MFA required. Provide mfaCodeProvider that fetches the code.');
}


