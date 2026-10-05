import { createHash } from 'node:crypto';
import { isProxy } from 'node:util/types';
import { HISTORY_PREVIEW_LIMITS, prepareHistoryExport, prepareHistoryRow, type HistoryPreviewRow } from './history-preview';

const VERSION = 'factuez.history-rehearsal.v1' as const;
export class HistoryRehearsalError extends Error {
  constructor(readonly code: string) { super(`Ensayo histórico bloqueado: ${code}`); delete this.stack; }
}
function check(condition: unknown, code: string): asserts condition {
  if (!condition) throw new HistoryRehearsalError(code);
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  check(value && typeof value === 'object' && !isProxy(value) && !Array.isArray(value), 'INVALID_STATE');
  check([Object.prototype, null].includes(Object.getPrototypeOf(value)), 'INVALID_STATE');
  const actual = Reflect.ownKeys(value);
  check(actual.length === keys.length && actual.every(k => typeof k === 'string' && keys.includes(k)), 'INVALID_STATE');
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    check(d?.enumerable && 'value' in d, 'INVALID_STATE');
  }
  return value as Record<string, unknown>;
}
function array(value: unknown, max: number): unknown[] {
  check(value && typeof value === 'object' && !isProxy(value) && Array.isArray(value), 'INVALID_STATE');
  check(value.length <= max && Object.getPrototypeOf(value) === Array.prototype &&
    Reflect.ownKeys(value).length === value.length + 1, 'INVALID_STATE');
  for (let i = 0; i < value.length; i++) {
    const d = Object.getOwnPropertyDescriptor(value, String(i));
    check(d?.enumerable && 'value' in d, 'INVALID_STATE');
  }
  return value;
}
// Called ONLY on explicit detached JSON assembled from validated fields.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k =>
    `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function sha(value: unknown) { return createHash('sha256').update(canonical(value)).digest('hex'); }
function frozen<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
export type HistoryCandidateRecord = Readonly<{
  archiveKey: string; fiscalIdentity: string; originIdentity: string; rowSha256: string;
  disposition: 'QUARANTINED_PENDING_FISCAL_REVIEW'; row: HistoryPreviewRow;
}>;
type Receipt = Readonly<{ index: number; rowCount: number; recordsSha256: string }>;
export type HistoryRehearsalState = Readonly<{
  schemaVersion: typeof VERSION; inputSha256: string; planSha256: string;
  completedBatches: number; records: readonly HistoryCandidateRecord[]; receipts: readonly Receipt[];
}>;

/** An immutable in-memory rehearsal, NOT an importer or database checkpoint.
 * Revalidates every metadata row and recomputes the ENTIRE completed prefix.
 * No I/O, clock, environment, credentials, counters or issuance dependencies.
 */
export function rehearseHistoryArchive(input: unknown, state?: unknown, batchBudget = 1) {
  check(Number.isSafeInteger(batchBudget) && batchBudget >= 1 && batchBudget <= 20, 'INVALID_BATCH_BUDGET');
  const { source, report } = prepareHistoryExport(input);
  check(report.status !== 'BLOCKED', 'BLOCKED_METADATA');
  const records: HistoryCandidateRecord[] = source.rows.map(row => {
    const fiscalIdentity = JSON.stringify([row.issuerRuc, row.type, row.series, row.number]);
    const originIdentity = JSON.stringify([row.companyId, 'RESTOAPP', row.originId]);
    return { archiveKey: sha({ fiscalIdentity, originIdentity }), fiscalIdentity, originIdentity,
      rowSha256: sha(row), disposition: 'QUARANTINED_PENDING_FISCAL_REVIEW', row };
  });
  const batchSize = HISTORY_PREVIEW_LIMITS.batchSize;
  const receipts: Receipt[] = [];
  for (let i = 0; i < records.length; i += batchSize) receipts.push({ index: receipts.length,
    rowCount: Math.min(batchSize, records.length - i), recordsSha256: sha(records.slice(i, i + batchSize)) });
  const inputSha256 = report.plan.inputSha256;
  const planSha256 = sha({ schemaVersion: VERSION, purpose: 'QUARANTINED_METADATA_REHEARSAL_ONLY',
    inputSha256, batchSize, receipts });
  let completed = 0;
  if (state !== undefined) {
    const s = object(state, ['schemaVersion', 'inputSha256', 'planSha256', 'completedBatches', 'records', 'receipts']);
    check(s.schemaVersion === VERSION && s.inputSha256 === inputSha256 && s.planSha256 === planSha256, 'STATE_PLAN_MISMATCH');
    check(typeof s.completedBatches === 'number' && Number.isSafeInteger(s.completedBatches) &&
      s.completedBatches >= 0 && s.completedBatches <= receipts.length, 'INVALID_STATE');
    completed = s.completedBatches;
    const savedRecords = array(s.records, HISTORY_PREVIEW_LIMITS.maxRows).map(value => object(value,
      ['archiveKey', 'fiscalIdentity', 'originIdentity', 'rowSha256', 'disposition', 'row']));
    const count = Math.min(completed * batchSize, records.length);
    check(savedRecords.length === count, 'STATE_PREFIX_MISMATCH');
    savedRecords.forEach((r, i) => {
      const expected = records[i];
      for (const key of ['archiveKey', 'fiscalIdentity', 'originIdentity', 'rowSha256', 'disposition'] as const)
        check(r[key] === expected[key], 'STATE_PREFIX_MISMATCH');
      // Validate/detach BEFORE hashing. Direct ordinal comparison rejects
      // reordered saved rows without rebuilding an entire report per record.
      // The complete export/cross-row rules were already checked above.
      const original = prepareHistoryRow(r.row);
      check(sha(original) === expected.rowSha256, 'STATE_PREFIX_MISMATCH');
    });
    const savedReceipts = array(s.receipts, 20).map(r => object(r, ['index', 'rowCount', 'recordsSha256']));
    check(savedReceipts.length === completed, 'STATE_RECEIPTS_MISMATCH');
    savedReceipts.forEach((r, i) => { const expected = receipts[i];
      check(r.index === expected.index && r.rowCount === expected.rowCount && r.recordsSha256 === expected.recordsSha256, 'STATE_RECEIPTS_MISMATCH'); });
  }
  const next = Math.min(completed + batchBudget, receipts.length);
  const previousCount = Math.min(completed * batchSize, records.length);
  const nextCount = Math.min(next * batchSize, records.length);
  const nextState: HistoryRehearsalState = { schemaVersion: VERSION, inputSha256, planSha256,
    completedBatches: next, records: records.slice(0, nextCount), receipts: receipts.slice(0, next) };
  return frozen({ schemaVersion: VERSION, simulationOnly: true as const, persisted: false as const,
    environment: 'BETA' as const, productionBlocked: true as const, databaseWrites: 0 as const,
    fiscalWrites: 0 as const, artifactCopies: 0 as const, transmission: false as const, importAllowed: false as const,
    cdrAuthenticityVerified: false as const, countersChanged: false as const,
    metadataStatus: report.status, checkpointPurpose: 'IN_MEMORY_REHEARSAL_NOT_DATABASE_COMMIT' as const,
    candidateRowCount: nextCount, addedRows: nextCount - previousCount,
    remainingBatches: receipts.length - next, complete: next === receipts.length,
    deduplicated: completed === receipts.length, state: nextState });
}
