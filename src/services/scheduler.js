import cron from 'node-cron';
import { runAlertPoll } from './alertEngine.js';
import { loadSeen } from './seenStore.js';

let alertPollJob = null;

/**
 * Start the alert polling scheduler.
 * Runs the fetch+summarize+alert pipeline on a cron schedule.
 */
export async function startScheduler() {
  const pollInterval = process.env.POLL_INTERVAL_MINUTES || '15';
  const cronExpression = `*/${pollInterval} * * * *`;

  // Load seen items store at startup
  await loadSeen();

  console.log('[Scheduler] ================================================');
  console.log(`[Scheduler] Alert polling scheduled: every ${pollInterval} minutes`);
  console.log(`[Scheduler] Cron expression: ${cronExpression}`);
  console.log('[Scheduler] ================================================');

  alertPollJob = cron.schedule(cronExpression, async () => {
    console.log(`[Scheduler] Cron triggered at ${new Date().toISOString()}`);
    try {
      await runAlertPoll();
    } catch (err) {
      console.error('[Scheduler] Alert poll error:', err.message);
    }
  }, {
    scheduled: true,
    timezone: 'Africa/Lagos' // WAT (UTC+1) — Kamsi's timezone
  });

  // Run an initial poll 30 seconds after server startup
  // (gives the server time to fully initialize)
  setTimeout(async () => {
    console.log('[Scheduler] Running initial poll on startup...');
    try {
      await runAlertPoll();
    } catch (err) {
      console.error('[Scheduler] Initial poll error:', err.message);
    }
  }, 30000);
}

/**
 * Stop the scheduler cleanly.
 */
export function stopScheduler() {
  if (alertPollJob) {
    alertPollJob.stop();
    console.log('[Scheduler] Alert polling stopped.');
  }
}
