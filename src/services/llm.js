import { GoogleGenAI } from '@google/genai';
import { SYSTEM_INSTRUCTION, RESPONSE_SCHEMA } from '../config/prompts.js';

/**
 * Sends aggregated news to the Gemini API to generate a structured daily brief.
 * Falls back to mock summaries if no API key is found or if the request fails.
 * @param {Array} rawNewsItems - Combined news articles from RSS and NewsAPI
 * @param {string} apiKey - Gemini API Key (optional, will check environment variables)
 * @returns {Promise<Object>} Structured daily brief with general and techAi properties
 */
export async function generateDailyBrief(rawNewsItems, apiKey) {
  // Prevent SDK from defaulting to system-level GOOGLE_API_KEY if GEMINI_API_KEY is defined in .env
  if (process.env.GEMINI_API_KEY) {
    delete process.env.GOOGLE_API_KEY;
  }

  // Find key in parameter or standard environment variables
  const finalApiKey = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  if (!finalApiKey) {
    console.log('No GEMINI_API_KEY or GOOGLE_API_KEY found. Returning fallback mock daily brief.');
    return getMockDailyBrief();
  }

  if (!rawNewsItems || rawNewsItems.length === 0) {
    console.log('No raw news items to summarize. Returning empty brief.');
    return { general: [], techAi: [] };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: finalApiKey });

    // Trim/filter rawNewsItems: group by source and take at most 15 most recent articles per source
    const maxArticlesPerSource = 15;
    const articlesBySource = {};
    for (const item of rawNewsItems) {
      const source = item.sourceName || 'Unknown';
      if (!articlesBySource[source]) {
        articlesBySource[source] = [];
      }
      articlesBySource[source].push(item);
    }

    const trimmedNewsItems = [];
    for (const [source, items] of Object.entries(articlesBySource)) {
      // Sort items by pubDate descending (newest first)
      const sorted = [...items].sort((a, b) => {
        const dateA = new Date(a.pubDate);
        const dateB = new Date(b.pubDate);
        const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
        const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
        return timeB - timeA;
      });
      const sliced = sorted.slice(0, maxArticlesPerSource);
      trimmedNewsItems.push(...sliced);
      if (items.length > maxArticlesPerSource) {
        console.log(`[LLM Prep] Trimmed source "${source}" from ${items.length} to ${sliced.length} most recent articles to prevent token bloat.`);
      }
    }

    // Format the articles list into a readable string for the model
    const formattedItems = trimmedNewsItems.map((item, idx) => `
ID: ${idx}
SOURCE: ${item.sourceName}
URL: ${item.url}
TITLE: ${item.title}
CONTENT: ${item.content}
---`).join('\n');

    console.log(`Sending ${trimmedNewsItems.length} raw articles to Gemini API (${modelName})...`);

    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Raw news items:\n${formattedItems}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2 // Low temperature for higher fidelity to the source facts
      }
    });

    if (!response.text) {
      throw new Error('Gemini API returned an empty response.');
    }

    const parsedBrief = JSON.parse(response.text.trim());
    return parsedBrief;
  } catch (error) {
    console.error('Error generating daily brief via Gemini:', error.message);
    console.log('Falling back to mock daily brief due to generation error.');
    return getMockDailyBrief();
  }
}

/**
 * Returns a high-quality mock brief matching the required JSON schema.
 */
function getMockDailyBrief() {
  return {
    general: [
      {
        summary: "A global green energy pact was signed in Geneva by 190 nations today, aiming to accelerate renewable conversions by 2035.",
        sourceUrl: "https://example.com/green-energy-summit",
        sourceName: "Global News Network"
      },
      {
        summary: "The Federal Reserve hinted at interest rate cuts in the upcoming quarter, pointing to easing inflation and stable employment figures.",
        sourceUrl: "https://example.com/fed-interest-rates",
        sourceName: "Financial Times Weekly"
      }
    ],
    techAi: [
      {
        summary: "OpenAI announced the release of their next-generation model series with advanced reasoning capabilities and visual processing.",
        sourceUrl: "https://openai.com/news/rss.xml",
        sourceName: "OpenAI News",
        flagged: true
      },
      {
        summary: "TechCrunch reported new developments in hardware-accelerated robot learning models, claiming major speed improvements.",
        sourceUrl: "https://techcrunch.com/category/artificial-intelligence/feed/",
        sourceName: "TechCrunch AI",
        flagged: false
      }
    ]
  };
}
