import { Router, Request, Response } from 'express';
import pool from '../config/database';

const router = Router();

// Get analytics for a specific link
router.get('/:code/analytics', async (req: Request, res: Response) => {
  try {
    const code = req.params.code as string;

    // Get link ID
    const linkResult = await pool.query(
      'SELECT id FROM short_links WHERE code = $1',
      [code]
    );

    if (linkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const linkId = linkResult.rows[0].id;

    // Get device distribution
    const deviceQuery = `
      SELECT device_type, COUNT(*) as count
      FROM click_logs
      WHERE link_id = $1 AND device_type IS NOT NULL
      GROUP BY device_type
      ORDER BY count DESC
    `;
    const deviceResult = await pool.query(deviceQuery, [linkId]);

    // Get OS distribution
    const osQuery = `
      SELECT os, COUNT(*) as count
      FROM click_logs
      WHERE link_id = $1 AND os IS NOT NULL
      GROUP BY os
      ORDER BY count DESC
      LIMIT 10
    `;
    const osResult = await pool.query(osQuery, [linkId]);

    // Get browser distribution
    const browserQuery = `
      SELECT browser, COUNT(*) as count
      FROM click_logs
      WHERE link_id = $1 AND browser IS NOT NULL
      GROUP BY browser
      ORDER BY count DESC
      LIMIT 10
    `;
    const browserResult = await pool.query(browserQuery, [linkId]);

    // Get country distribution
    const countryQuery = `
      SELECT country, COUNT(*) as count
      FROM click_logs
      WHERE link_id = $1 AND country IS NOT NULL
      GROUP BY country
      ORDER BY count DESC
      LIMIT 10
    `;
    const countryResult = await pool.query(countryQuery, [linkId]);

    // Get city distribution
    const cityQuery = `
      SELECT city, country, COUNT(*) as count
      FROM click_logs
      WHERE link_id = $1 AND city IS NOT NULL
      GROUP BY city, country
      ORDER BY count DESC
      LIMIT 10
    `;
    const cityResult = await pool.query(cityQuery, [linkId]);

    // Get referer distribution
    const refererQuery = `
      SELECT referer, COUNT(*) as count
      FROM click_logs
      WHERE link_id = $1 AND referer IS NOT NULL
      GROUP BY referer
      ORDER BY count DESC
      LIMIT 10
    `;
    const refererResult = await pool.query(refererQuery, [linkId]);

    res.json({
      devices: deviceResult.rows.map(row => ({
        type: row.device_type,
        count: parseInt(row.count, 10),
      })),
      os: osResult.rows.map(row => ({
        name: row.os,
        count: parseInt(row.count, 10),
      })),
      browsers: browserResult.rows.map(row => ({
        name: row.browser,
        count: parseInt(row.count, 10),
      })),
      countries: countryResult.rows.map(row => ({
        name: row.country,
        count: parseInt(row.count, 10),
      })),
      cities: cityResult.rows.map(row => ({
        name: row.city,
        country: row.country,
        count: parseInt(row.count, 10),
      })),
      referers: refererResult.rows.map(row => ({
        source: row.referer,
        count: parseInt(row.count, 10),
      })),
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get hourly trend for a specific link
router.get('/:code/trend', async (req: Request, res: Response) => {
  try {
    const code = req.params.code as string;
    const days = parseInt(req.query.days as string) || 7;

    // Get link ID
    const linkResult = await pool.query(
      'SELECT id FROM short_links WHERE code = $1',
      [code]
    );

    if (linkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const linkId = linkResult.rows[0].id;

    // Get hourly clicks for the last N days
    const trendQuery = `
      SELECT
        DATE_TRUNC('hour', clicked_at) as hour,
        COUNT(*) as clicks
      FROM click_logs
      WHERE link_id = $1
        AND clicked_at >= NOW() - INTERVAL '${days} days'
      GROUP BY hour
      ORDER BY hour ASC
    `;

    const trendResult = await pool.query(trendQuery, [linkId]);

    res.json({
      trend: trendResult.rows.map(row => ({
        time: row.hour,
        clicks: parseInt(row.clicks, 10),
      })),
    });
  } catch (error: any) {
    console.error('Error fetching trend:', error);
    res.status(500).json({ error: 'Failed to fetch trend' });
  }
});

export default router;
