import { Router, Request, Response } from 'express';
import pool from '../db/connection.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.ts';

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

// ── Announcement CRUD (admin-only) ──────────────────────────────

// List all announcements (for admin management)
router.get('/announcements', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM announcements ORDER BY created_at DESC'
    );
    res.json({ data: result.rows });
  } catch (err: any) {
    console.error('Failed to fetch announcements:', err);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// Create announcement
router.post('/announcements', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, description, link, expires_at } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const result = await pool.query(
      `INSERT INTO announcements (title, description, link, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title.trim(), description?.trim() || null, link?.trim() || null, expires_at || null, (req as any).user?.id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Failed to create announcement:', err);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// Update announcement
router.put('/announcements/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, link, active, expires_at } = req.body;
    const result = await pool.query(
      `UPDATE announcements
       SET title = COALESCE($1, title),
           description = $2,
           link = $3,
           active = COALESCE($4, active),
           expires_at = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [title?.trim(), description?.trim() || null, link?.trim() || null, active, expires_at || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Failed to update announcement:', err);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

// Delete announcement
router.delete('/announcements/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM announcements WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('Failed to delete announcement:', err);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// ── Main news feed (public) ─────────────────────────────────────

router.get('/', async (_req: Request, res: Response) => {
  try {
    // Fetch active, non-expired announcements from DB
    let announcements: any[] = [];
    try {
      const annResult = await pool.query(
        `SELECT id, title, description, link, 'Synercore' AS source, created_at AS "pubDate"
         FROM announcements
         WHERE active = true
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC`
      );
      announcements = annResult.rows;
    } catch {
      // Table may not exist yet — ignore
    }

    // Return cached RSS + fresh announcements if RSS cache is still valid
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
      const merged = [...announcements, ...cache.data];
      return res.json({ data: merged, cached: true });
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
    const rssItems: any[] = [];
    const maxLen = Math.max(...feedItems.map((f) => f.length), 0);
    for (let idx = 0; idx < maxLen && rssItems.length < 15; idx++) {
      for (const items of feedItems) {
        if (idx < items.length && rssItems.length < 15) {
          rssItems.push(items[idx]);
        }
      }
    }

    cache = { data: rssItems, fetchedAt: Date.now() };

    // Announcements first, then RSS
    const merged = [...announcements, ...rssItems];
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
