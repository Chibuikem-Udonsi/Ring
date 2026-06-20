# Ring — Handoff State
Last updated: 2026-06-20

## Where things stand
Milestone M4 (Render Cloud Deployment & Stateless Persistence) is fully implemented and locally verified. The codebase features:
- Complete Firebase Realtime Database persistence for daily briefs, push subscriptions (`/push_subscriptions`), seen items deduplication (`/seen_items`), and alert logs (`/alert_log`).
- A fully stateless server architecture ready to run on ephemeral cloud systems like Render's free tier.
- A public `/api/health` check endpoint for monitoring and uptime pings.
- Secure `POST /api/poll/trigger` token authorization via `API_TRIGGER_TOKEN` env var to prevent unauthorized crawler execution.
- Blueprint configuration file (`render.yaml`) to automate service setup on Render.

## What's next
1. **Deploy to Render**:
   - Create a new service on Render by importing the repository or using the Blueprint (`render.yaml`).
   - Configure the environment variables on the Render Dashboard (Gemini key, NewsAPI key, VAPID credentials, and Firebase config).
2. **Setup Uptime Keep-Alive**:
   - Configure a free [UptimeRobot](https://uptimerobot.com/) or [Better Uptime](https://betterstack.com/) monitor to ping `https://your-app.onrender.com/api/health` (or the home page `/`) every 10 minutes to prevent the container from sleeping and keep the background polling active.
3. **Calibrate Alerts**:
   - Fine-tune Gemini summarization prompts and flagging logic in `prompts.js` to ensure the most relevant news triggers push notifications.

## Known issues
- **Flagging Calibration**: Some minor financial updates may occasionally trigger alerts, which can be tuned in `prompts.js`.

## Do NOT retry
- Do not store push subscriptions or seen items locally in the file system when running on Render; they will be deleted when the instance spins down. Always configure the Firebase database variables on production.
- Do not let public trigger endpoints remain unsecured; always set `API_TRIGGER_TOKEN` on the live server.
