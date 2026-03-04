import { Router, Request, Response } from 'express';

const router = Router();

// In-memory cache: { data, fetchedAt }
let cache: { data: any[]; fetchedAt: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const FEEDS = [
  { url: 'https://www.freightnews.co.za/rss', source: 'Freight News' },
  { url: 'https://theloadstar.com/feed/', source: 'The Loadstar' },
  { url: 'https://gcaptain.com/feed/', source: 'gCaptain' },
  { url: 'https://www.supplychaindive.com/feeds/news/', source: 'Supply Chain Dive' },
];

function parseRSSItems(xml: string, source: string, limit = 6): any[] {
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const itemXml = match[1];
    const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]>/s) || itemXml.match(/<title>(.*?)<\/title>/s);
    const title = titleMatch?.[1] || '';
    const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || '';
    const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
    if (title) {
      items.push({ title: title.trim(), link: link.trim(), pubDate: pubDate.trim(), source });
    }
  }
  return items;
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    // Return cached data if fresh
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
      return res.json({ data: cache.data, cached: true });
    }

    // Fetch all feeds in parallel — one failure doesn't break the others
    const results = await Promise.allSettled(
      FEEDS.map(async (feed) => {
        const response = await fetch(feed.url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const xml = await response.text();
        return parseRSSItems(xml, feed.source);
      })
    );

    // Collect items per source
    const feedItems: any[][] = results.map((r) =>
      r.status === 'fulfilled' ? r.value : []
    );

    // Log any failed feeds
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn(`News feed failed [${FEEDS[i].source}]:`, r.reason?.message || r.reason);
      }
    });

    // Interleave round-robin across sources for variety
    const merged: any[] = [];
    const maxLen = Math.max(...feedItems.map((f) => f.length), 0);
    for (let idx = 0; idx < maxLen && merged.length < 15; idx++) {
      for (const items of feedItems) {
        if (idx < items.length && merged.length < 15) {
          merged.push(items[idx]);
        }
      }
    }

    cache = { data: merged, fetchedAt: Date.now() };
    res.json({ data: merged, cached: false });
  } catch (err) {
    console.error('News feed error:', err);
    // Return stale cache if available
    if (cache) {
      return res.json({ data: cache.data, cached: true, stale: true });
    }
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

export default router;
