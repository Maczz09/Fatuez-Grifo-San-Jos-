import { createHash } from 'node:crypto';
import { isProxy } from 'node:util/types';

/**
 * Phase 3 preparation only: a synchronous, deterministic function of JSON data.
 * It reads no files, databases, credentials, environment variables or clock.
 * Node's SHA-256 primitive only hashes the supplied, canonicalized metadata.
 * This contract is NOT IssueDocumentCommandV1 and cannot authorize issuance.
 */
export const HISTORY_PREVIEW_LIMITS = Object.freeze({
  maxRows: 10_000,
  maxGroups: 1_000, // Per reconciliation dimension, independent of row count.
  maxNumber: '99999999',
  maxArtifactsPerRow: 8,
  maxArtifactSizeBytes: 100 * 1024 * 1024,
  maxDeclaredArtifactBytes: 1024 * 1024 * 1024,
  maxTaxesPerRow: 16,
  maxDiagnosticExamples: 100,
  maxRowOrdinalsPerExample: 10,
  maxGapRanges: 20,
  batchSize: 500,
} as const);

export type HistoryDocumentType = '01' | '03' | '07' | '08';
export type HistoryCurrency = 'PEN' | 'USD';
export type HistoryArtifactKind =
  | 'UNSIGNED_XML' | 'SIGNED_XML' | 'SUBMISSION_ZIP' | 'CDR_XML' | 'CDR_ZIP'
  | 'PDF_TICKET_80MM' | 'PDF_A4' | 'DELIVERY_ZIP';

/** Names match Billing's Decimal(18,2) columns; all fields are mandatory. */
export interface HistoryAmounts {
  readonly taxableAmount: string;
  readonly exemptAmount: string;
  readonly unaffectedAmount: string;
  readonly freeAmount: string;
  readonly discountTotal: string;
  readonly igvAmount: string;
  readonly iscAmount: string;
  readonly otherTaxesAmount: string;
  readonly payableAmount: string;
}

/** Explicit declaration, never a lookup or an inferred owner. UUIDs are IDs. */
export interface OwnIssuerMapping {
  readonly issuerRuc: string;
  readonly companyId: number;
  readonly branchId: string;
  readonly emissionPointId: string;
  readonly seriesCounterId: string;
  readonly type: HistoryDocumentType;
  readonly series: string;
}

export interface HistoryTax {
  readonly taxSchemeId: string;
  readonly taxName: string;
  readonly taxableAmount: string;
  readonly taxAmount: string;
}

export interface HistoryArtifactMetadata {
  readonly kind: HistoryArtifactKind;
  readonly originalName: string; // Original basename, not a path or URL.
  readonly sha256: string;
  readonly sizeBytes: number;
}

export interface HistoryPreviewRow {
  readonly issuerRuc: string;
  readonly companyId: number;
  readonly type: HistoryDocumentType;
  readonly series: string;
  readonly number: string; // Positive canonical integer, at most eight digits.
  readonly issueDate: string; // Strict calendar ISO datetime with explicit zone.
  readonly currencyCode: HistoryCurrency;
  readonly originId: string;
  /**
   * Normalized NET bases: discounts are already included in the three payable
   * bases. discountTotal is informational and is not subtracted a second time.
   * freeAmount is informational, not payable. Notes use positive face values;
   * totals below do not net credit notes against invoices or debit notes.
   */
  readonly amounts: HistoryAmounts;
  /** DocumentTax metadata; its taxAmount sum must equal IGV + ISC + other. */
  readonly tax: readonly HistoryTax[];
  readonly artifacts: readonly HistoryArtifactMetadata[];
  readonly ownIssuerMapping: OwnIssuerMapping;
}

/** No production export, executable commands, raw artifacts or optional defaults. */
export interface NormalizedHistoryExport {
  readonly schemaVersion: 'factuez.history-normalized.v1';
  readonly environment: 'BETA';
  readonly originSystem: 'RESTOAPP';
  readonly rows: readonly HistoryPreviewRow[];
}

/** Caller-declared progress of VALIDATION batches only, not persisted imports. */
export interface HistoryPreviewCheckpoint {
  readonly inputSha256: string;
  readonly planSha256: string;
  readonly completedBatches: number;
}

export class HistoryPreviewValidationError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, path: string) {
    super(`Historical dry-run rejected: ${code} at ${path}`);
    this.name = 'HistoryPreviewValidationError';
    this.code = code;
    this.path = path;
  }
}

export type HistoryIssueCode = 'DUPLICATE_FISCAL_IDENTITY' | 'DUPLICATE_ORIGIN_ID'
  | 'ORIGIN_ID_REUSED_ACROSS_ISSUERS' | 'MAPPING_CONFLICT'
  | 'PAYABLE_MISMATCH' | 'TAX_TOTAL_MISMATCH' | 'CDR_ABSENT';

export interface HistoryDiagnostic {
  readonly code: HistoryIssueCode;
  readonly severity: 'BLOCKING' | 'REVIEW';
  readonly key: string; // JSON tuple, so separators inside originId cannot collide.
  readonly rowOrdinals: readonly number[]; // Zero-based canonical order, bounded.
  readonly affectedRows: number;
}

export interface HistoryGapSummary {
  readonly missingCount: string;
  readonly rangeCount: number;
  readonly ranges: readonly { from: string; to: string; count: string }[];
  readonly truncated: boolean;
}

export interface HistoryIssuerTotals {
  readonly issuerRuc: string;
  readonly currencyCode: HistoryCurrency;
  readonly rowCount: number;
  readonly amounts: HistoryAmounts;
}

export interface HistorySeriesTotals extends HistoryIssuerTotals {
  readonly type: HistoryDocumentType;
  readonly series: string;
}

export interface HistorySeriesRange {
  readonly issuerRuc: string;
  readonly type: HistoryDocumentType;
  readonly series: string;
  readonly rowCount: number;
  readonly distinctNumberCount: number;
  readonly minNumber: string;
  readonly maxNumber: string;
  /** Only internal holes between observed numbers, across ALL currencies. */
  readonly gaps: HistoryGapSummary;
}

export interface HistoryPreviewReport {
  readonly schemaVersion: 'factuez.history-preview.v1';
  readonly dryRun: true;
  readonly fiscalWrites: 0;
  readonly transmission: false;
  readonly environment: 'BETA';
  readonly productionBlocked: true;
  readonly status: 'BLOCKED' | 'REVIEW_REQUIRED' | 'CONSISTENT_METADATA';
  readonly rowCount: number;
  readonly totalsBasis: 'EXPORTED_ROWS_INCLUDING_DUPLICATES_UNSIGNED_NOT_NETTED';
  readonly artifacts: {
    readonly assessment: 'DECLARED_METADATA_ONLY_NOT_VERIFIED';
    readonly count: number;
    readonly declaredSizeBytes: string;
    readonly rowsWithCdrMetadata: number;
    readonly rowsRequiringCdrReview: number;
  };
  readonly duplicates: {
    readonly fiscalIdentityGroups: number;
    readonly fiscalIdentityRows: number;
    readonly originIdGroups: number;
    readonly originIdRows: number;
    readonly originIdsReusedAcrossIssuers: number;
  };
  readonly diagnostics: {
    readonly blockingCount: number;
    readonly reviewCount: number;
    readonly byCode: Readonly<Partial<Record<HistoryIssueCode, number>>>;
    readonly examples: readonly HistoryDiagnostic[];
    readonly truncated: boolean;
  };
  readonly totalsByIssuerCurrency: readonly HistoryIssuerTotals[];
  readonly totalsBySeries: readonly HistorySeriesTotals[]; // RUC/type/series/currency.
  readonly seriesRanges: readonly HistorySeriesRange[]; // RUC/type/series, no currency split.
  readonly plan: {
    readonly schemaVersion: 'factuez.history-preview.plan.v1';
    readonly purpose: 'VALIDATION_ONLY';
    readonly inputSha256: string;
    readonly planSha256: string;
    readonly rowCount: number;
    readonly batchSize: number;
    readonly batches: readonly {
      index: number; startOrdinal: number; endOrdinalExclusive: number;
      rowCount: number; rowsSha256: string;
    }[];
  };
  readonly resume: {
    readonly checkpoint: HistoryPreviewCheckpoint;
    readonly remainingBatches: number;
    readonly nextBatchIndex: number | null;
  };
  readonly limits: typeof HISTORY_PREVIEW_LIMITS;
}

const AMOUNT_KEYS = [
  'taxableAmount', 'exemptAmount', 'unaffectedAmount', 'freeAmount',
  'discountTotal', 'igvAmount', 'iscAmount', 'otherTaxesAmount', 'payableAmount',
] as const satisfies readonly (keyof HistoryAmounts)[];
const ARTIFACT_KINDS: readonly HistoryArtifactKind[] = [
  'UNSIGNED_XML', 'SIGNED_XML', 'SUBMISSION_ZIP', 'CDR_XML', 'CDR_ZIP',
  'PDF_TICKET_80MM', 'PDF_A4', 'DELIVERY_ZIP',
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;

function reject(code: string, path: string): never {
  throw new HistoryPreviewValidationError(code, path);
}

/** Strict JSON objects only: reject extras, symbols, accessors and hidden keys. */
function object(value: unknown, keys: readonly string[], path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object') reject('OBJECT_REQUIRED', path);
  if (isProxy(value)) reject('NON_JSON_OBJECT', path);
  if (Array.isArray(value)) reject('OBJECT_REQUIRED', path);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) reject('NON_JSON_OBJECT', path);
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some(key => typeof key !== 'string' || !keys.includes(key))) {
    reject('UNKNOWN_OR_MISSING_KEYS', path);
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) reject('NON_JSON_PROPERTY', path);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, maximum: number, path: string): unknown[] {
  if (value === null || typeof value !== 'object') reject('ARRAY_REQUIRED', path);
  if (isProxy(value)) reject('NON_JSON_ARRAY', path);
  if (!Array.isArray(value)) reject('ARRAY_REQUIRED', path);
  if (value.length > maximum) reject('LIMIT_EXCEEDED', path);
  if (Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1) {
    reject('NON_JSON_ARRAY', path);
  }
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) reject('NON_JSON_ARRAY', path);
  }
  return value;
}

function string(value: unknown, maximum: number, path: string): string {
  if (typeof value !== 'string' || !value.length || value.length > maximum
    || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) reject('INVALID_STRING', path);
  return value;
}

function matching(value: unknown, maximum: number, pattern: RegExp, path: string): string {
  const result = string(value, maximum, path);
  if (!pattern.test(result)) reject('INVALID_FORMAT', path);
  return result;
}

function integer(value: unknown, minimum: number, maximum: number, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    reject('INVALID_INTEGER', path);
  }
  return value;
}

function oneOf<T extends string>(value: unknown, values: readonly T[], path: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) reject('UNSUPPORTED_VALUE', path);
  return value as T;
}

function money(value: unknown, path: string): string {
  const text = matching(value, 19, /^(0|[1-9][0-9]{0,15})(?:\.[0-9]{1,2})?$/, path);
  const [whole, fraction = ''] = text.split('.');
  return `${whole}.${fraction.padEnd(2, '0')}`;
}

function cents(value: string): bigint {
  return BigInt(value.replace('.', ''));
}

function decimal(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}

function dateWithZone(value: unknown, path: string): string {
  const text = string(value, 29, path);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(text);
  if (!match) reject('INVALID_DATE_WITH_ZONE', path);
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const zone = match[7];
  const zoneHours = zone === 'Z' ? 0 : Number(zone.slice(1, 3));
  const zoneMinutes = zone === 'Z' ? 0 : Number(zone.slice(4, 6));
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > days[month - 1]
    || hour > 23 || minute > 59 || second > 59 || zone === '-00:00'
    || zoneHours > 14 || zoneMinutes > 59 || (zoneHours === 14 && zoneMinutes !== 0)) {
    reject('INVALID_DATE_WITH_ZONE', path);
  }
  return text;
}

function normalizeRow(value: unknown, path: string): HistoryPreviewRow {
  const row = object(value, [
    'issuerRuc', 'companyId', 'type', 'series', 'number', 'issueDate', 'currencyCode',
    'originId', 'amounts', 'tax', 'artifacts', 'ownIssuerMapping',
  ], path);
  const issuerRuc = matching(row.issuerRuc, 11, /^[0-9]{11}$/, `${path}.issuerRuc`);
  const companyId = integer(row.companyId, 1, 2_147_483_647, `${path}.companyId`);
  const type = oneOf(row.type, ['01', '03', '07', '08'] as const, `${path}.type`);
  const series = matching(row.series, 4, /^[FB][A-Z0-9]{3}$/, `${path}.series`);
  if ((type === '01' && series[0] !== 'F') || (type === '03' && series[0] !== 'B')) {
    reject('SERIES_TYPE_MISMATCH', `${path}.series`);
  }
  const number = matching(row.number, 8, /^[1-9][0-9]{0,7}$/, `${path}.number`);
  const issueDate = dateWithZone(row.issueDate, `${path}.issueDate`);
  const currencyCode = oneOf(row.currencyCode, ['PEN', 'USD'] as const, `${path}.currencyCode`);
  const originId = string(row.originId, 120, `${path}.originId`);
  const rawAmounts = object(row.amounts, AMOUNT_KEYS, `${path}.amounts`);
  const amounts = Object.fromEntries(AMOUNT_KEYS.map(key => [key, money(rawAmounts[key], `${path}.amounts.${key}`)])) as unknown as HistoryAmounts;
  const rawMapping = object(row.ownIssuerMapping, [
    'issuerRuc', 'companyId', 'branchId', 'emissionPointId', 'seriesCounterId', 'type', 'series',
  ], `${path}.ownIssuerMapping`);
  if (rawMapping.issuerRuc !== issuerRuc || rawMapping.companyId !== companyId
    || rawMapping.type !== type || rawMapping.series !== series) reject('OWN_ISSUER_MAPPING_MISMATCH', `${path}.ownIssuerMapping`);
  const ownIssuerMapping: OwnIssuerMapping = {
    issuerRuc, companyId, type, series,
    branchId: matching(rawMapping.branchId, 36, UUID, `${path}.ownIssuerMapping.branchId`).toLowerCase(),
    emissionPointId: matching(rawMapping.emissionPointId, 36, UUID, `${path}.ownIssuerMapping.emissionPointId`).toLowerCase(),
    seriesCounterId: matching(rawMapping.seriesCounterId, 36, UUID, `${path}.ownIssuerMapping.seriesCounterId`).toLowerCase(),
  };
  const seenTaxes = new Set<string>();
  const tax = array(row.tax, HISTORY_PREVIEW_LIMITS.maxTaxesPerRow, `${path}.tax`).map((value, index): HistoryTax => {
    const taxPath = `${path}.tax[${index}]`;
    const item = object(value, ['taxSchemeId', 'taxName', 'taxableAmount', 'taxAmount'], taxPath);
    const taxSchemeId = matching(item.taxSchemeId, 4, /^[0-9]{4}$/, `${taxPath}.taxSchemeId`);
    if (seenTaxes.has(taxSchemeId)) reject('DUPLICATE_TAX_SCHEME', taxPath);
    seenTaxes.add(taxSchemeId);
    return {
      taxSchemeId, taxName: string(item.taxName, 20, `${taxPath}.taxName`),
      taxableAmount: money(item.taxableAmount, `${taxPath}.taxableAmount`),
      taxAmount: money(item.taxAmount, `${taxPath}.taxAmount`),
    };
  }).sort((a, b) => compare(a.taxSchemeId, b.taxSchemeId));
  const seenArtifacts = new Set<string>();
  const artifacts = array(row.artifacts, HISTORY_PREVIEW_LIMITS.maxArtifactsPerRow, `${path}.artifacts`).map((value, index): HistoryArtifactMetadata => {
    const artifactPath = `${path}.artifacts[${index}]`;
    const item = object(value, ['kind', 'originalName', 'sha256', 'sizeBytes'], artifactPath);
    const kind = oneOf(item.kind, ARTIFACT_KINDS, `${artifactPath}.kind`);
    if (seenArtifacts.has(kind)) reject('DUPLICATE_ARTIFACT_KIND', artifactPath);
    seenArtifacts.add(kind);
    const originalName = string(item.originalName, 255, `${artifactPath}.originalName`);
    if (/[\\/:*?"<>|]/.test(originalName) || /[. ]$/.test(originalName)
      || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(originalName)) reject('INVALID_ARTIFACT_NAME', `${artifactPath}.originalName`);
    return {
      kind, originalName,
      sha256: matching(item.sha256, 64, SHA256, `${artifactPath}.sha256`).toLowerCase(),
      sizeBytes: integer(item.sizeBytes, 1, HISTORY_PREVIEW_LIMITS.maxArtifactSizeBytes, `${artifactPath}.sizeBytes`),
    };
  }).sort((a, b) => compare(a.kind, b.kind));
  return { issuerRuc, companyId, type, series, number, issueDate, currencyCode, originId, amounts, tax, artifacts, ownIssuerMapping };
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0; // Locale-independent.
}

function tuple(...values: (string | number)[]): string {
  return JSON.stringify(values);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort(compare).map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown): string {
  return createHash('sha256').update(canonical(value), 'utf8').digest('hex');
}

type Totals = { rowCount: number; amounts: Record<keyof HistoryAmounts, bigint> };
function newTotals(): Totals {
  return { rowCount: 0, amounts: Object.fromEntries(AMOUNT_KEYS.map(key => [key, 0n])) as Record<keyof HistoryAmounts, bigint> };
}
function addTotals(totals: Totals, amounts: HistoryAmounts): void {
  totals.rowCount++;
  for (const key of AMOUNT_KEYS) totals.amounts[key] += cents(amounts[key]);
}
function displayTotals(totals: Totals): { rowCount: number; amounts: HistoryAmounts } {
  return {
    rowCount: totals.rowCount,
    amounts: Object.fromEntries(AMOUNT_KEYS.map(key => [key, decimal(totals.amounts[key])])) as unknown as HistoryAmounts,
  };
}
function boundedGroup<T>(map: Map<string, T>, key: string, create: () => T, dimension: string): T {
  let value = map.get(key);
  if (value === undefined) {
    if (map.size >= HISTORY_PREVIEW_LIMITS.maxGroups) reject('GROUP_LIMIT_EXCEEDED', dimension);
    value = create();
    map.set(key, value);
  }
  return value;
}

function gaps(numbers: readonly bigint[]): HistoryGapSummary {
  let missingCount = 0n;
  let rangeCount = 0;
  const ranges: { from: string; to: string; count: string }[] = [];
  for (let index = 1; index < numbers.length; index++) {
    const count = numbers[index] - numbers[index - 1] - 1n;
    if (count <= 0n) continue;
    missingCount += count;
    rangeCount++;
    if (ranges.length < HISTORY_PREVIEW_LIMITS.maxGapRanges) {
      ranges.push({ from: (numbers[index - 1] + 1n).toString(), to: (numbers[index] - 1n).toString(), count: count.toString() });
    }
  }
  return { missingCount: missingCount.toString(), rangeCount, ranges, truncated: rangeCount > ranges.length };
}

/**
 * Throws for malformed/unknown data and limits (no partial report). Well-formed
 * duplicates, inconsistent mapping declarations or money mismatches BLOCK the
 * report. Absent CDR metadata requires REVIEW. Present metadata proves neither
 * file integrity nor SUNAT acceptance. All rows contribute to raw totals, even
 * blocked rows; those totals must not be treated as a reconciled import total.
 * Every call revalidates the WHOLE export, including when a checkpoint is given.
 */
export function previewHistory(input: unknown, checkpoint?: unknown): HistoryPreviewReport {
  return checkedReport(normalizedRows(input), checkpoint);
}

function checkedReport(rows: ReturnType<typeof normalizedRows>, checkpoint?: unknown): HistoryPreviewReport {
  let declaredArtifactBytes = 0;
  let artifactCount = 0;
  for (const { row } of rows) {
    for (const artifact of row.artifacts) {
      declaredArtifactBytes += artifact.sizeBytes;
      artifactCount++;
      if (declaredArtifactBytes > HISTORY_PREVIEW_LIMITS.maxDeclaredArtifactBytes) reject('ARTIFACT_BYTES_LIMIT_EXCEEDED', 'export.rows');
    }
  }

  return reportRows(rows, declaredArtifactBytes, artifactCount, checkpoint);
}

function normalizedRows(input: unknown) {
  const source = object(input, ['schemaVersion', 'environment', 'originSystem', 'rows'], 'export');
  oneOf(source.schemaVersion, ['factuez.history-normalized.v1'], 'export.schemaVersion');
  oneOf(source.environment, ['BETA'], 'export.environment');
  oneOf(source.originSystem, ['RESTOAPP'], 'export.originSystem');
  return array(source.rows, HISTORY_PREVIEW_LIMITS.maxRows, 'export.rows')
    .map((row, index) => normalizeRow(row, `export.rows[${index}]`))
    .map(row => ({ row, rowSha256: hash(row) }))
    .sort((a, b) => compare(tuple(a.row.issuerRuc, a.row.type, a.row.series), tuple(b.row.issuerRuc, b.row.type, b.row.series))
      || compareIntegers(a.row.number, b.row.number) || compare(a.row.originId, b.row.originId) || compare(a.rowSha256, b.rowSha256));
}

/** Detached, canonical and recursively frozen metadata; never reads artifacts.
 * The report and source bind the SAME export. Callers may await safely without
 * allowing mutation of the supplied object to rewrite hashes or ownership.
 */
export function prepareHistoryExport(input: unknown): Readonly<{
  source: NormalizedHistoryExport; report: HistoryPreviewReport;
}> {
  const rows = normalizedRows(input);
  const report = checkedReport(rows);
  const source: NormalizedHistoryExport = {
    schemaVersion: 'factuez.history-normalized.v1', environment: 'BETA', originSystem: 'RESTOAPP',
    rows: rows.map(entry => entry.row),
  };
  if (hash(source) !== report.plan.inputSha256) reject('INPUT_CHANGED', 'export');
  return freezeHistory({ source, report });
}

/** Single detached row for exact checkpoint comparison, NOT an export report.
 * Caller must first validate the complete BETA export and its cross-row rules.
 * Never computes receipts, authorization, fiscal acceptance or financial totals.
 */
export function prepareHistoryRow(input: unknown): HistoryPreviewRow {
  return freezeHistory(normalizeRow(input, 'checkpoint.row'));
}

function freezeHistory<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeHistory(child);
    Object.freeze(value);
  }
  return value;
}

function reportRows(rows: ReturnType<typeof normalizedRows>, declaredArtifactBytes: number,
  artifactCount: number, checkpoint?: unknown): HistoryPreviewReport {

  const examples: HistoryDiagnostic[] = [];
  const byCode: Partial<Record<HistoryIssueCode, number>> = {};
  let blockingCount = 0;
  let reviewCount = 0;
  function issue(code: HistoryIssueCode, severity: HistoryDiagnostic['severity'], key: string, ordinals: readonly number[]): void {
    byCode[code] = (byCode[code] ?? 0) + 1;
    if (severity === 'BLOCKING') blockingCount++;
    else reviewCount++;
    if (examples.length < HISTORY_PREVIEW_LIMITS.maxDiagnosticExamples) {
      examples.push({ code, severity, key, rowOrdinals: ordinals.slice(0, HISTORY_PREVIEW_LIMITS.maxRowOrdinalsPerExample), affectedRows: ordinals.length });
    }
  }
  const issuers = new Map<string, { issuerRuc: string; currencyCode: HistoryCurrency; totals: Totals }>();
  const seriesTotals = new Map<string, { issuerRuc: string; currencyCode: HistoryCurrency; type: HistoryDocumentType; series: string; totals: Totals }>();
  const seriesNumbers = new Map<string, { issuerRuc: string; type: HistoryDocumentType; series: string; rowCount: number; numbers: Set<string> }>();
  const fiscalIdentities = new Map<string, number[]>();
  const originIdentities = new Map<string, number[]>();
  const originsAcrossIssuers = new Map<string, { issuers: Set<string>; ordinals: number[] }>();
  const ownership = new Map<string, { value: string; ordinal: number }>();
  function owner(scope: string, key: string | number, value: string, ordinal: number): void {
    const ownerKey = tuple(scope, key);
    const previous = ownership.get(ownerKey);
    if (!previous) ownership.set(ownerKey, { value, ordinal });
    else if (previous.value !== value) issue('MAPPING_CONFLICT', 'BLOCKING', ownerKey, [previous.ordinal, ordinal]);
  }
  let rowsWithCdrMetadata = 0;
  rows.forEach(({ row }, ordinal) => {
    const fiscalKey = tuple(row.issuerRuc, row.type, row.series, row.number);
    const fiscalOrdinals = fiscalIdentities.get(fiscalKey) ?? [];
    fiscalOrdinals.push(ordinal);
    fiscalIdentities.set(fiscalKey, fiscalOrdinals);
    // Billing's unique(companyId, originSystem, originId), protected by the RUC bijection.
    const originKey = tuple(row.companyId, 'RESTOAPP', row.originId);
    const originOrdinals = originIdentities.get(originKey) ?? [];
    originOrdinals.push(ordinal);
    originIdentities.set(originKey, originOrdinals);
    const origin = originsAcrossIssuers.get(row.originId) ?? { issuers: new Set<string>(), ordinals: [] };
    origin.issuers.add(row.issuerRuc);
    origin.ordinals.push(ordinal);
    originsAcrossIssuers.set(row.originId, origin);

    const mapping = row.ownIssuerMapping;
    owner('companyId', row.companyId, row.issuerRuc, ordinal);
    owner('issuerRuc', row.issuerRuc, String(row.companyId), ordinal);
    owner('branchId', mapping.branchId, tuple(row.companyId), ordinal);
    owner('emissionPointId', mapping.emissionPointId, tuple(row.companyId, mapping.branchId), ordinal);
    owner('seriesCounterId', mapping.seriesCounterId, tuple(row.companyId, row.type, row.series, mapping.emissionPointId), ordinal);
    owner('fiscalSeries', tuple(row.issuerRuc, row.type, row.series), tuple(row.companyId, mapping.branchId, mapping.emissionPointId, mapping.seriesCounterId), ordinal);

    const a = row.amounts;
    const taxes = cents(a.igvAmount) + cents(a.iscAmount) + cents(a.otherTaxesAmount);
    const payable = cents(a.taxableAmount) + cents(a.exemptAmount) + cents(a.unaffectedAmount) + taxes;
    if (payable !== cents(a.payableAmount)) issue('PAYABLE_MISMATCH', 'BLOCKING', fiscalKey, [ordinal]);
    if (row.tax.reduce((sum, tax) => sum + cents(tax.taxAmount), 0n) !== taxes) issue('TAX_TOTAL_MISMATCH', 'BLOCKING', fiscalKey, [ordinal]);
    if (row.artifacts.some(artifact => artifact.kind === 'CDR_XML' || artifact.kind === 'CDR_ZIP')) rowsWithCdrMetadata++;
    else issue('CDR_ABSENT', 'REVIEW', fiscalKey, [ordinal]);

    const issuer = boundedGroup(issuers, tuple(row.issuerRuc, row.currencyCode), () => ({
      issuerRuc: row.issuerRuc, currencyCode: row.currencyCode, totals: newTotals(),
    }), 'totalsByIssuerCurrency');
    addTotals(issuer.totals, a);
    const series = boundedGroup(seriesTotals, tuple(row.issuerRuc, row.type, row.series, row.currencyCode), () => ({
      issuerRuc: row.issuerRuc, currencyCode: row.currencyCode, type: row.type, series: row.series,
      totals: newTotals(),
    }), 'totalsBySeries');
    addTotals(series.totals, a);
    const range = boundedGroup(seriesNumbers, tuple(row.issuerRuc, row.type, row.series), () => ({
      issuerRuc: row.issuerRuc, type: row.type, series: row.series, rowCount: 0, numbers: new Set<string>(),
    }), 'seriesRanges');
    range.rowCount++;
    range.numbers.add(row.number);
  });

  const duplicates = { fiscalIdentityGroups: 0, fiscalIdentityRows: 0, originIdGroups: 0, originIdRows: 0, originIdsReusedAcrossIssuers: 0 };
  for (const [key, ordinals] of sortedEntries(fiscalIdentities)) {
    if (ordinals.length < 2) continue;
    duplicates.fiscalIdentityGroups++;
    duplicates.fiscalIdentityRows += ordinals.length;
    issue('DUPLICATE_FISCAL_IDENTITY', 'BLOCKING', key, ordinals);
  }
  for (const [key, ordinals] of sortedEntries(originIdentities)) {
    if (ordinals.length < 2) continue;
    duplicates.originIdGroups++;
    duplicates.originIdRows += ordinals.length;
    issue('DUPLICATE_ORIGIN_ID', 'BLOCKING', key, ordinals);
  }
  for (const [originId, origin] of sortedEntries(originsAcrossIssuers)) {
    if (origin.issuers.size < 2) continue;
    duplicates.originIdsReusedAcrossIssuers++;
    issue('ORIGIN_ID_REUSED_ACROSS_ISSUERS', 'REVIEW', tuple('RESTOAPP', originId), origin.ordinals);
  }

  const inputSha256 = hash({
    schemaVersion: 'factuez.history-normalized.v1', environment: 'BETA', originSystem: 'RESTOAPP', rows: rows.map(entry => entry.row),
  });
  const batches: HistoryPreviewReport['plan']['batches'][number][] = [];
  for (let start = 0; start < rows.length; start += HISTORY_PREVIEW_LIMITS.batchSize) {
    const end = Math.min(start + HISTORY_PREVIEW_LIMITS.batchSize, rows.length);
    batches.push({
      index: batches.length, startOrdinal: start, endOrdinalExclusive: end, rowCount: end - start,
      rowsSha256: hash(rows.slice(start, end).map(entry => entry.rowSha256)),
    });
  }
  const planBody = {
    schemaVersion: 'factuez.history-preview.plan.v1' as const, purpose: 'VALIDATION_ONLY' as const,
    inputSha256, rowCount: rows.length, batchSize: HISTORY_PREVIEW_LIMITS.batchSize, batches,
  };
  const planSha256 = hash(planBody);
  let completedBatches = 0;
  if (checkpoint !== undefined) {
    const progress = object(checkpoint, ['inputSha256', 'planSha256', 'completedBatches'], 'checkpoint');
    matching(progress.inputSha256, 64, SHA256, 'checkpoint.inputSha256');
    matching(progress.planSha256, 64, SHA256, 'checkpoint.planSha256');
    if (progress.inputSha256 !== inputSha256 || progress.planSha256 !== planSha256) reject('CHECKPOINT_HASH_MISMATCH', 'checkpoint');
    completedBatches = integer(progress.completedBatches, 0, batches.length, 'checkpoint.completedBatches');
  }
  return {
    schemaVersion: 'factuez.history-preview.v1', dryRun: true, fiscalWrites: 0, transmission: false,
    environment: 'BETA', productionBlocked: true,
    status: blockingCount ? 'BLOCKED' : reviewCount ? 'REVIEW_REQUIRED' : 'CONSISTENT_METADATA',
    rowCount: rows.length, totalsBasis: 'EXPORTED_ROWS_INCLUDING_DUPLICATES_UNSIGNED_NOT_NETTED',
    artifacts: {
      assessment: 'DECLARED_METADATA_ONLY_NOT_VERIFIED', count: artifactCount,
      declaredSizeBytes: String(declaredArtifactBytes), rowsWithCdrMetadata,
      rowsRequiringCdrReview: rows.length - rowsWithCdrMetadata,
    },
    duplicates,
    diagnostics: { blockingCount, reviewCount, byCode, examples, truncated: blockingCount + reviewCount > examples.length },
    totalsByIssuerCurrency: sortedEntries(issuers).map(([, group]) => ({ issuerRuc: group.issuerRuc, currencyCode: group.currencyCode, ...displayTotals(group.totals) })),
    totalsBySeries: sortedEntries(seriesTotals).map(([, group]) => ({ issuerRuc: group.issuerRuc, type: group.type, series: group.series, currencyCode: group.currencyCode, ...displayTotals(group.totals) })),
    seriesRanges: sortedEntries(seriesNumbers).map(([, group]) => {
      const numbers = [...group.numbers].map(BigInt).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
      return {
        issuerRuc: group.issuerRuc, type: group.type, series: group.series, rowCount: group.rowCount,
        distinctNumberCount: numbers.length, minNumber: String(numbers[0]), maxNumber: String(numbers[numbers.length - 1]), gaps: gaps(numbers),
      };
    }),
    plan: { ...planBody, planSha256 },
    resume: {
      checkpoint: { inputSha256, planSha256, completedBatches }, remainingBatches: batches.length - completedBatches,
      nextBatchIndex: completedBatches < batches.length ? completedBatches : null,
    },
    limits: HISTORY_PREVIEW_LIMITS,
  };
}

function compareIntegers(a: string, b: string): number {
  return a.length - b.length || compare(a, b);
}

function sortedEntries<T>(map: Map<string, T>): [string, T][] {
  return [...map.entries()].sort(([a], [b]) => compare(a, b));
}
