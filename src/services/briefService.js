import { fetchAllRssFeeds } from '../sources/rss.js';
import { fetchGeneralNews } from '../sources/newsapi.js';
import { generateDailyBrief } from './llm.js';
import { saveDailyBrief } from './db.js';

let isGeneratingBrief = false;

/**
 * Fetches news from RSS and NewsAPI sources, combines them, and summarizes them via LLM.
 * @returns {Promise<Object|null>} Daily brief object or null if no articles found.
 */
export async function fetchAndSummarizeNews() {
  const rssNews = await fetchAllRssFeeds();
  const generalNews = await fetchGeneralNews(process.env.NEWS_API_KEY);
  const combinedNews = [...rssNews, ...generalNews];

  if (combinedNews.length === 0) {
    return null;
  }

  const brief = await generateDailyBrief(combinedNews);
  return brief;
}

/**
 * Runs the daily brief generation pipeline and saves it to storage.
 * @returns {Promise<Object>} Status of the generation and save operation.
 */
export async function generateAndSaveDailyBrief() {
  if (isGeneratingBrief) {
    console.log('[BriefService] Daily brief generation already in progress. Skipping.');
    return { skipped: true };
  }

  isGeneratingBrief = true;
  try {
    console.log('[BriefService] Starting daily brief generation...');
    const brief = await fetchAndSummarizeNews();
    if (!brief) {
      console.warn('[BriefService] No news articles fetched. Cannot generate daily brief.');
      return { success: false, reason: 'No articles' };
    }

    const today = new Date();
    const dateKey = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const saveResult = await saveDailyBrief(dateKey, brief);
    console.log('[BriefService] Daily brief generation and saving completed successfully.');
    return { success: true, ...saveResult };
  } catch (error) {
    console.error('[BriefService] Daily brief generation failed:', error.message);
    return { success: false, error: error.message };
  } finally {
    isGeneratingBrief = false;
  }
}
