import { IncomingWebhook } from '@slack/webhook';

const url = process.env.SLACK_WEBHOOK_URL;
const webhook = url ? new IncomingWebhook(url) : null;

export async function sendSlackSummary(lines: string[]): Promise<void> {
  if (!webhook) return;
  const text = lines.join('\n');
  await webhook.send({ text });
}


