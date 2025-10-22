# QBO Browser Agent (Browserbase)

Automates QuickBooks Online bank feed categorization using a cloud browser via Browserbase.

## Prerequisites
- Node.js 18+ installed
- A Browserbase account and project ([Browserbase](https://browserbase.com))
- QBO user credentials (email provided in `.env.example`)

## Setup

1) Create environment file

```
cp .env.example .env
```

Fill the following in `.env`:
- `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`
- `QBO_PASSWORD` (email preset to `jeremy+1@ecomcpa.com`)
- Optional: `SLACK_WEBHOOK_URL`, `OPENAI_API_KEY`
- Optional: `CRON_SCHEDULE` (default `0 3 * * *` UTC)
- Optional: `QBO_MFA_CODE` to bypass interactive prompt once (otherwise you’ll be prompted)

2) Install dependencies

```
npm install
```

3) First login and MFA
- The login flow is: enter email → submit → enter password → submit.
- If QBO prompts for MFA, the script expects a code provider. For now, run when someone can supply the MFA code (tonight). You can later plug in a mailbox/SMS fetcher in `login.ts` via `mfaCodeProvider`.

## Run

Single run (process once and exit):
```
npm run dev
```

You will be prompted for MFA if required (or set `QBO_MFA_CODE`).

Daemon mode (scheduled runs; default daily 03:00 UTC):
```
npm run dev -- daemon
```

## Configuration
- Edit selectors if QBO UI changes: `src/qbo/selectors.ts`
- Rules-based categorization: `src/categorizer/rules.ts`
- Optional AI fallback (requires `OPENAI_API_KEY`): `src/categorizer/ai.ts`
- Scheduler entrypoint: `src/index.ts` → `runOnce()` in `src/runner.ts`
 - QBO navigation flow: `src/qbo/bankFeed.ts` and `src/qbo/login.ts`

Banking navigation specifics:
- After client selection, the app redirects to `https://qbo.intuit.com/app/homepage`.
- The agent then goes to `https://qbo.intuit.com/app/banking?jobId=accounting` and opens the “For review” tab.

## Browserbase Notes
- Ensure your API key and project ID are valid.
- Sessions are created on-demand and closed after each run.

## Operational Tips
- Set `LOG_LEVEL=debug` while tuning selectors or flows.
- Use Slack webhook for daily summaries.
- Consider running as a service or scheduled job (e.g., Windows Task Scheduler) if not using the built-in cron.
 - If reCAPTCHA appears, Browserbase will solve it; the script waits for the password field.
 - If the “Verify it’s you” screen appears, the agent selects SMS and prompts for the OTP.

## Caveats
- QBO bank feed DOM can change; keep `selectors.ts` up to date.
- Auto-accept is conservative; refine row targeting before enabling full automation at scale.
- Auto-accept is currently simulated in `src/runner.ts` (toggle the commented call to `setTransactionCategoryAndAccept` once selectors are verified).