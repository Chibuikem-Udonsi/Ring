import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFirebaseDb, isFirebaseActive } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const SUBS_FILE = path.join(DATA_DIR, 'push_subscriptions.json');
const ALERT_LOG_FILE = path.join(DATA_DIR, 'alert_log.json');

let subscriptions = [];
let alertLog = { date: '', count: 0, alerts: [] };

/**
 * Initialize VAPID keys and Web Push configuration.
 * Auto-generates keys if not present in environment.
 */
export async function initializePushService() {
  let publicKey = process.env.VAPID_PUBLIC_KEY;
  let privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL || 'mailto:ring@example.com';

  if (!publicKey || !privateKey) {
    console.log('[Push] No VAPID keys found in environment. Generating new key pair...');
    const vapidKeys = webpush.generateVAPIDKeys();
    publicKey = vapidKeys.publicKey;
    privateKey = vapidKeys.privateKey;

    // Append to .env file for persistence
    const envPath = path.join(__dirname, '../../.env');
    try {
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }
      if (!envContent.includes('VAPID_PUBLIC_KEY')) {
        envContent += `\nVAPID_PUBLIC_KEY=${publicKey}\n`;
      }
      if (!envContent.includes('VAPID_PRIVATE_KEY')) {
        envContent += `VAPID_PRIVATE_KEY=${privateKey}\n`;
      }
      if (!envContent.includes('VAPID_EMAIL')) {
        envContent += `VAPID_EMAIL=${email}\n`;
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('[Push] VAPID keys generated and saved to .env file.');
    } catch (err) {
      console.error('[Push] Could not write VAPID keys to .env:', err.message);
    }

    // Set in current process
    process.env.VAPID_PUBLIC_KEY = publicKey;
    process.env.VAPID_PRIVATE_KEY = privateKey;
  }

  webpush.setVapidDetails(email, publicKey, privateKey);
  console.log('[Push] Web Push configured with VAPID keys.');
  console.log(`[Push] Public Key: ${publicKey.slice(0, 20)}...`);

  // Load existing subscriptions and alert log
  await loadSubscriptions();
  await loadAlertLog();
}

/**
 * Get the public VAPID key for client-side subscription.
 */
export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || '';
}

// --- Subscription Management ---

async function loadSubscriptions() {
  if (isFirebaseActive()) {
    try {
      const dbRef = getFirebaseDb();
      const snapshot = await dbRef.ref('push_subscriptions').once('value');
      subscriptions = snapshot.val() || [];
      console.log(`[Push] Loaded ${subscriptions.length} push subscription(s) from Firebase.`);
    } catch (err) {
      console.error('[Push] Failed to load subscriptions from Firebase:', err.message);
      subscriptions = [];
    }
    return;
  }

  try {
    if (fs.existsSync(SUBS_FILE)) {
      subscriptions = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8'));
      console.log(`[Push] Loaded ${subscriptions.length} push subscription(s) from local file.`);
    }
  } catch (err) {
    console.error('[Push] Failed to load subscriptions from local file:', err.message);
    subscriptions = [];
  }
}

async function saveSubscriptions() {
  if (isFirebaseActive()) {
    try {
      const dbRef = getFirebaseDb();
      await dbRef.ref('push_subscriptions').set(subscriptions);
      console.log('[Push] Saved push subscriptions to Firebase.');
    } catch (err) {
      console.error('[Push] Failed to save subscriptions to Firebase:', err.message);
    }
    return;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subscriptions, null, 2), 'utf8');
    console.log('[Push] Saved push subscriptions to local file.');
  } catch (err) {
    console.error('[Push] Failed to save subscriptions to local file:', err.message);
  }
}

/**
 * Add a new push subscription.
 */
export async function addSubscription(subscription) {
  // Avoid duplicate subscriptions (by endpoint)
  const exists = subscriptions.some(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    subscriptions.push(subscription);
    await saveSubscriptions();
    console.log(`[Push] New subscription added. Total: ${subscriptions.length}`);
    return true;
  }
  console.log('[Push] Subscription already exists. Skipping.');
  return false;
}

/**
 * Remove a push subscription by endpoint.
 */
export async function removeSubscription(endpoint) {
  const before = subscriptions.length;
  subscriptions = subscriptions.filter(s => s.endpoint !== endpoint);
  if (subscriptions.length < before) {
    await saveSubscriptions();
    console.log(`[Push] Subscription removed. Total: ${subscriptions.length}`);
    return true;
  }
  return false;
}

// --- Alert Log & Rate Limiting ---

async function loadAlertLog() {
  const today = new Date().toISOString().split('T')[0];

  if (isFirebaseActive()) {
    try {
      const dbRef = getFirebaseDb();
      const snapshot = await dbRef.ref('alert_log').once('value');
      alertLog = snapshot.val() || { date: today, count: 0, alerts: [] };
      console.log(`[Push] Loaded alert log from Firebase. Today: ${today}, Log date: ${alertLog.date}`);
    } catch (err) {
      console.error('[Push] Failed to load alert log from Firebase:', err.message);
      alertLog = { date: today, count: 0, alerts: [] };
    }

    if (alertLog.date !== today) {
      alertLog = { date: today, count: 0, alerts: [] };
      await saveAlertLog();
    }
    return;
  }

  try {
    if (fs.existsSync(ALERT_LOG_FILE)) {
      alertLog = JSON.parse(fs.readFileSync(ALERT_LOG_FILE, 'utf8'));
    }
  } catch (err) {
    alertLog = { date: today, count: 0, alerts: [] };
  }
  // Reset if it's a new day
  if (alertLog.date !== today) {
    alertLog = { date: today, count: 0, alerts: [] };
    await saveAlertLog();
  }
}

async function saveAlertLog() {
  if (isFirebaseActive()) {
    try {
      const dbRef = getFirebaseDb();
      await dbRef.ref('alert_log').set(alertLog);
      console.log('[Push] Saved alert log to Firebase.');
    } catch (err) {
      console.error('[Push] Failed to save alert log to Firebase:', err.message);
    }
    return;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(ALERT_LOG_FILE, JSON.stringify(alertLog, null, 2), 'utf8');
    console.log('[Push] Saved alert log to local file.');
  } catch (err) {
    console.error('[Push] Failed to save alert log to local file:', err.message);
  }
}

/**
 * Check how many alerts have been sent today.
 */
export function getAlertCountToday() {
  const today = new Date().toISOString().split('T')[0];
  if (alertLog.date !== today) {
    alertLog = { date: today, count: 0, alerts: [] };
  }
  return alertLog.count;
}

/**
 * Get the max alerts per day from config.
 */
export function getMaxAlertsPerDay() {
  return parseInt(process.env.ALERT_MAX_PER_DAY, 10) || 5;
}

/**
 * Check if we can still send alerts today.
 */
export function canSendAlert() {
  return getAlertCountToday() < getMaxAlertsPerDay();
}

/**
 * Send a push notification for an alert-worthy item.
 * @param {Object} item - The news item { summary, sourceUrl, sourceName }
 * @returns {Promise<number>} Number of successful deliveries
 */
export async function sendAlert(item) {
  if (subscriptions.length === 0) {
    console.log('[Push] No subscriptions registered. Skipping alert.');
    return 0;
  }

  // Build notification payload
  const payload = JSON.stringify({
    title: '⚡ Ring Alert',
    body: item.summary.length > 120 ? item.summary.slice(0, 117) + '...' : item.summary,
    url: item.sourceUrl || '/',
    tag: `ring-alert-${Date.now()}`,
    sourceName: item.sourceName || 'Ring'
  });

  let successCount = 0;
  const failedEndpoints = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      successCount++;
    } catch (err) {
      console.error(`[Push] Failed to send to ${sub.endpoint.slice(0, 50)}...:`, err.statusCode || err.message);
      // 410 Gone = subscription expired, remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        failedEndpoints.push(sub.endpoint);
      }
    }
  }

  // Clean up expired subscriptions
  if (failedEndpoints.length > 0) {
    subscriptions = subscriptions.filter(s => !failedEndpoints.includes(s.endpoint));
    await saveSubscriptions();
    console.log(`[Push] Removed ${failedEndpoints.length} expired subscription(s).`);
  }

  // Update alert log
  alertLog.count++;
  alertLog.alerts.push({
    time: new Date().toISOString(),
    summary: item.summary.slice(0, 80),
    sourceUrl: item.sourceUrl
  });
  await saveAlertLog();

  console.log(`[Push] Alert sent to ${successCount}/${subscriptions.length} subscriber(s).`);
  return successCount;
}

/**
 * Get recent alerts for the API.
 */
export function getRecentAlerts() {
  return alertLog.alerts || [];
}
