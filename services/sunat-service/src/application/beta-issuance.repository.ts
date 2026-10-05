import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EventNames, type DocumentIssuedEventV1, type BetaStatusEvent, type FiscalDocumentSnapshot } from '@factuez/contracts';
import { buildReceiptSummarySnapshot, fiscalSnapshotSha256, isRucStructurallyValid } from '@factuez/sunat-core';
import { PrismaService } from '../infrastructure/prisma.service';
import type { BetaDispatchRow, BetaPhase, BetaPrepared, BetaCdr } from './beta-dispatch-pipeline';
import type { SunatSubmission } from '../generated/prisma/client';
export type BetaStored = { storageKey: string; sha256: string; sizeBytes: number };
export type BetaManifest = { fileName: string; reference: string; revision: number; fingerprint: string;
  requestOwnerId?: string; documentZip?: BetaStored; zip: BetaStored; xml: BetaStored; documentXml: BetaStored; digest: string; xsdEvidence: unknown };
type Metadata = { version: 1; eventId: string; correlationId: string; prepared?: BetaManifest };
const phases: BetaPhase[] = ['AWAITING_AUTHORIZATION', 'PREPARING', 'PREPARED', 'RETRY_PREPARATION', 'SENDING', 'WAITING_TICKET', 'POLLING', 'DONE', 'UNKNOWN', 'BLOCKED', 'CDR_UNVERIFIED'];

/** Persistencia propia SUNAT con tablas ya existentes; no consume ni modifica el contador de Billing. */
@Injectable()
export class BetaIssuanceRepository {
  constructor(private readonly prisma: PrismaService) {}
  stageOperation(event: DocumentIssuedEventV1) {
    const snapshot = event.payload;
    if (snapshot.environment !== 'BETA' || !['01', '03'].includes(snapshot.documentTypeCode) || !isRucStructurallyValid(snapshot.issuer.identityNumber)) return null;
    return this.prisma.sunatSubmission.upsert({ where: { idempotencyKey: `beta:${snapshot.documentId}:v1` }, update: {}, create: {
      documentId: snapshot.documentId, channel: snapshot.documentTypeCode === '01' ? 'SOAP_SEND_BILL' : 'SOAP_SEND_SUMMARY', attempt: 1,
      idempotencyKey: `beta:${snapshot.documentId}:v1`, result: 'PENDING', errorCode: 'AWAITING_AUTHORIZATION', nextRetryAt: new Date(),
      errorMessage: JSON.stringify({ version: 1, eventId: event.eventId, correlationId: event.correlationId } satisfies Metadata) } });
  }
  async load(id: string): Promise<BetaDispatchRow | null> {
    const row = await this.prisma.sunatSubmission.findUnique({ where: { id }, include: { document: true } });
    if (!row?.document || !row.idempotencyKey.startsWith('beta:') || !phases.includes(row.errorCode as BetaPhase) || row.document.environment !== 'BETA') return null;
    this.metadata(row);
    return { id, documentId: row.documentId!, phase: row.errorCode as BetaPhase, attempt: row.attempt, owner: row.startedAt,
      ticket: row.ticket, snapshot: row.document.immutablePayload as unknown as FiscalDocumentSnapshot };
  }
  private metadata(row: SunatSubmission): Metadata {
    const value = JSON.parse(row.errorMessage ?? 'null') as Metadata | null;
    if (!value || value.version !== 1 || typeof value.eventId !== 'string' || typeof value.correlationId !== 'string') throw new Error('Manifiesto Beta ausente');
    return value;
  }
  private where(row: BetaDispatchRow, phase: BetaPhase) { return { id: row.id, documentId: row.documentId, errorCode: phase,
    result: 'PENDING' as const, startedAt: row.owner, attempt: row.attempt, completedAt: null }; }
  async claim(row: BetaDispatchRow, phase: 'PREPARING' | 'POLLING') {
    const owner = new Date(), increment = row.phase === 'RETRY_PREPARATION' || phase === 'POLLING';
    const changed = await this.prisma.sunatSubmission.updateMany({ where: { ...this.where(row, row.phase), nextRetryAt: { lte: owner } },
      data: { errorCode: phase, startedAt: owner, nextRetryAt: new Date(owner.getTime() + 60000), ...(increment ? { attempt: { increment: 1 } } : {}) } });
    return changed.count === 1 ? { ...row, phase, owner, attempt: row.attempt + (increment ? 1 : 0) } : null;
  }
  async owns(row: BetaDispatchRow, phase: BetaPhase) {
    return Boolean(await this.prisma.sunatSubmission.findFirst({ where: { ...this.where(row, phase), nextRetryAt: { gt: new Date() } }, select: { id: true } }));
  }
  async manifest(row: BetaDispatchRow) {
    const stored = await this.prisma.sunatSubmission.findUniqueOrThrow({ where: { id: row.id } });
    const prepared = this.metadata(stored).prepared; if (!prepared) throw new Error('Paquete Beta no archivado'); return prepared;
  }
  async savePrepared(row: BetaDispatchRow, manifest: BetaManifest): Promise<boolean> {
    return this.prisma.$transaction(async tx => {
      const current = await tx.sunatSubmission.findUniqueOrThrow({ where: { id: row.id } });
      const credential = await tx.sunatCredentials.findUnique({ where: { issuerRuc_environment: { issuerRuc: row.snapshot.issuer.identityNumber, environment: 'BETA' } } });
      if (credential?.revision !== manifest.revision || credential.certificateFingerprint !== manifest.fingerprint) throw new Error('Revisión de certificado cambió');
      const changed = await tx.sunatSubmission.updateMany({ where: { ...this.where(row, 'PREPARING'), nextRetryAt: { gt: new Date() } },
        data: { errorCode: 'PREPARED', requestArtifactKey: manifest.zip.storageKey,
          errorMessage: JSON.stringify({ ...this.metadata(current), prepared: manifest }) } });
      if (changed.count !== 1) return false;
      for (const [kind, file, mediaType] of [['SIGNED_XML', manifest.documentXml, 'application/xml'], ['SUBMISSION_ZIP', manifest.documentZip ?? manifest.zip, 'application/zip']] as const) {
        const key = { documentId_kind: { documentId: row.documentId, kind } };
        const previous = await tx.documentArtifact.findUnique({ where: key });
        if (previous && previous.sha256 !== file.sha256) throw new Error('No se modifica artefacto fiscal preparado');
        await tx.documentArtifact.upsert({ where: key, update: {}, create: { documentId: row.documentId, kind, ...file, mediaType } });
      }
      if (row.snapshot.documentTypeCode === '03') {
        if (!current.batchId || !manifest.requestOwnerId) throw new Error('Resumen Beta no vinculado al envío');
        for (const [kind, file, mediaType] of [['SIGNED_XML', manifest.xml, 'application/xml'], ['SUBMISSION_ZIP', manifest.zip, 'application/zip']] as const) {
          const key = { batchId_kind: { batchId: current.batchId, kind } };
          const previous = await tx.batchArtifact.findUnique({ where: key });
          if (previous && previous.sha256 !== file.sha256) throw new Error('No se modifica el artefacto de un RC reservado');
          await tx.batchArtifact.upsert({ where: key, update: {}, create: { batchId: current.batchId, kind, ...file, mediaType } });
        }
      }
      await tx.fiscalDocument.update({ where: { documentId: row.documentId }, data: { digestValue: manifest.digest } });
      return true;
    });
  }
  async transition(row: BetaDispatchRow, from: BetaPhase, to: BetaPhase, details: { ticket?: string; code?: string; delayMs?: number; cdr?: BetaCdr } = {}) {
    return this.prisma.$transaction(async tx => {
      const current = await tx.sunatSubmission.findUniqueOrThrow({ where: { id: row.id } });
      const done = ['DONE', 'UNKNOWN', 'BLOCKED', 'CDR_UNVERIFIED'].includes(to);
      if (to === 'DONE' && details.cdr?.trusted !== true) throw new Error('CDR confiable requerido para finalizar');
      const completedAt = done ? new Date() : null;
      const changed = await tx.sunatSubmission.updateMany({ where: { ...this.where(row, from), nextRetryAt: { gt: new Date() } }, data: {
        errorCode: to, ...(details.ticket ? { ticket: details.ticket } : {}),
        nextRetryAt: done ? null : new Date(Date.now() + (details.delayMs ?? 60000)), completedAt,
        result: to === 'DONE' ? details.cdr?.status === 'REJECTED' ? 'BUSINESS_ERROR' : 'SUCCESS' : to === 'BLOCKED' ? 'BUSINESS_ERROR' : done ? 'UNKNOWN' : 'PENDING' } });
      if (changed.count !== 1) return false;
      const status = to === 'DONE' ? details.cdr!.status : to === 'BLOCKED' ? 'PERMANENT_ERROR' : ['UNKNOWN', 'CDR_UNVERIFIED'].includes(to) ? 'RETRYABLE_ERROR' : 'SUBMITTED';
      if (['SENDING', 'DONE', 'UNKNOWN', 'BLOCKED', 'CDR_UNVERIFIED'].includes(to)) {
        const metadata = this.metadata(current);
        const event: BetaStatusEvent = { eventId: randomUUID(), eventName: EventNames.sunatStatusChanged, occurredAt: new Date().toISOString(),
          correlationId: metadata.correlationId, causationId: metadata.eventId, producer: 'sunat-service', payload: {
            documentId: row.documentId, status, responseCode: details.code,
            description: to === 'DONE' ? details.cdr!.description : to === 'SENDING' ? 'Envío Beta en curso' : 'Beta detenido; revisar evidencia, no volver a emitir',
            evidence: { transport: 'SUNAT_BETA', environment: 'BETA', issuerRuc: row.snapshot.issuer.identityNumber, submissionId: row.id,
              officialCdr: to === 'DONE', cdrSignatureVerified: to === 'DONE' } } };
        await tx.fiscalDocument.update({ where: { documentId: row.documentId }, data: { status, ...(to === 'DONE' && status !== 'REJECTED' ? { acceptedAt: completedAt } : {}) } });
        // La vertical 03 también conserva el resultado del RC propio: no inferir
        // después aceptación de un lote QUEUED ni perder su fecha de CDR.
        if (row.snapshot.documentTypeCode === '03' && current.batchId) await tx.fiscalBatch.update({ where: { id: current.batchId }, data: { status } });
        await tx.outboxEvent.create({ data: { id: event.eventId, eventType: event.eventName, aggregateId: row.documentId, payload: JSON.parse(JSON.stringify(event)) } });
      }
      return true;
    });
  }
  async reserveSummary(row: BetaDispatchRow): Promise<string> {
    return this.prisma.$transaction(async tx => {
      const ruc = row.snapshot.issuer.identityNumber;
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', `${ruc}:BETA:supplement`);
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', `${ruc}:BETA:RC`);
      const previous = await tx.fiscalBatch.findUnique({ where: { summaryId: row.documentId } });
      if (previous) {
        if (previous.issuerRuc !== ruc || previous.environment !== 'BETA' ||
            fiscalSnapshotSha256(previous.immutablePayload) !== fiscalSnapshotSha256(buildReceiptSummarySnapshot(row.snapshot, previous.identifier)))
          throw new Error('Resumen reservado legado o inconsistente; conciliar sin reescribir');
        const existing = await tx.sunatSubmission.findUniqueOrThrow({ where: { id: row.id } });
        if (existing.batchId !== previous.id) throw new Error('Resumen reservado no vinculado al envío');
        return previous.identifier;
      }
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', '');
      if (!/^\d{8}$/.test(day)) throw new Error('Fecha RC inválida');
      const maximum = await tx.$queryRawUnsafe<{ maximum: number | null }[]>('SELECT MAX(split_part("identifier",\'-\',3)::integer) AS maximum FROM "FiscalBatch" WHERE "issuerRuc"=$1 AND "environment"=\'BETA\' AND "identifier" ~ $2', ruc, `^RC-${day}-[1-9][0-9]{0,4}$`);
      const next = (maximum[0]?.maximum ?? 0) + 1; if (next > 99999) throw new Error('Correlativo RC agotado');
      const identifier = `RC-${day}-${next}`;
      const submission = await tx.sunatSubmission.findUniqueOrThrow({ where: { id: row.id } });
      const snapshot = buildReceiptSummarySnapshot(row.snapshot, identifier);
      const batch = await tx.fiscalBatch.create({ data: { summaryId: row.documentId, issuerRuc: ruc, identifier, environment: 'BETA',
        billingEventId: this.metadata(submission).eventId, immutablePayload: JSON.parse(JSON.stringify(snapshot)) } });
      await tx.sunatSubmission.update({ where: { id: row.id }, data: { batchId: batch.id } });
      return identifier;
    });
  }
  async recoverInterrupted() {
    const expired = { idempotencyKey: { startsWith: 'beta:' }, result: 'PENDING' as const, nextRetryAt: { lte: new Date() } };
    // No reanudar automáticamente el POST de un worker muerto. Ticket sí puede volver a consultarse.
    await this.prisma.sunatSubmission.updateMany({ where: { ...expired, errorCode: 'SENDING' }, data: { errorCode: 'UNKNOWN', result: 'UNKNOWN', completedAt: new Date(), nextRetryAt: null } });
    await this.prisma.sunatSubmission.updateMany({ where: { ...expired, errorCode: 'POLLING' }, data: { errorCode: 'WAITING_TICKET', nextRetryAt: new Date() } });
    await this.prisma.sunatSubmission.updateMany({ where: { ...expired, errorCode: 'PREPARING', attempt: { lt: 3 } }, data: { errorCode: 'RETRY_PREPARATION', nextRetryAt: new Date(Date.now() + 2000) } });
    await this.prisma.sunatSubmission.updateMany({ where: { ...expired, errorCode: 'PREPARING', attempt: { gte: 3 } }, data: { errorCode: 'BLOCKED', result: 'BUSINESS_ERROR', completedAt: new Date(), nextRetryAt: null } });
  }
  async due() { return this.prisma.sunatSubmission.findMany({ where: { idempotencyKey: { startsWith: 'beta:' }, result: 'PENDING',
    errorCode: { in: ['AWAITING_AUTHORIZATION', 'RETRY_PREPARATION', 'PREPARED', 'WAITING_TICKET'] }, nextRetryAt: { lte: new Date() } }, select: { id: true, errorCode: true, attempt: true, startedAt: true }, take: 20 }); }
}
