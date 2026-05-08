# LinkTrack MVP - Quick Start Guide

## Prerequisites Check

Before starting, ensure you have:
- ✅ Node.js 20+ installed
- ✅ PostgreSQL installed
- ✅ Redis installed

## Setup Steps

### 1. Database Setup

```bash
# Create database
createdb linktrack

# Run schema
psql linktrack < backend/src/config/database.sql
```

### 2. Start Services

```bash
# Start PostgreSQL (if not running)
brew services start postgresql

# Start Redis (if not running)
brew services start redis
```

### 3. Install Dependencies & Start Application

Open 3 terminal windows:

**Terminal 1 - Backend API:**
```bash
cd backend
npm install
npm run dev
```

**Terminal 2 - BullMQ Worker:**
```bash
cd backend
npm run worker
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### 4. Access Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health

## Testing the MVP

1. Open http://localhost:3000
2. Enter a URL (e.g., `https://github.com`)
3. Click "Shorten URL"
4. Copy the short link
5. Open the short link in a new tab (should redirect)
6. Go back and click "View Stats" to see click count

## Troubleshooting

**PostgreSQL not running:**
```bash
brew services start postgresql
```

**Redis not running:**
```bash
brew services start redis
```

**Port already in use:**
- Backend: Change `PORT` in `backend/.env`
- Frontend: Change port in `frontend/package.json` dev script

**Database connection error:**
- Check `DATABASE_URL` in `backend/.env`
- Verify database exists: `psql -l | grep linktrack`

**Redis connection error:**
- Check `REDIS_URL` in `backend/.env`
- Test Redis: `redis-cli ping` (should return "PONG")

## What's Included in MVP

✅ Short link creation with nanoid (8 chars)
✅ Fast redirects with two-tier caching (LRU + Redis)
✅ Async click logging with BullMQ
✅ Click statistics tracking
✅ Clean, responsive UI
✅ Railway-ready configuration

## Next Steps

After MVP is working:
- Add custom short codes
- Add link expiration
- Add more analytics (device, location, referer)
- Add charts and visualizations
- Add user authentication
- Deploy to Railway

## Project Structure

```
LinkTrack/
├── backend/          # Node.js + TypeScript API
│   ├── src/
│   │   ├── config/   # Database, Redis
│   │   ├── routes/   # API endpoints
│   │   ├── services/ # Business logic
│   │   └── workers/  # BullMQ workers
│   └── .env          # Environment variables
├── frontend/         # Next.js UI
│   ├── app/          # Pages
│   ├── components/   # React components
│   ├── lib/          # API client
│   └── .env.local    # Environment variables
└── README.md         # Full documentation
```

## Environment Variables

**Backend (.env):**
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `BASE_URL`: Backend URL (for short links)
- `FRONTEND_URL`: Frontend URL (for CORS)

**Frontend (.env.local):**
- `NEXT_PUBLIC_API_URL`: Backend API URL

All environment files are already created with correct values for local development.
