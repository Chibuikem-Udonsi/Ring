# Ring — Project Brief

## What Ring Is
Ring is a personal news agent. It wakes up, reads the world, and tells you what matters — as a daily brief when you start your day, and as instant alerts when something big drops (e.g. a major AI release). No X/Twitter doomscrolling required. No checking five apps. Ring checks for you.

## Why It Exists
Kamsi doesn't have the time or built-up habit to track news manually across platforms (especially X). Ring closes that gap with a single, smooth, native-feeling surface that delivers:
1. A daily brief — general news, tech, AI — every morning.
2. Real-time(ish) alerts — within ~15 minutes of something significant happening.

## Non-Goals (v1)
- No direct X/Twitter API integration (cost-prohibitive at this stage — revisit later if the gap is felt).
- No multi-user support. Ring is single-user (Kamsi only) for now.
- No native Android app yet — PWA first, native later, mirroring the Tether V1→V5 path.

## Core Coverage Areas
- General news
- Tech
- AI (with extra weight — this is the category most likely to trigger "big drop" alerts)
- (Future, M4+) Personal passions: robotics, chess, engineering — layered in once core loop is proven

## Architecture

```
SOURCES (RSS feeds: Anthropic, OpenAI, TechCrunch, Hacker News,
         NewsAPI/GNews for general news)
   │
   ▼
THE AGENT (backend, scheduled)
 - Polls sources every ~15 min
 - Builds full daily brief once per day (~6am)
 - Uses Gemini API to summarize + rank importance
 - Decides: "is this a big-drop alert, or just brief material?"
   │
   ▼
STORAGE
 - Today's brief
 - Alert history
 - HANDOFF.md-style state (see below)
   │
   ▼
DELIVERY
 - Web Push notification → "🚨 [headline]"
 - PWA opens to a clean feed UI
```

## Tech Stack (decisions, not guesses — confirm before M1 build)
- **Backend:** Node.js (consistent with Tether stack — reduces context-switching cost for Kamsi)
- **Scheduler:** Cron-based (node-cron locally during dev; platform-native scheduled job once deployed)
- **Hosting:** Render or Railway free tier (always-on enough for 15-min polling; revisit if free tier throttles)
- **Database:** Firebase (Kamsi already has working familiarity from the hydroponics project)
- **Summarization/ranking:** Gemini API (using Gemini 2.5 Flash / 1.5 Flash via `@google/genai` or `@google/generative-ai` — chosen for $0 cost on the free tier at Ring's solo-use polling scale)
- **Frontend (M2+):** PWA, same shell pattern as Tether
- **Push:** Web Push API

## Milestones

**M1 — Backend Core**
Pull from 1–2 sources (start: one RSS tech/AI feed + one general news API). Generate a daily brief via Claude API. Store it. No UI — verify via logs/database that brief quality is good before building anything visual on top.

**M2 — PWA Shell**
Simple feed UI displaying the stored brief. Installable on home screen. No alerts yet — just confirm the daily-brief experience feels right.

**M3 — Real-Time Alerts**
Wire up the 15-min polling + "big drop" detection logic. Web Push fires to phone. This is the highest-risk milestone (false positives/negatives in "is this significant" judgment) — expect iteration here.

**M4 — Expansion & Polish**
Add remaining sources, layer in personal passion categories, tune importance filtering so alerts stay rare and meaningful (avoid notification fatigue).

## The HANDOFF.md Convention
Every Ring build session, Antigravity's Claude maintains a `HANDOFF.md` alongside `DEVLOG.md`:
- **DEVLOG.md** — chronological history (what happened, when, in order)
- **HANDOFF.md** — current-state snapshot, overwritten each session: where things stand right now, what's next, known issues, and what NOT to retry (failed approaches). Read first by any agent picking up the project cold — especially important here since Ring runs unattended on a schedule and may fail silently overnight.

## Open Decisions (revisit as we go)
- Exact RSS feed list for M1 (draft list to be finalized in M1 SKILL.md)
- Whether Firebase free tier comfortably handles 15-min polling long-term
- "Big drop" threshold — how significant something must be to trigger a push vs. wait for the daily brief
