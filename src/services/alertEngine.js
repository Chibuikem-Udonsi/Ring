import { fetchAndSummarizeNews } from './briefService.js';
import { isItemSeen, markItemSeen, saveSeen, getSeenCount } from './seenStore.js';
import { canSendAlert, sendAlert, getAlertCountToday, getMaxAlertsPerDay } from './pushService.js';

let isPolling = false;

/**
 * Run a single alert polling cycle.
 * Fetches news, summarizes via LLM, checks for new flagged items, and sends alerts.
 */
export async function runAlertPoll() {
  if (isPolling) {
    console.log('[AlertEngine] Poll already in progress. Skipping.');
    return { skipped: true };
  }

  isPolling = true;
  const startTime = Date.now();
  console.log('\n===================================================');
  console.log('       RING ALERT POLL — ' + new Date().toISOString());
  console.log('===================================================');

  try {
    console.log('[AlertEngine] Fetching and summarizing news...');
    const brief = await fetchAndSummarizeNews();

    if (!brief) {
      console.log('[AlertEngine] No articles fetched. Ending poll.');
      return { newItems: 0, alertsSent: 0 };
    }

    // 3. Check all tech/AI items for new, flagged content
    const allItems = [
      ...(brief.techAi || []).map(item => ({ ...item, category: 'techAi' })),
      ...(brief.general || []).map(item => ({ ...item, category: 'general', flagged: false }))
    ];

    let newItemCount = 0;
    let alertsSent = 0;
    const alertCandidates = [];

    for (const item of allItems) {
      if (isItemSeen(item)) {
        continue; // Already processed
      }

      newItemCount++;
      markItemSeen(item, false); // Mark as seen regardless

      // Only flagged items are alert candidates
      if (item.flagged) {
        alertCandidates.push(item);
      }
    }

    // 4. Rate-limit and send alerts
    for (const candidate of alertCandidates) {
      if (!canSendAlert()) {
        console.log(`[AlertEngine] Daily alert cap reached (${getAlertCountToday()}/${getMaxAlertsPerDay()}). Suppressing remaining alerts.`);
        break;
      }

      console.log(`[AlertEngine] 🔔 ALERT-WORTHY: "${candidate.summary.slice(0, 80)}..."`);
      const sent = await sendAlert(candidate);
      if (sent > 0) {
        markItemSeen(candidate, true); // Update: alerted = true
        alertsSent++;
      }
    }

    // 5. Persist seen store
    saveSeen();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[AlertEngine] Poll complete in ${elapsed}s. New items: ${newItemCount}, Alerts sent: ${alertsSent}, Seen store: ${getSeenCount()} items.`);
    console.log('===================================================\n');

    return { newItems: newItemCount, alertsSent, elapsed };

  } catch (error) {
    console.error('[AlertEngine] Poll failed:', error.message);
    return { error: error.message };
  } finally {
    isPolling = false;
  }
}
