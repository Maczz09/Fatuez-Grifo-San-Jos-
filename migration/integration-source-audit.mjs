// Phase 1: source-only evidence. Never import application modules or access runtime data.
import { readFile, stat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const INVENTORY_VERSION = 'factuez.integration-source-inventory.v1';
export const INVENTORY_PATH = 'docs/integration/phase1-inventory.v1.json';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_SOURCE_BYTES = 1024 * 1024;
const TYPES = ['01', '03', '07', '08', '09', '31'];
const READ_ONLY_SCOPE = {
  runtimeDataRead: false, secretsRead: false, officialNetworkUsed: false,
  deploymentsChanged: false, phase2EndpointsImplemented: false, remoteAccessEnabled: false,
};
function assert(condition, message) { if (!condition) throw new Error(message); }
function sourcePath(path) {
  return typeof path === 'string' && !path.includes('..') && !path.includes('\\') &&
    /^(?:services\/[a-z-]+\/(?:src\/|prisma\/)|packages\/[a-z-]+\/src\/|infra\/kong\/)[a-zA-Z0-9_./-]+\.(?:ts|prisma|ya?ml)$/.test(path) &&
    !/(?:^|\/)(?:generated|node_modules|dist|secrets|credentials)(?:\/|$)/i.test(path);
}
export function validateInventory(value) {
  assert(value?.schemaVersion === INVENTORY_VERSION, 'INVENTORY_VERSION_INVALID');
  assert(value.scope?.purpose === 'PHASE_1_SOURCE_AUDIT' &&
    Object.entries(READ_ONLY_SCOPE).every(([key, expected]) => value.scope[key] === expected), 'SOURCE_ONLY_SCOPE_REQUIRED');
  assert(Array.isArray(value.sources) && value.sources.length > 0 && value.sources.length <= 100, 'SOURCES_INVALID');
  const ids = new Set(), paths = new Set();
  for (const source of value.sources) {
    assert(typeof source.id === 'string' && /^[a-z0-9-]{1,80}$/.test(source.id) && !ids.has(source.id), 'SOURCE_ID_INVALID');
    assert(sourcePath(source.path) && !paths.has(source.path), 'SOURCE_PATH_INVALID');
    assert(Array.isArray(source.anchors) && source.anchors.length > 0 && source.anchors.length <= 30 &&
      source.anchors.every(anchor => typeof anchor === 'string' && anchor.length > 0 && anchor.length <= 300), 'ANCHORS_INVALID');
    ids.add(source.id); paths.add(source.path);
  }
  assert(Array.isArray(value.documents) && value.documents.length === TYPES.length &&
    TYPES.every(type => value.documents.filter(doc => doc.type === type).length === 1), 'SIX_DOCUMENT_TYPES_REQUIRED');
  for (const doc of value.documents) {
    assert(Array.isArray(doc.evidence) && doc.evidence.length > 0 && doc.evidence.every(id => ids.has(id)), 'DOCUMENT_EVIDENCE_INVALID');
    assert(typeof doc.gap === 'string' && doc.gap.length > 0, 'DOCUMENT_LIMIT_REQUIRED');
  }
  assert(Array.isArray(value.gaps) && value.gaps.length > 0 && value.gaps.every(gap =>
    Number.isInteger(gap.phase) && gap.phase >= 2 && gap.phase <= 8), 'FOLLOW_UP_GAPS_REQUIRED');
  return value;
}

/** Hash and references are evidence of source content, NOT fiscal authenticity. */
export function inspectSource(source, bytes) {
  assert(bytes.byteLength <= MAX_SOURCE_BYTES, 'SOURCE_SIZE_LIMIT');
  const content = Buffer.from(bytes).toString('utf8');
  const anchors = source.anchors.map(anchor => {
    const index = content.indexOf(anchor);
    assert(index >= 0, `SOURCE_ANCHOR_MISSING:${source.id}`);
    return { anchor, line: content.slice(0, index).split('\n').length };
  });
  return { id: source.id, path: source.path,
    sha256: createHash('sha256').update(bytes).digest('hex'), anchors };
}

async function boundedRead(relativePath) {
  const target = resolve(root, relativePath), resolvedRoot = await realpath(root);
  const resolvedTarget = await realpath(target), child = relative(resolvedRoot, resolvedTarget);
  assert(child && child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child), 'SOURCE_OUTSIDE_REPOSITORY');
  const info = await stat(resolvedTarget);
  assert(info.isFile() && info.size <= MAX_SOURCE_BYTES, 'SOURCE_SIZE_LIMIT');
  const bytes = await readFile(resolvedTarget);
  assert(bytes.length <= MAX_SOURCE_BYTES, 'SOURCE_SIZE_LIMIT');
  return bytes;
}

export async function auditInventory() {
  const inventory = validateInventory(JSON.parse((await boundedRead(INVENTORY_PATH)).toString('utf8')));
  const evidence = [];
  for (const source of inventory.sources) evidence.push(inspectSource(source, await boundedRead(source.path)));
  return { schemaVersion: 'factuez.integration-source-audit.v1', reviewedInventoryDate: inventory.reviewDate,
    status: 'SOURCE_EVIDENCE_VERIFIED', runtimeAvailability: 'NOT_INSPECTED',
    fiscalAcceptance: 'NOT_VERIFIED', remoteApi: 'NOT_IMPLEMENTED', sourceCount: evidence.length,
    anchorCount: evidence.reduce((count, file) => count + file.anchors.length, 0),
    documentTypes: inventory.documents.map(doc => ({ type: doc.type, capability: doc.capability })),
    nextPhase: 2, evidence };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    assert(process.argv.length === 3 && process.argv[2] === '--source-only', 'REQUIRES_SOURCE_ONLY_NO_OTHER_ARGUMENTS');
    console.log(JSON.stringify(await auditInventory(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'SOURCE_AUDIT_FAILED');
    process.exitCode = 1;
  }
}
