import { readFileSync } from 'node:fs';
import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QueueNames } from '@factuez/contracts';
import { PrismaService } from './prisma.service';

@Injectable()
export class StatusOutboxPublisher implements OnApplicationBootstrap, OnModuleDestroy {
  private evidenceQueue?: Queue;
  private readonly queue = new Queue(QueueNames.billingStatusUpdates, { connection: {
    host: process.env.REDIS_HOST ?? 'redis', port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD_FILE ? readFileSync(process.env.REDIS_PASSWORD_FILE, 'utf8').trim() : undefined,
  }});
  private timer?: NodeJS.Timeout;
  constructor(private readonly prisma: PrismaService) {}
  onApplicationBootstrap() { this.timer = setInterval(() => void this.flush(), 1_000); }
  private async flush() {
    const events = await this.prisma.outboxEvent.findMany({ where: { publishedAt: null }, orderBy: { occurredAt: 'asc' }, take: 50 });
    for (const event of events) {
      // No enviar un contrato de lote/nota a la cola que sólo consume estados
      // Billing v1. Cada consumidor mantiene su contrato/versionado propio.
      if (event.eventType === 'sunat.beta.supplement.evidence.v1' && !this.evidenceQueue) {
        this.evidenceQueue = new Queue('sunat-beta-supplement-evidence-v1', { connection: {
          host: process.env.REDIS_HOST ?? 'redis', port: Number(process.env.REDIS_PORT ?? 6379),
          password: process.env.REDIS_PASSWORD_FILE ? readFileSync(process.env.REDIS_PASSWORD_FILE, 'utf8').trim() : undefined,
        } });
        this.evidenceQueue.on('error', () => {});
      }
      const queue = event.eventType === 'sunat.beta.supplement.evidence.v1' ? this.evidenceQueue! : this.queue;
      await queue.add(event.eventType, event.payload, { jobId: event.id, attempts: 10, backoff: { type: 'exponential', delay: 1_000 } });
      await this.prisma.outboxEvent.update({ where: { id: event.id }, data: { publishedAt: new Date(), attempts: { increment: 1 } } });
    }
  }
  async onModuleDestroy() { if (this.timer) clearInterval(this.timer); await this.queue.close(); await this.evidenceQueue?.close(); }
}
