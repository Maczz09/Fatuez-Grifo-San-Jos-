import { readFileSync } from 'node:fs';
import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { EventNames, QueueNames, assertBetaStatusProjection, type BetaStatusEvent, type FiscalDocumentSnapshot } from '@factuez/contracts';
import { PrismaService } from './prisma.service';
import { LivePublisher } from '@factuez/service-access';

@Injectable()
export class SunatStatusConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private worker?: Worker;
  private readonly live = new LivePublisher();
  constructor(private readonly prisma: PrismaService) {}
  onApplicationBootstrap() {
    this.worker = new Worker(QueueNames.billingStatusUpdates, (job) => this.process(job), { connection: {
      host: process.env.REDIS_HOST ?? 'redis', port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD_FILE ? readFileSync(process.env.REDIS_PASSWORD_FILE, 'utf8').trim() : undefined,
    }});
  }
  private async process(job: Job) {
    const event = job.data as BetaStatusEvent;
    if (event.eventName !== EventNames.sunatStatusChanged || !event.payload?.documentId) throw new Error('Evento de estado SUNAT inválido');
    if (await this.prisma.inboxEvent.findUnique({ where: { eventId: event.eventId } })) return;
    const status = event.payload.status === 'BUILDING' || event.payload.status === 'SIGNED' || event.payload.status === 'SUBMITTED' ? 'PROCESSING' : event.payload.status;
    await this.prisma.$transaction(async tx => {
      const document = await tx.document.findUniqueOrThrow({ where: { id: event.payload.documentId } });
      assertBetaStatusProjection(event, document.immutableSnapshot as unknown as FiscalDocumentSnapshot);
      // No degradar una respuesta final por un evento de progreso tardío o un resultado distinto.
      if (!['ACCEPTED', 'ACCEPTED_WITH_OBSERVATIONS', 'REJECTED', 'VOIDED'].includes(document.sunatStatus)) {
        const changed = await tx.document.updateMany({ where: { id: document.id, sunatStatus: document.sunatStatus }, data: {
          sunatStatus: status, sunatResponseCode: event.payload.responseCode, sunatResponseDescription: event.payload.description } });
        if (changed.count !== 1) throw new Error('Estado cambió durante la proyección');
      }
      await tx.inboxEvent.create({ data: { eventId: event.eventId, eventType: event.eventName } });
    });
    await this.live.changed(event.payload.documentId);
  }
  async onModuleDestroy() { await this.worker?.close(); await this.live.close(); }
}
