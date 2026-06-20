/**
 * Fetches general news using NewsAPI (free tier).
 * If no API key is provided or if the fetch fails, it falls back to mock general news data.
 * @param {string} apiKey - NewsAPI API Key
 * @returns {Promise<Array>} Normalized general news items
 */
export async function fetchGeneralNews(apiKey) {
  if (!apiKey) {
    console.log('No NEWS_API_KEY found in environment. Using fallback mock general news.');
    return getMockGeneralNews();
  }

  try {
    const url = `https://newsapi.org/v2/top-headlines?category=general&language=en&pageSize=10&apiKey=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(`NewsAPI responded with status ${response.status}: ${errBody.message || response.statusText}`);
    }

    const data = await response.json();
    if (!data.articles || data.articles.length === 0) {
      throw new Error('NewsAPI returned no articles.');
    }

    return data.articles.map(article => ({
      title: article.title || 'Untitled',
      url: article.url || '',
      content: (article.description || article.content || '').substring(0, 500),
      pubDate: article.publishedAt || new Date().toISOString(),
      sourceName: article.source?.name || 'NewsAPI'
    }));
  } catch (error) {
    console.error('Error fetching general news from NewsAPI:', error.message);
    console.log('Falling back to mock general news.');
    return getMockGeneralNews();
  }
}

/**
 * Returns mock general news articles for testing / local dry runs.
 */
function getMockGeneralNews() {
  return [
    {
      title: "Global Summit Reaches Landmark Accord on Green Energy Transition",
      url: "https://example.com/green-energy-summit",
      content: "Representatives from over 190 nations concluded talks in Geneva today, signing a comprehensive agreement aimed at accelerating the transition to renewable energy sources by 2035.",
      pubDate: new Date().toISOString(),
      sourceName: "Global News Network"
    },
    {
      title: "Federal Reserve Signals Shift in Inflation Control & Interest Rates",
      url: "https://example.com/fed-interest-rates",
      content: "In its monthly briefing, the Federal Reserve hinted at potential interest rate cuts in the coming quarter, citing easing inflation pressures and stable employment numbers.",
      pubDate: new Date().toISOString(),
      sourceName: "Financial Times Weekly"
    }
  ];
}
