import cron from 'node-cron';
import { runAlertPoll } from './alertEngine.js';
import { loadSeen } from './seenStore.js';
import { generateAndSaveDailyBrief } from './briefService.js';

let alertPollJob = null;
let dailyBriefJob = null;

/**
 * Start the alert polling and daily brief scheduler.
 * Runs the fetch+summarize+alert pipeline on a cron schedule.
 */
export async function startScheduler() {
  const pollInterval = process.env.POLL_INTERVAL_MINUTES || '15';
  const pollCronExpression = `*/${pollInterval} * * * *`;
  
  // Daily brief cron: daily at 6:00 AM
  const briefCronExpression = '0 6 * * *';

  // Load seen items store at startup
  await loadSeen();

  console.log('[Scheduler] ================================================');
  console.log(`[Scheduler] Alert polling scheduled: every ${pollInterval} minutes`);
  console.log(`[Scheduler] Cron expression: ${pollCronExpression}`);
  console.log(`[Scheduler] Daily brief scheduled: 6:00 AM daily`);
  console.log(`[Scheduler] Cron expression: ${briefCronExpression}`);
  console.log('[Scheduler] ================================================');

  // 1. Alert Polling Job
  alertPollJob = cron.schedule(pollCronExpression, async () => {
    console.log(`[Scheduler] Alert poll cron triggered at ${new Date().toISOString()}`);
    try {
      await runAlertPoll();
    } catch (err) {
      console.error('[Scheduler] Alert poll error:', err.message);
    }
  }, {
    scheduled: true,
    timezone: 'Africa/Lagos' // WAT (UTC+1) — Kamsi's timezone
  });

  // 2. Daily Brief Generation Job
  dailyBriefJob = cron.schedule(briefCronExpression, async () => {
    console.log(`[Scheduler] Daily brief cron triggered at ${new Date().toISOString()}`);
    try {
      await generateAndSaveDailyBrief();
    } catch (err) {
      console.error('[Scheduler] Daily brief cron error:', err.message);
    }
  }, {
    scheduled: true,
    timezone: 'Africa/Lagos' // WAT (UTC+1) — Kamsi's timezone
  });

  // Run an initial daily brief generation immediately on startup (with a small 5-second delay to not block server startup)
  setTimeout(async () => {
    console.log('[Scheduler] Running initial daily brief generation on startup...');
    try {
      await generateAndSaveDailyBrief();
    } catch (err) {
      console.error('[Scheduler] Initial daily brief generation error:', err.message);
    }
  }, 5000);

  // Run an initial poll 30 seconds after server startup
  // (gives the server time to fully initialize and lets the initial brief run first)
  setTimeout(async () => {
    console.log('[Scheduler] Running initial alert poll on startup...');
    try {
      await runAlertPoll();
    } catch (err) {
      console.error('[Scheduler] Initial alert poll error:', err.message);
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
  if (dailyBriefJob) {
    dailyBriefJob.stop();
    console.log('[Scheduler] Daily brief scheduler stopped.');
  }
}
