export const SYSTEM_INSTRUCTION = `You are writing a daily news brief for a single reader. Given the raw news items, produce a concise, well-organized brief with two sections: general and techAi.
For each item: write a concise 1-2 sentence summary, no fluff, and do not repeat the headline verbatim.

FLAGGING CRITERIA — BE EXTREMELY SELECTIVE:
Flag an item as significant (flagged = true) ONLY if it meets ALL of these criteria:
1. It is BREAKING or FIRST-REPORTED — not a follow-up, analysis, or opinion piece on known news.
2. It would cause a reasonable person to stop what they're doing to read it RIGHT NOW.
3. It falls into one of these categories:
   - A major new AI model launch (GPT-5, Gemini 3, Claude 4 — not minor version bumps, feature additions, or API updates)
   - A major acquisition or merger (>$1B or industry-reshaping, e.g. Amazon building chips to compete with Nvidia)
   - A major geopolitical or economic event (sanctions, trade wars, market crashes)
   - A critical security breach or zero-day affecting millions of users
   - A scientific breakthrough with immediate real-world implications
   - A major competitive shift between industry leaders (e.g. a dominant company entering a rival's core market)

Do NOT flag:
- Startup funding rounds (even large ones like $100M+ Series B/C)
- Product feature updates or minor model releases
- Analyst opinions, editorials, or market commentary
- Conference announcements or upcoming events
- Incremental research papers or benchmarks
- Partnership announcements unless they fundamentally reshape a market

When in doubt, do NOT flag. A typical poll should flag 0-1 items. Flagging 3+ items in a single brief almost certainly means you are being too lenient.`;

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    general: {
      type: 'ARRAY',
      description: 'Summaries of general news items',
      items: {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING', description: 'Concise 1-2 sentence summary of the news' },
          sourceUrl: { type: 'STRING', description: 'URL link to the source article' },
          sourceName: { type: 'STRING', description: 'Name of the source publisher' }
        },
        required: ['summary', 'sourceUrl', 'sourceName']
      }
    },
    techAi: {
      type: 'ARRAY',
      description: 'Summaries of Tech and AI news items',
      items: {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING', description: 'Concise 1-2 sentence summary of the tech/AI news' },
          sourceUrl: { type: 'STRING', description: 'URL link to the source article' },
          sourceName: { type: 'STRING', description: 'Name of the source publisher' },
          flagged: { type: 'BOOLEAN', description: 'True if the news is unusually significant/big-drop worthy' }
        },
        required: ['summary', 'sourceUrl', 'sourceName', 'flagged']
      }
    }
  },
  required: ['general', 'techAi']
};
