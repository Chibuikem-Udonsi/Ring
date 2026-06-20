import Parser from 'rss-parser';
import { FEEDS } from '../config/feeds.js';

const parser = new Parser();

/**
 * Fetches and normalizes articles from a single RSS feed.
 * @param {string} url - RSS Feed URL
 * @param {string} name - Display name for the source
 * @returns {Promise<Array>} List of normalized news items
 */
export async function fetchRssFeed(url, name) {
  try {
    const feed = await parser.parseURL(url);
    // Slice to only take the 15 most recent items from the RSS feed to prevent token bloat
    const recentItems = (feed.items || []).slice(0, 15);
    
    return recentItems.map(item => ({
      title: item.title || 'Untitled',
      url: item.link || '',
      content: (item.contentSnippet || item.content || '').substring(0, 500), // Cap content length to prevent prompt bloat
      pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
      sourceName: name
    }));
  } catch (error) {
    console.error(`Error fetching RSS feed [${name}] from ${url}:`, error.message);
    return [];
  }
}

/**
 * Fetches and aggregates articles from all configured RSS feeds.
 * @param {Array} feeds - List of feed configurations
 * @returns {Promise<Array>} Aggregated normalized items
 */
export async function fetchAllRssFeeds(feeds = FEEDS) {
  const results = [];
  for (const feed of feeds) {
    console.log(`Fetching RSS feed: ${feed.name}...`);
    const items = await fetchRssFeed(feed.url, feed.name);
    console.log(`Fetched ${items.length} items from ${feed.name}`);
    results.push(...items);
  }
  return results;
}
