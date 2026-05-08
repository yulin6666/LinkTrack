import { Queue } from 'bullmq';
import redis from '../config/redis';

export interface ClickEvent {
  linkId: number;
  code: string;
  ipAddress: string;
  userAgent: string;
  referer: string;
  timestamp: number;
}

const clickQueue = new Queue('click-events', {
  connection: redis,
});

class QueueService {
  async addClickEvent(event: ClickEvent): Promise<void> {
    await clickQueue.add('click', event, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
  }
}

export default new QueueService();
