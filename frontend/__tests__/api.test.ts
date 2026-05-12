import { createLink, getAllLinks, getLinkStats, getLinkAnalytics, getLinkTrend } from '@/lib/api';

// Mock global fetch
global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('API functions', () => {
  describe('createLink', () => {
    it('sends POST request with originalUrl', async () => {
      const mockResponse = {
        code: 'abc123',
        shortUrl: 'http://short/abc123',
        originalUrl: 'https://example.com',
        createdAt: new Date().toISOString(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createLink('https://example.com');

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalUrl: 'https://example.com' }),
      });
      expect(result.code).toBe('abc123');
    });

    it('throws on HTTP error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Invalid URL' }),
      });

      await expect(createLink('bad-url')).rejects.toThrow('Invalid URL');
    });
  });

  describe('getAllLinks', () => {
    it('fetches paginated links', async () => {
      const mockResponse = {
        data: [
          { code: 'abc123', shortUrl: 'http://short/abc123', originalUrl: 'https://a.com', totalClicks: 5, createdAt: new Date().toISOString() },
        ],
        pagination: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getAllLinks(1, 20);

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/links?page=1&pageSize=20');
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('getLinkStats', () => {
    it('fetches stats for a code', async () => {
      const mockResponse = {
        code: 'abc123',
        shortUrl: 'http://short/abc123',
        originalUrl: 'https://example.com',
        totalClicks: 10,
        lastClickedAt: null,
        createdAt: new Date().toISOString(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getLinkStats('abc123');

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/links/abc123/stats');
      expect(result.totalClicks).toBe(10);
    });
  });

  describe('getLinkAnalytics', () => {
    it('fetches analytics data', async () => {
      const mockResponse = {
        devices: [{ type: 'desktop', count: 5 }],
        os: [{ name: 'Windows', count: 3 }],
        browsers: [{ name: 'Chrome', count: 4 }],
        countries: [{ name: 'US', count: 2 }],
        cities: [{ name: 'New York', country: 'US', count: 1 }],
        referers: [{ source: 'Google', count: 3 }],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getLinkAnalytics('abc123');

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/analytics/abc123/analytics');
      expect(result.devices).toHaveLength(1);
    });
  });

  describe('getLinkTrend', () => {
    it('fetches trend data', async () => {
      const mockResponse = {
        trend: [
          { time: '2024-01-01T00:00:00Z', clicks: 5 },
          { time: '2024-01-01T01:00:00Z', clicks: 3 },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getLinkTrend('abc123', 7);

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/analytics/abc123/trend?days=7');
      expect(result).toHaveLength(2);
      expect(result[0].clicks).toBe(5);
    });
  });
});
