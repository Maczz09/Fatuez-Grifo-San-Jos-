import { createHash } from 'node:crypto';
import fs from 'node:fs';
import * as path from 'node:path';
import { prepareHistoryExport, type HistoryArtifactKind } from './history-preview';

// A dedicated, stable OFFLINE bundle, never the live legacy storage directory.
// Byte integrity only: no XML parsing, signature/PKI validation or ZIP extraction.
export const HISTORY_BUNDLE_LIMITS = Object.freeze({
  maxFiles: 1_000, maxFileBytes: 16 * 1024 * 1024,
  maxReadBytes: 128 * 1024 * 1024, chunkBytes: 64 * 1024, maxExamples: 100,
});
export class HistoryArtifactError extends Error {
  constructor(readonly code: string) { super(`Bundle histórico bloqueado: ${code}`); delete this.stack; }
}
function check(condition: unknown, code: string): asserts condition {
  if (!condition) throw new HistoryArtifactError(code);
}
type Task = Readonly<{ rowOrdinal: number; kind: HistoryArtifactKind; relativePath: string;
  sha256: string; sizeBytes: number }>;
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

/** Resolve paths solely from detached validated metadata, before ANY file I/O. */
export function buildHistoryArtifactPlan(input: unknown) {
  const { source, report } = prepareHistoryExport(input);
  check(report.status !== 'BLOCKED', 'BLOCKED_METADATA');
  const tasks: Task[] = [];
  let declaredBytes = 0;
  source.rows.forEach((row, rowOrdinal) => row.artifacts.forEach(artifact => {
    const extension = artifact.kind.endsWith('_XML') ? '.xml' :
      artifact.kind.startsWith('PDF_') ? '.pdf' : '.zip';
    check(path.extname(artifact.originalName).toLowerCase() === extension &&
      !/(?:secret|credential|password|certificate|certificado)/i.test(artifact.originalName), 'UNSAFE_ARTIFACT_NAME');
    check(artifact.sizeBytes <= HISTORY_BUNDLE_LIMITS.maxFileBytes, 'ARTIFACT_READ_LIMIT');
    declaredBytes += artifact.sizeBytes;
    tasks.push({ rowOrdinal, kind: artifact.kind,
      relativePath: [row.issuerRuc, row.type, row.series, row.number, artifact.kind, artifact.originalName].join('/'),
      sha256: artifact.sha256, sizeBytes: artifact.sizeBytes });
  }));
  check(tasks.length <= HISTORY_BUNDLE_LIMITS.maxFiles && declaredBytes <= HISTORY_BUNDLE_LIMITS.maxReadBytes, 'BUNDLE_READ_LIMIT');
  // Stable canonical rows/artifact order; only explicit plain data reaches JSON.stringify.
  const binding = { schemaVersion: 'factuez.history-artifact-plan.v1',
    inputSha256: report.plan.inputSha256, purpose: 'READ_ONLY_BYTE_INTEGRITY', tasks };
  const planSha256 = createHash('sha256').update(JSON.stringify(binding)).digest('hex');
  return freeze({ ...binding, planSha256, declaredBytes, metadataStatus: report.status });
}

type FileSnapshot = fs.BigIntStats;
function sameFile(a: FileSnapshot, b: FileSnapshot) {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size &&
    a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs && a.nlink === b.nlink;
}
function directory(target: string) {
  const stat = fs.lstatSync(target, { bigint: true });
  check(stat.isDirectory() && !stat.isSymbolicLink() && fs.realpathSync(target) === target, 'UNSAFE_BUNDLE_PATH');
  return stat;
}
function regular(target: string) {
  const stat = fs.lstatSync(target, { bigint: true });
  check(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1n &&
    fs.realpathSync(target) === target, 'UNSAFE_BUNDLE_PATH');
  return stat;
}
function verifyFile(root: string, rootStat: FileSnapshot, task: Task) {
  const components = task.relativePath.split('/');
  const target = path.resolve(root, ...components);
  const relative = path.relative(root, target);
  check(relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative), 'UNSAFE_BUNDLE_PATH');
  const parents: Array<{ target: string; stat: FileSnapshot }> = [{ target: root, stat: rootStat }];
  for (let i = 1; i < components.length; i++) {
    const parent = path.resolve(root, ...components.slice(0, i));
    parents.push({ target: parent, stat: directory(parent) });
  }
  const stat = regular(target);
  check(stat.size === BigInt(task.sizeBytes), 'ARTIFACT_SIZE_MISMATCH');
  const fd = fs.openSync(target, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const before = fs.fstatSync(fd, { bigint: true });
    check(before.isFile() && sameFile(stat, before) && before.nlink === 1n, 'ARTIFACT_CHANGED');
    // No privileged adversarial writers are supported. Detect ordinary races
    // using path/FD identity, size, timestamps and parent identity before/after.
    const checkParents = () => parents.forEach(parent => {
      const current = directory(parent.target);
      check(current.dev === parent.stat.dev && current.ino === parent.stat.ino, 'ARTIFACT_CHANGED');
    });
    checkParents();
    const hash = createHash('sha256');
    const chunk = Buffer.alloc(HISTORY_BUNDLE_LIMITS.chunkBytes);
    let total = 0;
    while (total < task.sizeBytes) {
      const length = fs.readSync(fd, chunk, 0, Math.min(chunk.length, task.sizeBytes - total), null);
      if (length === 0) break;
      total += length; hash.update(chunk.subarray(0, length));
    }
    const excess = fs.readSync(fd, chunk, 0, 1, null);
    check(total === task.sizeBytes && excess === 0 &&
      sameFile(before, fs.fstatSync(fd, { bigint: true })) && sameFile(before, regular(target)), 'ARTIFACT_CHANGED');
    checkParents();
    check(hash.digest('hex') === task.sha256, 'ARTIFACT_HASH_MISMATCH');
    return total;
  } finally { fs.closeSync(fd); }
}
function safeCode(error: unknown): string {
  if (error instanceof HistoryArtifactError) return error.code;
  // Native filesystem errors only; never return their message, stack or path.
  const code = (error as NodeJS.ErrnoException)?.code;
  return code === 'ENOENT' ? 'ARTIFACT_MISSING' : 'ARTIFACT_UNAVAILABLE';
}

/** Readonly integrity report. Does NOT authenticate a CDR or approve import. */
export function verifyHistoryArtifactBundle(input: unknown, bundleRoot: string) {
  const plan = buildHistoryArtifactPlan(input); // Validate all metadata before I/O.
  check(typeof bundleRoot === 'string' && bundleRoot.length > 0 && bundleRoot === bundleRoot.trim() &&
    !bundleRoot.includes('\0') && !bundleRoot.includes('://') && !/^(?:\\\\|\/\/)/.test(bundleRoot), 'INVALID_BUNDLE_ROOT');
  const root = path.resolve(bundleRoot);
  let rootStat: FileSnapshot;
  try { rootStat = directory(root); } catch { throw new HistoryArtifactError('UNSAFE_BUNDLE_ROOT'); }
  const examples: Array<{ rowOrdinal: number; kind: HistoryArtifactKind; code: string }> = [];
  const byCode: Record<string, number> = {};
  let verifiedFiles = 0, verifiedBytes = 0, failureCount = 0;
  for (const task of plan.tasks) {
    try { verifiedBytes += verifyFile(root, rootStat, task); verifiedFiles++; }
    catch (error) {
      const code = safeCode(error); failureCount++; byCode[code] = (byCode[code] ?? 0) + 1;
      if (examples.length < HISTORY_BUNDLE_LIMITS.maxExamples) examples.push({ rowOrdinal: task.rowOrdinal, kind: task.kind, code });
    }
  }
  return freeze({ schemaVersion: 'factuez.history-bundle-report.v1' as const,
    status: failureCount ? 'BLOCKED' as const : plan.tasks.length ? 'BYTES_MATCH_METADATA' as const : 'NO_ARTIFACTS_TO_VERIFY' as const,
    environment: 'BETA' as const, readonly: true as const, productionBlocked: true as const,
    databaseWrites: 0 as const, fiscalWrites: 0 as const, artifactCopies: 0 as const,
    transmission: false as const, certificateAccess: false as const, cdrAuthenticityVerified: false as const, importAllowed: false as const,
    inputSha256: plan.inputSha256, planSha256: plan.planSha256, metadataStatus: plan.metadataStatus,
    fileCount: plan.tasks.length, declaredBytes: plan.declaredBytes, verifiedFiles, verifiedBytes,
    failureCount, byCode, examples, truncated: failureCount > examples.length,
    notice: 'Integridad de bytes contra el export. No valida XML, firma, confianza CDR, propiedad de RUC ni autoriza importación.' });
}
