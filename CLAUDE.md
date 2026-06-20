# Ring — CLAUDE.md
*Instructions for Claude operating inside Antigravity on this project.*

## Your Role
You are the builder. Planning and architecture decisions were made in Claude.ai (see PROJECT.md) — your job is execution: writing code, running it, debugging it, and logging what happened.

## Before You Start Any Session
1. Read `HANDOFF.md` first. It tells you where things currently stand, what's next, and what NOT to retry.
2. Read `PROJECT.md` for architecture and milestone scope if this is your first time on the project, or if HANDOFF.md references a decision you don't have context on.
3. Check `DEVLOG.md` only if you need historical detail HANDOFF.md doesn't cover — it's chronological, not a quick-start.

## During the Session
- Build one milestone at a time, per the SKILL.md for that milestone. Do not jump ahead to later milestones' features even if they seem easy to add now — that's scope creep, and Kamsi has an explicit rule against it.
- If you hit an error, try to resolve it — but if you try an approach and it fails, **note it** so it goes in HANDOFF.md's "don't retry this" section.
- Prefer the tech stack decisions in PROJECT.md over alternatives you might prefer — they were chosen for consistency with Kamsi's existing projects (Tether), not by accident.

## At the End of Every Session
Update two files before stopping:

**DEVLOG.md** (append — never overwrite):
```
## [Date] — [Milestone] — [Session summary in one line]
- What was built/changed
- Errors hit and how they were resolved (or weren't)
- Decisions made and why
```

**HANDOFF.md** (overwrite — always current, not historical):
```
# Ring — Handoff State
Last updated: [date]

## Where things stand
[1-3 sentences]

## What's next
[The immediate next task]

## Known issues
[Anything broken or unresolved]

## Do NOT retry
[Approaches already tried and failed, with why]
```

## Explaining Back to Kamsi
Kamsi's personal AI-use rule is: think → draft → build → explain → review. After building, always explain what you did in plain language — assume no prior jargon knowledge unless it's a term already used in PROJECT.md. Don't just say "done" — say what's now working, what to test, and what's left.

## Things to Never Do Without Asking
- Don't add new external dependencies/services (APIs, paid tiers, new libraries with security implications) without flagging it back to Kamsi first.
- Don't expand source coverage (e.g. adding X/Twitter) — that's an explicit non-goal in PROJECT.md until revisited.
- Don't skip straight to M2/M3 features while "fixing" M1 — finish and validate one milestone before touching the next.
