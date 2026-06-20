# SKILL: Ring M1 — Backend Core

## Goal of This Milestone
Prove the core loop works: pull news, summarize it with Gemini, store a daily brief. No UI. No alerts. Success = a believable, well-written daily brief sitting in the database that Kamsi can read and judge for quality.

## Scope (do exactly this, nothing more)
1. Set up a Node.js project for Ring (new repo, not inside Tether).
2. Connect to **two sources** only, for now:
   - One RSS feed for tech/AI (suggest starting with Anthropic's news/blog RSS if available, else a reputable AI news aggregator)
   - One general news API (NewsAPI or GNews — use the free tier)
3. Write a script that:
   - Fetches latest items from both sources
   - Sends them to the Gemini API with a summarization prompt (see below)
   - Stores the resulting brief in Firebase
4. Run it manually (no scheduler yet — that's later) and confirm the output looks good by inspecting Firebase directly or logging to console.

## Explicitly Out of Scope for M1
- No cron/scheduling
- No PWA/frontend
- No push notifications
- No "big drop" alert detection logic
- No X/Twitter source
- No robotics/chess/passion categories

## Suggested Gemini API Summarization Prompt (starting point — iterate as needed)
```
You are writing a daily news brief for a single reader. Given the following
raw news items, produce a concise, well-organized brief with two sections:
GENERAL and TECH/AI. For each item: one or two sentences, no fluff, no
repetition of the headline. Flag anything that seems unusually significant
with a ⭐ at the start of the line.

Raw items:
[insert fetched items here]
```

## Data Shape (Firebase) — starting point
```
/briefs/{date}
  - generatedAt: timestamp
  - general: [ { summary, sourceUrl, sourceName } ]
  - techAi: [ { summary, sourceUrl, sourceName, flagged: bool } ]
```

## Definition of Done
- [ ] Script runs end-to-end without manual intervention once started
- [ ] At least one full day's brief stored successfully in Firebase
- [ ] Kamsi has read the output and confirmed it's actually useful (not just "it ran")
- [ ] HANDOFF.md updated with current state and what M2 should pick up
- [ ] DEVLOG.md has an entry for this session

## Notes for the Builder
- Keep the summarization prompt easy to find and edit — it will almost certainly need tuning after Kamsi sees the first real output. Don't bury it deep in code; a constants file or `prompts/` folder is fine.
- If NewsAPI/GNews free tier rate limits are hit during testing, log it clearly rather than failing silently — this is exactly the kind of thing that should end up in HANDOFF.md's known issues if unresolved.
