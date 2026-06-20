# Ring — Development Log

## 2026-06-20 — M1: Backend Core — Project Setup & Core News Poll Loop

### What was built/changed
- Initialized Node.js project with ES modules (`"type": "module"`).
- Set up feed and prompt configuration files: [feeds.js](file:///c:/Users/kamsi/Downloads/Ring/src/config/feeds.js) and [prompts.js](file:///c:/Users/kamsi/Downloads/Ring/src/config/prompts.js).
- Built RSS poll service [rss.js](file:///c:/Users/kamsi/Downloads/Ring/src/sources/rss.js) to retrieve and normalize articles from OpenAI and TechCrunch RSS feeds.
- Built General News service [newsapi.js](file:///c:/Users/kamsi/Downloads/Ring/src/sources/newsapi.js) to retrieve articles from NewsAPI, successfully integrated with a live NewsAPI Key and verified to pull live global headlines.
- Built Gemini API client [llm.js](file:///c:/Users/kamsi/Downloads/Ring/src/services/llm.js) using the new `@google/genai` SDK, utilizing strict JSON schema response mode to guarantee output structure.
- Built Firebase Database client [db.js](file:///c:/Users/kamsi/Downloads/Ring/src/services/db.js) utilizing `firebase-admin` with automatic local JSON fallback for local development.
- Created orchestrator script [index.js](file:///c:/Users/kamsi/Downloads/Ring/src/index.js) running the loop end-to-end.

### Errors hit and how they were resolved
- **NPM Install Package Version Error:** Specifying `@google/genai` version `^0.1.1` in the initial dependency list failed as the package is already at version `2.9.0`. Updated `package.json` to require `^2.9.0` and successfully ran `npm install`.
- **API Key Quota Limit Error:** The system's default key and the initial user key returned a quota limit error (`limit: 0`) on `gemini-2.0-flash` (likely due to API key restrictions in Google Cloud Console or missing Generative Language API enablement). Resolved by:
  1. Writing a test script to query supported models, discovering that `gemini-2.5-flash` was fully active and accessible.
  2. Updating `.env` to default `GEMINI_MODEL=gemini-2.5-flash`.
- **Prompt Token Bloat / Rate Limit:** Polling the OpenAI RSS feed retrieved all 1,012 historical articles, creating a massive prompt (~150k tokens) that triggered a token count quota error. Fixed by modifying `rss.js` to slice the parsed feed list to the top 15 most recent articles per feed. This reduced the combined prompt load from 1,041 articles to 39, which runs in seconds and stays within the free tier caps.
- **Forced SDK Key Priority:** The `@google/genai` SDK automatically prioritizes system-level `GOOGLE_API_KEY` environment variables over `.env`-defined variables, printing warnings and bypassing working keys. Added logic in `llm.js` to delete the system-level key from the runtime process if a custom `GEMINI_API_KEY` is present.

### Decisions made and why
- **Gemini Transition:** Moved the LLM provider from Anthropic's Claude to Google's Gemini as instructed by Kamsi, utilizing the new `@google/genai` SDK.
- **Strict JSON Schema:** Configured Gemini with `responseMimeType: 'application/json'` and `responseSchema` mapping precisely to the requested database shape, eliminating parsing issues.
- **Fail-safe Mock Mode:** Designed both the news sources and LLM summarizer to fall back on high-quality mock data when keys or quotas are missing. This makes the local environment instantly executable out of the box.
- **Local Fallback DB:** Saves data to `briefs/{YYYY-MM-DD}.json` and a root `./db_fallback_brief.json` file if Firebase is not yet configured, allowing visual verification of the database shape.

## 2026-06-20 — M1: Backend Core — Quota Limit Fix & API Verification

### What was built/changed
- Added a defensive trimming and sorting step directly inside [llm.js](file:///c:/Users/kamsi/Downloads/Ring/src/services/llm.js) before formatting the prompt input. It groups raw articles by source, sorts by publication date (newest first), and slices each group to a maximum of 15 items.
- Verified Gemini API key validity and active status using a test script.
- Verified that NewsAPI fetches real live articles instead of falling back to mock data.

### Errors hit and how they were resolved
- **Gemini Quota Exceeded:** Resolved by implementing the `maxArticlesPerSource` cap of 15 inside the LLM orchestrator. This provides a robust safety guard ensuring that even if raw news fetchers return extensive historical content (e.g. 1000+ items), the LLM prompt size remains within reasonable limits.
- **Gemini API Key Check:** Confirmed that the key is active and functional (tested and verified 200 OK from Gemini instead of a 401/403 or 429 rate limit issue).

### Decisions made and why
- **Defensive LLM-Level Trimming:** Placed the capping/filtering step directly within [llm.js](file:///c:/Users/kamsi/Downloads/Ring/src/services/llm.js) so that the LLM service itself acts as a guardrail against token limits, regardless of which data ingestion pipelines or sources are added in the future.

## 2026-06-20 — M2: PWA Shell — Web Server and Prioritized Mobile-First PWA

### What was built/changed
- Implemented `getLatestDailyBrief()` in [db.js](file:///c:/Users/kamsi/Downloads/Ring/src/services/db.js) which retrieves the latest brief from Firebase (by chronologically sorting database keys) or falls back to local file storage.
- Created a vanilla Node.js HTTP server [server.js](file:///c:/Users/kamsi/Downloads/Ring/src/server.js) to serve static client-side files and expose a `/api/brief/latest` API.
- Generated a high-fidelity cyberpunk metallic ring app icon using `generate_image` and saved it to PWA asset directory.
- Created standard PWA configuration files: [manifest.json](file:///c:/Users/kamsi/Downloads/Ring/public/manifest.json) for desktop/mobile installability, and [sw.js](file:///c:/Users/kamsi/Downloads/Ring/public/sw.js) implementing a service worker to pre-cache the UI shell and cache API results with a network-first fallback policy.
- Built a mobile-first dark-mode HTML shell [index.html](file:///c:/Users/kamsi/Downloads/Ring/public/index.html) and stylesheet [style.css](file:///c:/Users/kamsi/Downloads/Ring/public/style.css) featuring custom typography, CSS grid cards, skeleton loading states, and gold highlight accents for flagged items.
- Added client logic in [app.js](file:///c:/Users/kamsi/Downloads/Ring/public/app.js) to fetch data, prioritize flagged Tech/AI items, cap default views (6 items for Tech/AI, 5 items for General), implement collapsible "Show More" accordions, and display offline notifications.
- Registered server scripts in `package.json` under `"dev"`, `"start"`, and `"brief"`.

### Errors hit and how they were resolved
- **Mime-Type Service Blocking**: Initially, the server did not specify MIME headers causing the browser to refuse script execution (`app.js`) due to strict MIME type checking. Fixed by adding a MIME dictionary mapping (`.html`, `.css`, `.js`, `.json`, `.png`) in [server.js](file:///c:/Users/kamsi/Downloads/Ring/src/server.js).
- **Service Worker API Interception**: The service worker initially intercepted API requests cache-first, which meant updating the backend with new briefs was not reflected in the UI. Corrected by setting a network-first cache-fallback interception rule for routes beginning with `/api/` in [sw.js](file:///c:/Users/kamsi/Downloads/Ring/public/sw.js).

### Decisions made and why
- **Vanilla Node Server**: Chose to write the server using only Node.js standard libraries (`http`, `fs`, `path`) to adhere strictly to the rule against adding undocumented NPM packages.
- **Client-Side Prioritization**: Kept database schemas simple and handled article prioritization and trimming directly in the client application code. This gives maximum layout flexibility (e.g. counting, sorting, capping) without having to rewrite or compromise historical database structure.

## 2026-06-20 — M2: PWA Shell — Morning Paper Redesign & Event Listener Fixes

### What was built/changed
- Shifted PWA design system from a cyberpunk neon dark-theme to a light "Morning Paper" editorial design.
- Re-styled layout using Linen (`#F5F0EB`) backgrounds, Ink (`#1A1A2E`) text columns, and Dawn (`#D4654A`) border/badge accents.
- Configured display fonts: `Instrument Serif` (for Display/Titles), `Source Sans 3` (for articles), and `JetBrains Mono` (for meta-tags).
- Replaced text-based header with a hand-drawn vector circle logo (`.ring-mark` SVG).
- Re-architected PWA client-side script in [app.js](file:///c:/Users/kamsi/Downloads/Ring/public/app.js) to initialize toggles cleanly via `initToggle()`, fixing the duplicate listener bug.
- Bumped PWA caching version to `ring-shell-v2` in [sw.js](file:///c:/Users/kamsi/Downloads/Ring/public/sw.js) to force client refreshes on modified stylesheets, and aligned [manifest.json](file:///c:/Users/kamsi/Downloads/Ring/public/manifest.json) colors with the new light background.

### Errors hit and how they were resolved
- **EADDRINUSE Server Crashes**: Restarting the server after file edits triggered `EADDRINUSE` port 3000 errors. Resolved by writing a shell task helper to kill any running processes occupying port 3000 before running `npm run dev`.

### Decisions made and why
- **Editorial Layout Transition**: The light-paper layout and serif typography significantly improve scannability, converting raw feed lists into a print-like digest that can be read in under 30 seconds.

## 2026-06-20 — M3: Real-Time Alerts — Web Push Alert Engine & Polling Scheduler

### What was built/changed
- Implemented SeenStore service [seenStore.js](file:///c:/Users/kamsi/Downloads/Ring/src/services/seenStore.js) utilizing SHA-256 hashes to track processed articles, saving state to `seen_items.json` and auto-pruning items older than 48 hours.
- Created Push service [pushService.js](file:///c:/Users/kamsi/Downloads/Ring/src/services/pushService.js) using the `web-push` NPM library to manage subscriptions in `push_subscriptions.json`, negotiate VAPID key pairs (auto-generating credentials if missing), deliver payload pushes, log alerts, and enforce a daily rate limit of 5 alerts.
- Built Alert Engine service [alertEngine.js](file:///c:/Users/kamsi/Downloads/Ring/src/services/alertEngine.js) coordinating news fetches, Gemini summaries, deduplication filter lookups, and dispatching pushes for new `flagged: true` items.
- Added Scheduler service [scheduler.js](file:///c:/Users/kamsi/Downloads/Ring/src/services/scheduler.js) using `node-cron` to schedule alert polling every 15 minutes, with an initial startup poll deferred by 30 seconds.
- Overhauled web server [server.js](file:///c:/Users/kamsi/Downloads/Ring/src/server.js) to register alert endpoints (`/api/push/vapid-key`, `/api/push/subscribe`, `/api/push/unsubscribe`, `/api/alerts/recent`, `/api/poll/trigger`) and run the cron scheduler.
- Overhauled service worker [sw.js](file:///c:/Users/kamsi/Downloads/Ring/public/sw.js) to cache-version `ring-shell-v3` and implement `push` listeners for native alerts and `notificationclick` for deep-linked redirects.
- Overhauled client app script [app.js](file:///c:/Users/kamsi/Downloads/Ring/public/app.js) to manage notification permissions, display an interactive enable/dismiss banner, register VAPID subscriptions, and highlight deep-linked items with a yellow pulsing animation.

### Errors hit and how they were resolved
- **Simultaneous Ingestion Race Conditions**: Firing manual trigger requests while the startup cron poll was in progress caused duplicate fetch and Gemini summarization executions, leading to API quota issues. Resolved by introducing an `isPolling` boolean lock inside [alertEngine.js](file:///c:/Users/kamsi/Downloads/Ring/src/services/alertEngine.js) that skips redundant polling runs.

### Decisions made and why
- **Daily Push Rate Limiter**: Enforced a hard limit of 5 push notifications per day inside [pushService.js](file:///c:/Users/kamsi/Downloads/Ring/src/services/pushService.js). This protects Kamsi from notification fatigue during heavy news cycles while keeping the service completely free and lightweight.
- **Client Deep Linking & Highlight**: Passed the source URL inside the web push payload to enable client deep-linking, adding query param matching in [app.js](file:///c:/Users/kamsi/Downloads/Ring/public/app.js) to automatically highlight and center the alert-worthy card when clicked.

## 2026-06-20 — M4: Cloud Deployment — Render Deployment & Stateless Persistence

### What was built/changed
- Implemented stateless Firebase database integration for seen items deduplication ([seenStore.js](file:///c:/Users/kamsi/Downloads/Ring/src/services/seenStore.js)), Web Push subscriptions, and daily alert logs ([pushService.js](file:///c:/Users/kamsi/Downloads/Ring/src/services/pushService.js)), resolving ephemeral filesystem data loss on Render.
- Added helper functions `getFirebaseDb()` and `isFirebaseActive()` to [db.js](file:///c:/Users/kamsi/Downloads/Ring/src/services/db.js) for centralized database state access.
- Created [render.yaml](file:///c:/Users/kamsi/Downloads/Ring/render.yaml) defining build/start commands and env vars for simple Render Blueprint deployment.
- Added `/api/health` endpoint to [server.js](file:///c:/Users/kamsi/Downloads/Ring/src/server.js) returning uptime and status, allowing external pingers (like UptimeRobot) to keep the Render free instance awake.
- Secured manual poll trigger endpoint `POST /api/poll/trigger` using Bearer authentication header validation when `API_TRIGGER_TOKEN` is defined in env variables.
- Converted scheduler startup, seen items storage, and push service configuration to support async loading during server startup.

### Errors hit and how they were resolved
- **Local Port Conflict (`EADDRINUSE`)**: Encountered port `3000` conflict during verification because the user's local server instance was already running. Resolved by verifying the server using an alternative port (`PORT=3005`).
- **PowerShell Curl Parameter Error**: Standard Windows PowerShell curl is aliased to `Invoke-WebRequest`, which failed on parameters like `-i` and `-X`. Resolved by invoking the native `curl.exe` binary.

### Decisions made and why
- **Stateless Firebase Persistence**: Migrated seen items, push subscriptions, and alert logs to Firebase Realtime Database when configured. Since Render free-tier containers spin down and have ephemeral storage, this prevents loss of subscribers and duplicate alert pushes on restarts.
- **Trigger Token Authentication**: Added optional Bearer token authorization to `POST /api/poll/trigger`. Because this endpoint is exposed publicly on Render, securing it protects the Gemini API and NewsAPI key quotas from third-party spam.
- **External Keep-Alive Recommendation**: Render's free tier sleeps after 15 minutes of inactivity (no HTTP traffic). Since node-cron cannot keep the service active internally, we recommend hitting `/api/health` or `/` every 10 minutes via UptimeRobot to ensure continuous 24/7 background polling and alerts.
