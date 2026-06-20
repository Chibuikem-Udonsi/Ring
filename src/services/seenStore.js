import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { getFirebaseDb, isFirebaseActive } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const SEEN_FILE = path.join(DATA_DIR, 'seen_items.json');

// How long to keep seen items before pruning (48 hours)
const PRUNE_AGE_MS = 48 * 60 * 60 * 1000;

let seenItems = {};

/**
 * Generate a stable hash for a news item to use as a dedup key.
 * Prefers sourceUrl; falls back to title+sourceName.
 */
export function hashItem(item) {
  const raw = item.sourceUrl || `${item.summary || item.title}::${item.sourceName}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

/**
 * Load seen items from disk or Firebase. Call once at startup.
 */
export async function loadSeen() {
  if (isFirebaseActive()) {
    try {
      const dbRef = getFirebaseDb();
      const snapshot = await dbRef.ref('seen_items').once('value');
      seenItems = snapshot.val() || {};
      console.log(`[SeenStore] Loaded ${Object.keys(seenItems).length} seen items from Firebase.`);
    } catch (err) {
      console.error('[SeenStore] Failed to load seen items from Firebase:', err.message);
      seenItems = {};
    }
    return;
  }

  try {
    if (fs.existsSync(SEEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'));
      seenItems = data || {};
      console.log(`[SeenStore] Loaded ${Object.keys(seenItems).length} seen items from local disk.`);
    } else {
      seenItems = {};
      console.log('[SeenStore] No existing seen-items file. Starting fresh.');
    }
  } catch (err) {
    console.error('[SeenStore] Failed to load seen items from local disk:', err.message);
    seenItems = {};
  }
}

/**
 * Save seen items to disk or Firebase. Auto-prunes entries older than PRUNE_AGE_MS.
 */
export async function saveSeen() {
  try {
    // Prune old entries
    const now = Date.now();
    const pruned = {};
    for (const [hash, entry] of Object.entries(seenItems)) {
      if (now - entry.firstSeen < PRUNE_AGE_MS) {
        pruned[hash] = entry;
      }
    }
    seenItems = pruned;

    if (isFirebaseActive()) {
      const dbRef = getFirebaseDb();
      await dbRef.ref('seen_items').set(seenItems);
      console.log('[SeenStore] Saved seen items to Firebase.');
      return;
    }

    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    fs.writeFileSync(SEEN_FILE, JSON.stringify(seenItems, null, 2), 'utf8');
    console.log('[SeenStore] Saved seen items to local disk.');
  } catch (err) {
    console.error('[SeenStore] Failed to save seen items:', err.message);
  }
}

/**
 * Check if an item has already been seen.
 */
export function isItemSeen(item) {
  const hash = hashItem(item);
  return !!seenItems[hash];
}

/**
 * Mark an item as seen.
 * @param {Object} item - The news item
 * @param {boolean} alerted - Whether a push notification was sent for this item
 */
export function markItemSeen(item, alerted = false) {
  const hash = hashItem(item);
  seenItems[hash] = {
    firstSeen: Date.now(),
    alerted,
    summary: (item.summary || '').slice(0, 80)
  };
}

/**
 * Get count of currently tracked seen items.
 */
export function getSeenCount() {
  return Object.keys(seenItems).length;
}
