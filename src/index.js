import 'dotenv/config';
import { fetchAllRssFeeds } from './sources/rss.js';
import { fetchGeneralNews } from './sources/newsapi.js';
import { generateDailyBrief } from './services/llm.js';
import { initializeDatabase, saveDailyBrief } from './services/db.js';

async function main() {
  console.log('===================================================');
  console.log('           RING NEWS AGENT: MILESTONE M1           ');
  console.log('===================================================');

  // 1. Initialize database configurations
  initializeDatabase();

  try {
    // 2. Fetch raw articles from both RSS and NewsAPI
    console.log('\n[STEP 1] Fetching news sources...');
    const rssNews = await fetchAllRssFeeds();
    const generalNews = await fetchGeneralNews(process.env.NEWS_API_KEY);

    const combinedNews = [...rssNews, ...generalNews];
    console.log(`\nAggregated ${combinedNews.length} raw articles:`);
    console.log(` - Tech/AI (RSS): ${rssNews.length} articles`);
    console.log(` - General (NewsAPI): ${generalNews.length} articles`);

    if (combinedNews.length === 0) {
      console.warn('No news articles fetched from any source. Exiting.');
      return;
    }

    // 3. Send raw data to Gemini to produce structured summaries
    console.log('\n[STEP 2] Summarizing and ranking news via Gemini API...');
    const brief = await generateDailyBrief(combinedNews);

    console.log('\n---------------------------------------------------');
    console.log('               DAILY BRIEF PREVIEW                 ');
    console.log('---------------------------------------------------');
    console.log(`General News Articles Summarized: ${brief.general?.length || 0}`);
    console.log(`Tech/AI News Articles Summarized: ${brief.techAi?.length || 0}`);

    const flaggedItems = (brief.techAi || []).filter(item => item.flagged);
    if (flaggedItems.length > 0) {
      console.log(`\n⭐ Flagged Significant Updates (${flaggedItems.length}):`);
      flaggedItems.forEach((item, index) => {
        console.log(` ${index + 1}. ${item.summary} [Source: ${item.sourceName}]`);
      });
    }
    console.log('---------------------------------------------------');

    // 4. Save to Firebase database or local JSON file
    console.log('\n[STEP 3] Saving daily brief to storage...');
    const today = new Date();
    const dateKey = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const saveResult = await saveDailyBrief(dateKey, brief);

    console.log('\n===================================================');
    console.log('      RING RUN COMPLETED SUCCESSFULLY              ');
    console.log('===================================================');
  } catch (error) {
    console.error('\nFatal error running Ring news agent:', error);
  }
}

main();
