import { Worker } from 'bullmq';
import pool from '../config/database';
import redis from '../config/redis';
import { ClickEvent } from '../services/queueService';

const worker = new Worker(
  'click-events',
  async (job) => {
    const event: ClickEvent = job.data;

    try {
      // Insert click log
      const insertQuery = `
        INSERT INTO click_logs (link_id, ip_address, user_agent, referer, clicked_at)
        VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0))
      `;

      await pool.query(insertQuery, [
        event.linkId,
        event.ipAddress,
        event.userAgent,
        event.referer,
        event.timestamp,
      ]);

      // Update or insert click stats
      const statsQuery = `
        INSERT INTO click_stats (link_id, total_clicks, last_clicked_at, updated_at)
        VALUES ($1, 1, to_timestamp($2 / 1000.0), NOW())
        ON CONFLICT (link_id)
        DO UPDATE SET
          total_clicks = click_stats.total_clicks + 1,
          last_clicked_at = to_timestamp($2 / 1000.0),
          updated_at = NOW()
      `;

      await pool.query(statsQuery, [event.linkId, event.timestamp]);

      console.log(`Processed click event for link ${event.code}`);
    } catch (error) {
      console.error('Error processing click event:', error);
      throw error; // Will trigger retry
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
  console.log('SIGTERM received, closing worker...');
  await worker.close();
  process.exit(0);
});
