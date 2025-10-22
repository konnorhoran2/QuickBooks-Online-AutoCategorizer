import 'dotenv/config';
import { runOnce } from './runner';
import cron from 'node-cron';
import { logger } from './logger';

const schedule = process.env.CRON_SCHEDULE || '0 3 * * *';

async function main() {
  const mode = process.argv[2] ?? 'once';
  if (mode === 'daemon') {
    logger.info({ schedule }, 'Starting scheduler');
    
    // Schedule the cron job
    const task = cron.schedule(schedule, async () => {
      const runId = Date.now();
      logger.info({ runId }, 'Scheduled run started');
      try {
        await runOnce();
        logger.info({ runId }, 'Scheduled run completed successfully');
      } catch (e) {
        logger.error({ e, runId }, 'Scheduled run failed');
      }
      // Session is already closed in runOnce(), ready for next scheduled run
    });
    
    // Keep the process alive for scheduled runs
    logger.info('Scheduler is running. Press Ctrl+C to stop.');
    logger.info({ 
      currentTime: new Date().toISOString(),
      nextRun: task.getNextRun()?.toISOString()
    }, 'Next scheduled run');
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Scheduler shutting down');
      task.stop();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      logger.info('Scheduler shutting down');
      task.stop();
      process.exit(0);
    });
    
    // Keep the process alive indefinitely
    setInterval(() => {
      // Just keep the process alive
    }, 1000);
    
  } else {
    await runOnce();
  }
}

main().catch((e) => {
  logger.error({ e }, 'Fatal error');
  process.exitCode = 1;
});


