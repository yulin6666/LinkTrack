import { Router, Request, Response } from 'express';
import linkService from '../services/linkService';
import rateLimitService from '../services/rateLimitService';

const router = Router();

// Create short link
router.post('/', async (req: Request, res: Response) => {
  try {
    const { originalUrl } = req.body;

    if (!originalUrl) {
      return res.status(400).json({ error: 'originalUrl is required' });
    }

    // Rate limit: 10 links per minute per IP
    const ip = req.ip || 'unknown';
    const allowed = await rateLimitService.checkSimpleLimit(
      `rate:create:${ip}`,
      10,
      60
    );

    if (!allowed) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const link = await linkService.createShortLink(originalUrl);
    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

    res.status(201).json({
      code: link.code,
      shortUrl: `${baseUrl}/r/${link.code}`,
      originalUrl: link.originalUrl,
      createdAt: link.createdAt,
    });
  } catch (error: any) {
    console.error('Error creating short link:', error);
    res.status(500).json({ error: error.message || 'Failed to create short link' });
  }
});

// Get all links
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));

    const { links, total } = await linkService.getAllLinks(page, pageSize);
    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

    res.json({
      data: links.map(link => ({
        code: link.code,
        shortUrl: `${baseUrl}/r/${link.code}`,
        originalUrl: link.originalUrl,
        totalClicks: link.totalClicks,
        lastClickedAt: link.lastClickedAt,
        createdAt: link.createdAt,
      })),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: any) {
    console.error('Error fetching links:', error);
    res.status(500).json({ error: 'Failed to fetch links' });
  }
});

// Get link stats
router.get('/:code/stats', async (req: Request, res: Response) => {
  try {
    const code = req.params.code as string;
    const stats = await linkService.getLinkStats(code);

    if (!stats) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

    res.json({
      code: stats.code,
      shortUrl: `${baseUrl}/r/${stats.code}`,
      originalUrl: stats.originalUrl,
      totalClicks: stats.totalClicks,
      lastClickedAt: stats.lastClickedAt,
      createdAt: stats.createdAt,
    });
  } catch (error: any) {
    console.error('Error fetching link stats:', error);
    res.status(500).json({ error: 'Failed to fetch link stats' });
  }
});

export default router;
