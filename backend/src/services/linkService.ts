import { nanoid } from 'nanoid';
import pool from '../config/database';
import cacheService from './cacheService';

export interface ShortLink {
  id: number;
  code: string;
  originalUrl: string;
  createdAt: Date;
  expiresAt: Date | null;
  isActive: boolean;
}

export interface LinkStats {
  code: string;
  originalUrl: string;
  totalClicks: number;
  lastClickedAt: Date | null;
  createdAt: Date;
}

class LinkService {
  async createShortLink(originalUrl: string): Promise<ShortLink> {
    // Validate URL
    if (!this.isValidUrl(originalUrl)) {
      throw new Error('Invalid URL format');
    }

    // Generate unique short code
    const code = nanoid(8);

    const query = `
      INSERT INTO short_links (code, original_url)
      VALUES ($1, $2)
      RETURNING id, code, original_url, created_at, expires_at, is_active
    `;

    const result = await pool.query(query, [code, originalUrl]);
    const link = this.mapToShortLink(result.rows[0]);

    // Cache the new link
    await cacheService.set(code, {
      id: link.id,
      code: link.code,
      originalUrl: link.originalUrl,
      isActive: link.isActive,
      expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
    });

    return link;
  }

  async getOriginalUrl(code: string): Promise<string | null> {
    // 查缓存（undefined = miss，null = 确认不存在，CacheEntry = 有数据）
    const cached = await cacheService.get(code);

    if (cached !== undefined) {
      // 缓存命中（包括空值缓存）
      if (cached === null || !cached.isActive) return null;
      if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) return null;
      return cached.originalUrl;
    }

    // 缓存 miss，防击穿：如果已有请求在回填，等待后重试
    if (cacheService.isPending(code)) {
      await new Promise(r => setTimeout(r, 50));
      return this.getOriginalUrl(code);
    }

    // 抢到"回填权"，去查 DB
    cacheService.markPending(code);
    try {
      const query = `
        SELECT id, code, original_url, created_at, expires_at, is_active
        FROM short_links
        WHERE code = $1
      `;
      const result = await pool.query(query, [code]);

      if (result.rows.length === 0) {
        // 防穿透：缓存"不存在"结果
        await cacheService.setNull(code);
        return null;
      }

      const link = this.mapToShortLink(result.rows[0]);

      await cacheService.set(code, {
        id: link.id,
        code: link.code,
        originalUrl: link.originalUrl,
        isActive: link.isActive,
        expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
      });

      if (!link.isActive) return null;
      if (link.expiresAt && link.expiresAt < new Date()) return null;

      return link.originalUrl;
    } finally {
      cacheService.unmarkPending(code);
    }
  }

  async getLinkStats(code: string): Promise<LinkStats | null> {
    const query = `
      SELECT
        sl.code,
        sl.original_url,
        sl.created_at,
        COALESCE(cs.total_clicks, 0) as total_clicks,
        cs.last_clicked_at
      FROM short_links sl
      LEFT JOIN click_stats cs ON sl.id = cs.link_id
      WHERE sl.code = $1
    `;

    const result = await pool.query(query, [code]);

    if (result.rows.length === 0) return null;

    return {
      code: result.rows[0].code,
      originalUrl: result.rows[0].original_url,
      totalClicks: parseInt(result.rows[0].total_clicks, 10),
      lastClickedAt: result.rows[0].last_clicked_at,
      createdAt: result.rows[0].created_at,
    };
  }

  async getAllLinks(page: number = 1, pageSize: number = 20): Promise<{ links: LinkStats[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM short_links WHERE is_active = true'
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const query = `
      SELECT
        sl.code,
        sl.original_url,
        sl.created_at,
        COALESCE(cs.total_clicks, 0) as total_clicks,
        cs.last_clicked_at
      FROM short_links sl
      LEFT JOIN click_stats cs ON sl.id = cs.link_id
      WHERE sl.is_active = true
      ORDER BY sl.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [pageSize, offset]);

    return {
      links: result.rows.map((row: any) => ({
        code: row.code,
        originalUrl: row.original_url,
        totalClicks: parseInt(row.total_clicks, 10),
        lastClickedAt: row.last_clicked_at,
        createdAt: row.created_at,
      })),
      total,
    };
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private mapToShortLink(row: any): ShortLink {
    return {
      id: row.id,
      code: row.code,
      originalUrl: row.original_url,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      isActive: row.is_active,
    };
  }
}

export default new LinkService();
