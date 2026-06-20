import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let db = null;
let isFirebaseConfigured = false;

/**
 * Initializes the Firebase Admin SDK using credentials from environment variables.
 * Falls back gracefully to local storage if config is missing.
 */
export function initializeDatabase() {
  const dbUrl = process.env.FIREBASE_DATABASE_URL;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';

  if (!dbUrl) {
    console.log('FIREBASE_DATABASE_URL not set in environment. Firebase operations will use local file fallback.');
    return;
  }

  try {
    let credential;
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      credential = admin.credential.cert(serviceAccount);
      console.log('Firebase initialized using service account file:', serviceAccountPath);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      credential = admin.credential.cert(serviceAccount);
      console.log('Firebase initialized using FIREBASE_SERVICE_ACCOUNT_JSON environment variable.');
    } else {
      console.log(`Firebase service account file not found at ${serviceAccountPath} and no FIREBASE_SERVICE_ACCOUNT_JSON env var exists. Falling back to local storage.`);
      return;
    }

    admin.initializeApp({
      credential,
      databaseURL: dbUrl
    });

    db = admin.database();
    isFirebaseConfigured = true;
    console.log('Successfully connected to Firebase Realtime Database:', dbUrl);
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error.message);
    console.log('Falling back to local file storage.');
  }
}

/**
 * Saves a daily brief. Attempts Firebase first, then falls back to local file system.
 * @param {string} date - Date key (format: YYYY-MM-DD)
 * @param {Object} brief - The daily brief object
 * @returns {Promise<Object>} Status of the save operation
 */
export async function saveDailyBrief(date, brief) {
  const dataToSave = {
    generatedAt: Date.now(),
    general: brief.general || [],
    techAi: brief.techAi || []
  };

  if (isFirebaseConfigured && db) {
    try {
      console.log(`Saving daily brief for ${date} to Firebase Realtime Database (/briefs/${date})...`);
      const ref = db.ref(`briefs/${date}`);
      await ref.set(dataToSave);
      console.log('Successfully stored brief in Firebase.');
      return { success: true, storage: 'firebase' };
    } catch (error) {
      console.error('Failed to save brief to Firebase:', error.message);
      console.log('Falling back to local file system.');
    }
  }

  // Fallback: save locally
  try {
    const dir = './briefs';
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, `${date}.json`);
    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), 'utf8');

    // Also write a standard debug fallback file at the project root for easy viewing
    const rootFallbackPath = './db_fallback_brief.json';
    fs.writeFileSync(rootFallbackPath, JSON.stringify(dataToSave, null, 2), 'utf8');

    console.log(`Saved brief locally to:\n - ${filePath}\n - ${rootFallbackPath}`);
    return { success: true, storage: 'local', filePath };
  } catch (error) {
    console.error('Failed to write brief to local disk:', error.message);
    return { success: false, error };
  }
}

/**
 * Fetches the latest daily brief.
 * Tries Firebase Realtime Database first, then falls back to local storage files.
 * @returns {Promise<Object>} The latest daily brief data with date and storage source metadata
 */
export async function getLatestDailyBrief() {
  if (isFirebaseConfigured && db) {
    try {
      console.log('Fetching latest daily brief from Firebase Realtime Database (/briefs)...');
      const ref = db.ref('briefs');
      // Order keys alphabetically (which matches chronological date YYYY-MM-DD) and get the last one
      const snapshot = await ref.orderByKey().limitToLast(1).once('value');
      if (snapshot.exists()) {
        const val = snapshot.val();
        const keys = Object.keys(val);
        const latestKey = keys[0];
        console.log(`Successfully fetched latest brief for date ${latestKey} from Firebase.`);
        return { ...val[latestKey], date: latestKey, storage: 'firebase' };
      }
      console.log('No briefs found in Firebase. Checking local files.');
    } catch (error) {
      console.error('Failed to fetch latest brief from Firebase:', error.message);
      console.log('Falling back to local file system.');
    }
  }

  // Local fallback: search the ./briefs directory
  try {
    const dir = './briefs';
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.json') && f !== 'db_fallback_brief.json')
        .sort()
        .reverse(); // Newest first

      if (files.length > 0) {
        const latestFile = files[0];
        const filePath = path.join(dir, latestFile);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const dateKey = latestFile.replace('.json', '');
        console.log(`Successfully read latest local brief from ${filePath}`);
        return { ...data, date: dateKey, storage: 'local' };
      }
    }

    // Try reading root fallback file
    const rootFallbackPath = './db_fallback_brief.json';
    if (fs.existsSync(rootFallbackPath)) {
      const data = JSON.parse(fs.readFileSync(rootFallbackPath, 'utf8'));
      console.log(`Successfully read root fallback brief from ${rootFallbackPath}`);
      return { ...data, date: 'fallback', storage: 'local' };
    }

    throw new Error('No briefs available in either Firebase or local storage.');
  } catch (error) {
    console.error('Failed to retrieve latest daily brief:', error.message);
    throw error;
  }
}

/**
 * Returns the Firebase Database reference if configured, or null.
 */
export function getFirebaseDb() {
  return db;
}

/**
 * Returns true if Firebase database is active and connected.
 */
export function isFirebaseActive() {
  return isFirebaseConfigured;
}
