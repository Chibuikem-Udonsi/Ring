import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { initializeDatabase, getLatestDailyBrief } from './services/db.js';
import { initializePushService, getVapidPublicKey, addSubscription, removeSubscription, getRecentAlerts } from './services/pushService.js';
import { startScheduler } from './services/scheduler.js';
import { runAlertPoll } from './services/alertEngine.js';

// Resolve directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '../public');

// Initialize database configurations (Firebase or Local)
initializeDatabase();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * Parse JSON body from incoming request.
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send a JSON response.
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const reqUrl = req.url || '';
  const urlPath = reqUrl.split('?')[0]; // Strip query params for routing
  console.log(`[${new Date().toISOString()}] ${req.method} ${reqUrl}`);

  // CORS headers (for flexibility in local testing)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // -------------------------------------------------------
  // API Routes
  // -------------------------------------------------------

  // 0. GET /api/health — Health check endpoint
  if (req.method === 'GET' && urlPath === '/api/health') {
    sendJson(res, 200, {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
    return;
  }

  // 1. GET /api/brief/latest — Fetch latest brief
  if (req.method === 'GET' && urlPath === '/api/brief/latest') {
    try {
      const brief = await getLatestDailyBrief();
      sendJson(res, 200, brief);
    } catch (error) {
      sendJson(res, 500, { error: error.message || 'Failed to fetch latest brief' });
    }
    return;
  }

  // 2. GET /api/push/vapid-key — Return VAPID public key
  if (req.method === 'GET' && urlPath === '/api/push/vapid-key') {
    sendJson(res, 200, { publicKey: getVapidPublicKey() });
    return;
  }

  // 3. POST /api/push/subscribe — Register push subscription
  if (req.method === 'POST' && urlPath === '/api/push/subscribe') {
    try {
      const subscription = await parseJsonBody(req);
      if (!subscription.endpoint) {
        sendJson(res, 400, { error: 'Missing subscription endpoint' });
        return;
      }
      addSubscription(subscription);
      sendJson(res, 201, { success: true, message: 'Subscription registered' });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  // 4. POST /api/push/unsubscribe — Remove push subscription
  if (req.method === 'POST' && urlPath === '/api/push/unsubscribe') {
    try {
      const { endpoint } = await parseJsonBody(req);
      if (!endpoint) {
        sendJson(res, 400, { error: 'Missing endpoint' });
        return;
      }
      removeSubscription(endpoint);
      sendJson(res, 200, { success: true, message: 'Subscription removed' });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  // 5. GET /api/alerts/recent — Return recent alert history
  if (req.method === 'GET' && urlPath === '/api/alerts/recent') {
    sendJson(res, 200, { alerts: getRecentAlerts() });
    return;
  }

  // 6. POST /api/poll/trigger — Manually trigger an alert poll (for testing)
  if (req.method === 'POST' && urlPath === '/api/poll/trigger') {
    try {
      // Secure endpoint if API_TRIGGER_TOKEN is defined
      const triggerToken = process.env.API_TRIGGER_TOKEN;
      if (triggerToken) {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== triggerToken) {
          sendJson(res, 401, { error: 'Unauthorized' });
          return;
        }
      }

      console.log('[Server] Manual poll triggered via API.');
      const result = await runAlertPoll();
      sendJson(res, 200, { success: true, result });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  // -------------------------------------------------------
  // Static File Serving
  // -------------------------------------------------------
  // Prevent directory traversal attacks by resolving path and verifying it is inside PUBLIC_DIR
  let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);

  // If there's no extension, check if it's a static file request or if we should fallback
  const ext = path.extname(filePath).toLowerCase();

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // For SPA-like navigation, fall back to index.html if file doesn't exist
      const fallbackPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(fallbackPath, (fbErr, content) => {
        if (fbErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        }
      });
      return;
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
});

async function startServer() {
  try {
    // Initialize Web Push service asynchronously (VAPID keys, subscriptions)
    await initializePushService();

    server.listen(PORT, async () => {
      console.log(`===================================================`);
      console.log(`      RING SERVER RUNNING AT: http://localhost:${PORT} `);
      console.log(`      Serving static folder: ${PUBLIC_DIR}        `);
      console.log(`===================================================`);

      // Start the alert polling scheduler after server is listening
      await startScheduler();
    });
  } catch (error) {
    console.error('Fatal error starting Ring server:', error.message);
    process.exit(1);
  }
}

startServer();

