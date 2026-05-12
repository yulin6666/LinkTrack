// Mock external dependencies before importing the service
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'abc12345'),
}));

jest.mock('../config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../config/redis', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('../services/cacheService', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    setNull: jest.fn(),
    invalidate: jest.fn(),
    isPending: jest.fn().mockReturnValue(false),
    markPending: jest.fn(),
    unmarkPending: jest.fn(),
  },
}));

import pool from '../config/database';
import cacheService from '../services/cacheService';
import linkService from '../services/linkService';

const mockPool = pool as jest.Mocked<typeof pool>;
const mockCache = cacheService as jest.Mocked<typeof cacheService>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LinkService.createShortLink', () => {
  it('throws on invalid URL', async () => {
    await expect(linkService.createShortLink('not-a-url')).rejects.toThrow('Invalid URL format');
  });

  it('throws on non-http protocol', async () => {
    await expect(linkService.createShortLink('ftp://example.com')).rejects.toThrow('Invalid URL format');
  });

  it('inserts into DB and caches the result', async () => {
    const now = new Date();
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{
        id: 1,
        code: 'abc12345',
        original_url: 'https://example.com',
        created_at: now,
        expires_at: null,
        is_active: true,
      }],
    });
    mockCache.set.mockResolvedValueOnce(undefined);

    const result = await linkService.createShortLink('https://example.com');

    expect(result.originalUrl).toBe('https://example.com');
    expect(result.code).toBe('abc12345');
    expect(result.isActive).toBe(true);
    expect(mockCache.set).toHaveBeenCalledWith('abc12345', expect.objectContaining({
      originalUrl: 'https://example.com',
    }));
  });
});

describe('LinkService.getOriginalUrl', () => {
  it('returns URL from cache hit', async () => {
    mockCache.get.mockResolvedValueOnce({
      id: 1,
      code: 'abc12345',
      originalUrl: 'https://example.com',
      isActive: true,
      expiresAt: null,
    });

    const url = await linkService.getOriginalUrl('abc12345');
    expect(url).toBe('https://example.com');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('returns null for inactive link in cache', async () => {
    mockCache.get.mockResolvedValueOnce({
      id: 1,
      code: 'abc12345',
      originalUrl: 'https://example.com',
      isActive: false,
      expiresAt: null,
    });

    const url = await linkService.getOriginalUrl('abc12345');
    expect(url).toBeNull();
  });

  it('returns null for null sentinel in cache (防穿透)', async () => {
    mockCache.get.mockResolvedValueOnce(null);

    const url = await linkService.getOriginalUrl('nonexistent');
    expect(url).toBeNull();
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('queries DB on cache miss and caches result', async () => {
    mockCache.get.mockResolvedValueOnce(undefined); // cache miss
    const now = new Date();
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{
        id: 1,
        code: 'abc12345',
        original_url: 'https://example.com',
        created_at: now,
        expires_at: null,
        is_active: true,
      }],
    });
    mockCache.set.mockResolvedValueOnce(undefined);

    const url = await linkService.getOriginalUrl('abc12345');
    expect(url).toBe('https://example.com');
    expect(mockCache.set).toHaveBeenCalled();
  });

  it('caches null and returns null when DB has no result', async () => {
    mockCache.get.mockResolvedValueOnce(undefined);
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    mockCache.setNull.mockResolvedValueOnce(undefined);

    const url = await linkService.getOriginalUrl('missing');
    expect(url).toBeNull();
    expect(mockCache.setNull).toHaveBeenCalledWith('missing');
  });

  it('returns null for expired link', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    mockCache.get.mockResolvedValueOnce({
      id: 1,
      code: 'abc12345',
      originalUrl: 'https://example.com',
      isActive: true,
      expiresAt: pastDate,
    });

    const url = await linkService.getOriginalUrl('abc12345');
    expect(url).toBeNull();
  });
});

describe('LinkService.getLinkStats', () => {
  it('returns null when link not found', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    const result = await linkService.getLinkStats('missing');
    expect(result).toBeNull();
  });

  it('returns stats with totalClicks', async () => {
    const now = new Date();
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{
        code: 'abc12345',
        original_url: 'https://example.com',
        created_at: now,
        total_clicks: '42',
        last_clicked_at: now,
      }],
    });

    const result = await linkService.getLinkStats('abc12345');
    expect(result).not.toBeNull();
    expect(result!.totalClicks).toBe(42);
    expect(result!.code).toBe('abc12345');
  });
});

describe('LinkService.getAllLinks', () => {
  it('returns paginated links with total', async () => {
    const now = new Date();
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // COUNT query
      .mockResolvedValueOnce({
        rows: [{
          code: 'abc12345',
          original_url: 'https://example.com',
          created_at: now,
          total_clicks: '10',
          last_clicked_at: now,
        }],
      });

    const result = await linkService.getAllLinks(1, 20);
    expect(result.total).toBe(5);
    expect(result.links).toHaveLength(1);
    expect(result.links[0].totalClicks).toBe(10);
  });
});
