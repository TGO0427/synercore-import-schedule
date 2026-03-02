import { Router, Request, Response } from 'express';

const router = Router();

// In-memory cache: { data, fetchedAt }
let cache: { data: any[]; fetchedAt: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

router.get('/', async (_req: Request, res: Response) => {
  try {
    // Return cached data if fresh
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
      return res.json({ data: cache.data, cached: true });
    }

    const response = await fetch('https://www.freightnews.co.za/rss');
    if (!response.ok) {
      return res.status(502).json({ error: 'Failed to fetch news feed' });
    }

    const xml = await response.text();

    // Simple XML parsing for RSS items (no dependency needed)
    const items: any[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 10) {
      const itemXml = match[1];
      const title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/)?.[1] || itemXml.match(/<title>(.*?)<\/title>/)?.[1] || '';
      const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      if (title) {
        items.push({ title: title.trim(), link: link.trim(), pubDate: pubDate.trim() });
      }
    }

    cache = { data: items, fetchedAt: Date.now() };
    res.json({ data: items, cached: false });
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
