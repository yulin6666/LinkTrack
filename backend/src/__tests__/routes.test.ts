// Mock all external dependencies before importing app
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
    incr: jest.fn(),
    expire: jest.fn(),
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

jest.mock('../services/queueService', () => ({
  __esModule: true,
  default: { addClickEvent: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../services/rateLimitService', () => ({
  __esModule: true,
  default: { checkSimpleLimit: jest.fn().mockResolvedValue(true) },
}));

import request from 'supertest';
import express from 'express';
import linksRouter from '../routes/links';
import redirectRouter from '../routes/redirect';
import pool from '../config/database';
import cacheService from '../services/cacheService';
import queueService from '../services/queueService';

const mockPool = pool as jest.Mocked<typeof pool>;
const mockCache = cacheService as jest.Mocked<typeof cacheService>;
const mockQueue = queueService as jest.Mocked<typeof queueService>;

// Build a minimal Express app for testing
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/links', linksRouter);
  app.use('/r', redirectRouter);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Links routes ────────────────────────────────────────────────────────────

describe('POST /api/v1/links', () => {
  it('returns 400 when originalUrl is missing', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/v1/links').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/originalUrl/);
  });

  it('returns 500 for invalid URL (service throws)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/links')
      .send({ originalUrl: 'not-a-url' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Invalid URL format/);
  });

  it('returns 201 with short link on success', async () => {
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

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/links')
      .send({ originalUrl: 'https://example.com' });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe('abc12345');
    expect(res.body.shortUrl).toContain('abc12345');
    expect(res.body.originalUrl).toBe('https://example.com');
  });
});

describe('GET /api/v1/links', () => {
  it('returns paginated links', async () => {
    const now = new Date();
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({
        rows: [
          { code: 'abc12345', original_url: 'https://a.com', created_at: now, total_clicks: '5', last_clicked_at: null },
          { code: 'xyz98765', original_url: 'https://b.com', created_at: now, total_clicks: '0', last_clicked_at: null },
        ],
      });

    const app = buildApp();
    const res = await request(app).get('/api/v1/links?page=1&pageSize=20');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.pagination.totalPages).toBe(1);
  });

  it('clamps pageSize to max 100', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const app = buildApp();
    const res = await request(app).get('/api/v1/links?pageSize=999');
    expect(res.status).toBe(200);
    // Verify the query was called with pageSize=100
    const callArgs = (mockPool.query as jest.Mock).mock.calls[1];
    expect(callArgs[1][0]).toBe(100);
  });
});

describe('GET /api/v1/links/:code/stats', () => {
  it('returns 404 when link not found', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const app = buildApp();
    const res = await request(app).get('/api/v1/links/missing/stats');
    expect(res.status).toBe(404);
  });

  it('returns stats for existing link', async () => {
    const now = new Date();
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{
        code: 'abc12345',
        original_url: 'https://example.com',
        created_at: now,
        total_clicks: '7',
        last_clicked_at: now,
      }],
    });

    const app = buildApp();
    const res = await request(app).get('/api/v1/links/abc12345/stats');
    expect(res.status).toBe(200);
    expect(res.body.totalClicks).toBe(7);
  });
});

// ─── Redirect route ───────────────────────────────────────────────────────────

describe('GET /r/:code', () => {
  it('redirects 302 to original URL', async () => {
    mockCache.get.mockResolvedValueOnce({
      id: 1,
      code: 'abc12345',
      originalUrl: 'https://example.com',
      isActive: true,
      expiresAt: null,
    });
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ id: 1 }],
    });

    const app = buildApp();
    const res = await request(app).get('/r/abc12345');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com');
  });

  it('returns 404 for unknown code', async () => {
    mockCache.get.mockResolvedValueOnce(null); // null sentinel = confirmed not found

    const app = buildApp();
    const res = await request(app).get('/r/notfound');
    expect(res.status).toBe(404);
  });

  it('queues a click event after redirect', async () => {
    mockCache.get.mockResolvedValueOnce({
      id: 1,
      code: 'abc12345',
      originalUrl: 'https://example.com',
      isActive: true,
      expiresAt: null,
    });
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ id: 1 }],
    });

    const app = buildApp();
    await request(app)
      .get('/r/abc12345')
      .set('User-Agent', 'TestAgent/1.0')
      .set('Referer', 'https://google.com');

    // Give async queue call time to fire
    await new Promise(r => setTimeout(r, 10));
    expect(mockQueue.addClickEvent).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'abc12345', linkId: 1 })
    );
  });
});
