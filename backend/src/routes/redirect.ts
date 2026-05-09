import { Router, Request, Response } from 'express';
import linkService from '../services/linkService';
import queueService from '../services/queueService';
import rateLimitService from '../services/rateLimitService';
import pool from '../config/database';

const router = Router();

// Redirect endpoint
router.get('/:code', async (req: Request, res: Response) => {
  try {
    const code = req.params.code as string;

    // Rate limit: 1000 requests per second per short code
    const allowed = await rateLimitService.checkSimpleLimit(
      `rate:redirect:${code}:${Math.floor(Date.now() / 1000)}`,
      1000,
      2
    );

    if (!allowed) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    // Get original URL from cache or database
    const originalUrl = await linkService.getOriginalUrl(code);

    if (!originalUrl) {
      return res.status(404).json({ error: 'Link not found' });
    }

    // Get link ID for logging
    const result = await pool.query(
      'SELECT id FROM short_links WHERE code = $1',
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const linkId = result.rows[0].id;

    // Redirect immediately (don't wait for logging)
    res.redirect(302, originalUrl);

    // Async: Queue click event for logging
    queueService.addClickEvent({
      linkId,
      code,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      referer: (Array.isArray(req.headers['referer']) ? req.headers['referer'][0] : req.headers['referer']) || 'direct',
      timestamp: Date.now(),
    }).catch(err => {
      console.error('Failed to queue click event:', err);
    });

  } catch (error: any) {
    console.error('Error in redirect:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
