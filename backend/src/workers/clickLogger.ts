import dotenv from 'dotenv';
dotenv.config();

import { Worker } from 'bullmq';
import pool from '../config/database';
import redis from '../config/redis';
import { ClickEvent } from '../services/queueService';
import analyticsService from '../services/analyticsService';

// Batch processing configuration
const BATCH_SIZE = 100;
const BATCH_TIMEOUT_MS = 5000;

let eventBatch: ClickEvent[] = [];
let batchTimer: NodeJS.Timeout | null = null;

async function processBatch() {
  if (eventBatch.length === 0) return;

  const batch = [...eventBatch];
  eventBatch = [];

  const client = await pool.connect();
  try {
    // Parse analytics data for each event
    const enrichedBatch = batch.map(event => {
      const analytics = analyticsService.parseClickEvent(
        event.ipAddress,
        event.userAgent,
        event.referer
      );
      return { ...event, ...analytics };
    });

    // Batch insert click logs with analytics data
    const values = enrichedBatch.map((event, idx) => {
      const offset = idx * 10;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, to_timestamp($${offset + 10} / 1000.0))`;
    }).join(', ');

    const params = enrichedBatch.flatMap(event => [
      event.linkId,
      event.ipAddress,
      event.userAgent,
      event.referer,
      event.country,
      event.city,
      event.deviceType,
      event.os,
      event.browser,
      event.timestamp,
    ]);

    const insertQuery = `
      INSERT INTO click_logs (link_id, ip_address, user_agent, referer, country, city, device_type, os, browser, clicked_at)
      VALUES ${values}
    `;

    await client.query('BEGIN');

    await client.query(insertQuery, params);

    // Update click stats for each unique link
    const linkIds = [...new Set(batch.map(e => e.linkId))];

    for (const linkId of linkIds) {
      const linkEvents = batch.filter(e => e.linkId === linkId);
      const lastTimestamp = Math.max(...linkEvents.map(e => e.timestamp));

      const statsQuery = `
        INSERT INTO click_stats (link_id, total_clicks, last_clicked_at, updated_at)
        VALUES ($1, $2, to_timestamp($3 / 1000.0), NOW())
        ON CONFLICT (link_id)
        DO UPDATE SET
          total_clicks = click_stats.total_clicks + $2,
          last_clicked_at = to_timestamp($3 / 1000.0),
          updated_at = NOW()
      `;

      await client.query(statsQuery, [linkId, linkEvents.length, lastTimestamp]);
    }

    await client.query('COMMIT');

    console.log(`Batch processed ${batch.length} click events with analytics`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing batch:', error);
    // Re-add failed events back to batch for retry
    eventBatch.unshift(...batch);
    throw error;
  } finally {
    client.release();
  }
}

function scheduleBatchFlush() {
  if (batchTimer) {
    clearTimeout(batchTimer);
  }
  batchTimer = setTimeout(async () => {
    await processBatch();
    batchTimer = null;
  }, BATCH_TIMEOUT_MS);
}

const worker = new Worker(
  'click-events',
  async (job) => {
    const event: ClickEvent = job.data;

    try {
      // Add to batch
      eventBatch.push(event);

      // Flush if batch is full
      if (eventBatch.length >= BATCH_SIZE) {
        if (batchTimer) {
          clearTimeout(batchTimer);
          batchTimer = null;
        }
        await processBatch();
      } else {
        // Schedule flush if not already scheduled
        if (!batchTimer) {
          scheduleBatchFlush();
        }
      }
    } catch (error) {
      console.error('Error processing click event:', error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

console.log('Click logger worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, flushing batch and closing worker...');
  if (batchTimer) {
    clearTimeout(batchTimer);
  }
  await processBatch(); // Flush remaining events
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, flushing batch and closing worker...');
  if (batchTimer) {
    clearTimeout(batchTimer);
  }
  await processBatch(); // Flush remaining events
  await worker.close();
  process.exit(0);
});
