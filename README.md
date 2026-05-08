# LinkTrack - URL Shortener with Analytics

High-performance URL shortener with real-time analytics, built with Node.js, TypeScript, PostgreSQL, Redis, and Next.js.

## Features

- **Short Link Creation**: Generate short URLs with unique codes
- **Fast Redirects**: Two-tier caching (LRU + Redis) for optimal performance
- **Click Analytics**: Track clicks, view statistics, and monitor link performance
- **Async Logging**: Non-blocking click event processing with BullMQ
- **Modern UI**: Clean, responsive interface built with Next.js and Tailwind CSS

## Tech Stack

### Backend
- Node.js 20 + TypeScript
- Express 5
- PostgreSQL 16
- Redis 7
- BullMQ (async job queue)
- nanoid (short code generation)

### Frontend
- Next.js 14
- React 18
- Tailwind CSS
- Axios

## Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- npm or yarn

## Local Setup

### 1. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### 2. Database Setup

Create PostgreSQL database:
```bash
createdb linktrack
```

Run database schema:
```bash
psql linktrack < backend/src/config/database.sql
```

### 3. Environment Variables

**Backend** - Create `backend/.env`:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://localhost:5432/linktrack
REDIS_URL=redis://localhost:6379
BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
LRU_CACHE_SIZE=1000
```

**Frontend** - Create `frontend/.env.local`:
```bash
cp frontend/.env.example frontend/.env.local
```

Edit `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Start Services

**Start PostgreSQL** (if not running):
```bash
brew services start postgresql
```

**Start Redis** (if not running):
```bash
brew services start redis
```

**Start Backend API** (Terminal 1):
```bash
cd backend
npm run dev
```

**Start BullMQ Worker** (Terminal 2):
```bash
cd backend
npm run worker
```

**Start Frontend** (Terminal 3):
```bash
cd frontend
npm run dev
```

### 5. Access Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## API Endpoints

### Create Short Link
```bash
POST /api/links
Content-Type: application/json

{
  "originalUrl": "https://example.com/very/long/url"
}
```

Response:
```json
{
  "code": "abc123XY",
  "shortUrl": "http://localhost:3001/r/abc123XY",
  "originalUrl": "https://example.com/very/long/url",
  "createdAt": "2025-05-07T10:30:00.000Z"
}
```

### Redirect
```bash
GET /r/:code
```

Returns 302 redirect to original URL.

### Get Link Statistics
```bash
GET /api/links/:code/stats
```

Response:
```json
{
  "code": "abc123XY",
  "shortUrl": "http://localhost:3001/r/abc123XY",
  "originalUrl": "https://example.com/very/long/url",
  "totalClicks": 42,
  "lastClickedAt": "2025-05-07T12:45:00.000Z",
  "createdAt": "2025-05-07T10:30:00.000Z"
}
```

### List All Links
```bash
GET /api/links
```

## Architecture

### Two-Tier Caching
1. **L1 Cache**: In-memory LRU cache (1000 entries)
2. **L2 Cache**: Redis (1-hour TTL)
3. **Fallback**: PostgreSQL database

### Async Click Logging
- Redirects return immediately (non-blocking)
- Click events queued to BullMQ
- Worker processes events in batches
- Updates both `click_logs` and `click_stats` tables

### Database Schema

**short_links**: Stores short link metadata
**click_logs**: Raw click events (partitioned by month)
**click_stats**: Aggregated statistics per link

## Production Build

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
npm start
```

## Railway Deployment

This project is Railway-ready. Each service can be deployed separately:

1. **PostgreSQL**: Railway plugin
2. **Redis**: Railway plugin
3. **Backend API**: Deploy from `backend/` directory
4. **BullMQ Worker**: Deploy as separate service or run in same container
5. **Frontend**: Deploy from `frontend/` directory

### Environment Variables on Railway

**Backend:**
- `DATABASE_URL` (auto-provided by Railway)
- `REDIS_URL` (auto-provided by Railway)
- `BASE_URL` (your backend domain)
- `FRONTEND_URL` (your frontend domain)
- `NODE_ENV=production`

**Frontend:**
- `NEXT_PUBLIC_API_URL` (your backend domain)

## Testing

### Manual Testing

1. Create a short link via UI
2. Copy the short URL
3. Open short URL in new tab (should redirect)
4. Check stats page for click count
5. Verify Redis cache: `redis-cli GET "link:abc123XY"`
6. Check database: `psql linktrack -c "SELECT * FROM click_logs;"`

### Load Testing (Optional)

Install k6:
```bash
brew install k6
```

Run basic load test:
```bash
k6 run --vus 10 --duration 30s -e CODE=abc123XY - <<'EOF'
import http from 'k6/http';
export default function() {
  http.get(`http://localhost:3001/r/${__ENV.CODE}`);
}
EOF
```

## Project Structure

```
LinkTrack/
├── backend/
│   ├── src/
│   │   ├── config/          # Database, Redis config
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── workers/         # BullMQ workers
│   │   └── server.ts        # Express app
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── app/                 # Next.js pages
│   ├── components/          # React components
│   ├── lib/                 # API client
│   ├── package.json
│   └── next.config.js
└── README.md
```

## Key Design Decisions

### Why Two-Tier Caching?
- Hot links (viral content) can generate 10K+ requests/second
- Local LRU cache eliminates Redis network latency
- Redis provides persistence across restarts

### Why BullMQ?
- Decouples redirect latency from logging
- Handles traffic spikes gracefully
- Automatic retry on failure
- Batch processing reduces DB load

### Why nanoid?
- URL-safe characters
- Collision-resistant (8 chars = 218 trillion combinations)
- Shorter than UUID
- No database lookup needed for generation

## Performance Targets

- **Redirect P99**: < 50ms
- **Cache Hit Rate**: > 95%
- **Local QPS**: > 5000 (single instance)

## License

MIT

## Author

Built as a learning project for backend development.
