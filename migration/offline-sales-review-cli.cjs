'use strict';
// Explicit local inventory only; the manifest never supplies authorization.
const { realpathSync, lstatSync, openSync, fstatSync, readSync, closeSync } = require('node:fs');
const { isAbsolute } = require('node:path');
const { createHash } = require('node:crypto');
const { TextDecoder } = require('node:util');
const MAX_XML_BYTES = 2 * 1024 * 1024;
const POLICY = Object.freeze({
  environment: 'BETA', purpose: 'DIAGNOSTIC_ONLY', transmission: false,
  officialTrust: false, officialAcceptance: false, canEmit: false,
  canImportHistory: false, canChangeCounters: false, phase2Closed: false,
  phase3Closed: false, accountingApproved: false, cutoverAuthorized: false,
});
const fail = code => { throw new Error(code); };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const exactFields = (value, fields) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).sort().join(',') === fields;

function absoluteLocalPath(path) {
  if (typeof path !== 'string' || !isAbsolute(path) || path.includes('\0') ||
      /^[\\/]{2}/.test(path) || (process.platform === 'win32' && !/^[A-Za-z]:[\\/]/.test(path))) fail('FILE_PATH');
}
function sameStat(a, b) {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size &&
    a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
}
function stableRead(path, max) {
  absoluteLocalPath(path);
  const original = lstatSync(path);
  if (original.isSymbolicLink()) fail('FILE_PATH');
  if (!original.isFile() || original.size <= 0 || original.size > max) fail('FILE_SIZE');
  const resolved = realpathSync(path);
  absoluteLocalPath(resolved);
  const fd = openSync(resolved, 'r');
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || before.size <= 0 || before.size > max) fail('FILE_SIZE');
    if (!sameStat(original, before)) fail('FILE_CHANGED');
    const bytes = Buffer.alloc(before.size);
    let n = 0;
    while (n < bytes.length) {
      const got = readSync(fd, bytes, n, bytes.length - n, n);
      if (!got) fail('FILE_CHANGED');
      n += got;
    }
    // A growing file cannot silently become a valid bounded prefix.
    if (readSync(fd, Buffer.alloc(1), 0, 1, n)) fail('FILE_CHANGED');
    const after = fstatSync(fd), current = lstatSync(path);
    if (!sameStat(before, after) || current.isSymbolicLink() ||
        !sameStat(after, current) || realpathSync(path) !== resolved) fail('FILE_CHANGED');
    return { bytes, path: resolved, dev: after.dev, ino: after.ino };
  } finally { closeSync(fd); }
}
function signatureMetadata(s) {
  const result = { status: s.status, signatureValueVerified: s.signatureValueVerified,
    referenceDigestVerified: s.referenceDigestVerified, wholeDocumentIntegrity: s.wholeDocumentIntegrity,
    officialTrust: false, revocationChecked: false, certificateIdentityAuthorized: false,
    weakDigestObserved: s.weakDigestObserved };
  if (s.certificate) result.certificate = {
    sha256: s.certificate.sha256, validFrom: s.certificate.validFrom, validTo: s.certificate.validTo,
    keyBits: s.certificate.keyBits, inDeclaredIssueDateWindow: s.certificate.inDeclaredIssueDateWindow,
  };
  // Unsupported algorithm attributes can contain arbitrary private XML text.
  if (s.algorithms && s.status !== 'PROFILE_UNSUPPORTED') result.algorithms = { signature: s.algorithms.signature, digest: s.algorithms.digest,
    canonicalization: s.algorithms.canonicalization, transforms: s.algorithms.transforms };
  return result;
}
function run(args) {
  if (args.length !== 3 || args[0] !== '--authorized-offline-review' || args[1] !== '--manifest')
    fail('EXPLICIT_SCOPE_REQUIRED');
  const manifestBytes = stableRead(args[2], 16384).bytes;
  const m = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes));
  if (!exactFields(m, 'documentFiles,schemaVersion,scope') ||
      m.schemaVersion !== 'factuez.offline-sales-files.v1') fail('MANIFEST_FIELDS');
  const { validateOfflineReviewScope } = require('../packages/evidence-core/dist/offline-review.js');
  const scope = validateOfflineReviewScope(m.scope);
  if (!Array.isArray(m.documentFiles) || m.documentFiles.length < 1 || m.documentFiles.length > 2)
    fail('FILE_INVENTORY');
  const roles = new Map();
  // Validate the complete declared inventory before opening any XML.
  for (const entry of m.documentFiles) {
    if (!exactFields(entry, 'path,role,sha256') || !['DOCUMENT_XML', 'CDR_XML'].includes(entry.role) ||
        roles.has(entry.role) || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256))
      fail('FILE_INVENTORY');
    absoluteLocalPath(entry.path);
    roles.set(entry.role, entry);
  }
  if (!roles.has('DOCUMENT_XML')) fail('FILE_INVENTORY');
  const files = new Map();
  for (const [role, entry] of roles) {
    const file = stableRead(entry.path, MAX_XML_BYTES);
    for (const other of files.values()) {
      if (file.path === other.path || (file.dev === other.dev && file.ino === other.ino)) fail('DUPLICATE_FILE');
    }
    if (sha256(file.bytes) !== entry.sha256) fail('FILE_SHA256_MISMATCH');
    // ignoreBOM:true retains U+FEFF so the core hashes the original UTF-8 bytes.
    files.set(role, { ...file, xml: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(file.bytes) });
  }
  const { reviewOfflineSalesPair } = require('../packages/evidence-core/dist/offline-sales-review.js');
  const r = reviewOfflineSalesPair({ scope, documentXml: files.get('DOCUMENT_XML').xml,
    cdrXml: files.get('CDR_XML')?.xml ?? null });
  const d = r.document, p = d.projection;
  // Only allowlisted metadata: never business text, customer IDs, XML paths,
  // certificate subjects/bytes, signature values, or source file paths.
  const report = { schemaVersion: r.schemaVersion, ...POLICY, sourceManifestSha256: sha256(manifestBytes),
    document: { rawSha256: d.rawSha256, type: p.documentTypeCode, fullNumber: p.fullNumber,
      issuerRuc: p.issuer.identityNumber, issueDate: p.issueDate, currencyCode: p.currencyCode,
      lineCount: p.items.length, signature: signatureMetadata(d.signature),
      reconciliation: { lineSum: d.reconciliation.lineSum, headerTaxSum: d.reconciliation.headerTaxSum,
        lineTaxSum: d.reconciliation.lineTaxSum, checksPassed: d.reconciliation.checksPassed, fiscalRulesVerified: false },
      coverage: { unmappedElementCount: d.coverage.unmappedElementCount, truncated: d.coverage.truncated,
        attributesFullyMapped: false, mappingCompleteness: d.coverage.mappingCompleteness } },
    cdr: r.cdr === null ? null : { rawSha256: r.cdr.rawSha256, signature: signatureMetadata(r.cdr.signature),
      responseCode: r.cdr.projection.responseCode, reportedResult: r.cdr.projection.reportedResult,
      warningCodes: r.cdr.warningCodes },
    bindings: r.bindings, issues: r.issues, cryptographicPairBound: r.cryptographicPairBound,
    typeBindingVerified: r.typeBindingVerified, networkRequests: 0, fiscalWrites: 0, outboxWrites: 0 };
  console.log(JSON.stringify(report, null, 2));
  const expectedLimits = new Set(['PKI_AND_SIGNER_AUTHORIZATION_NOT_VERIFIED', 'PARTIAL_SNAPSHOT_NOT_IMPORTABLE']);
  return r.cryptographicPairBound && r.typeBindingVerified && !r.issues.some(code => !expectedLimits.has(code)) ? 0 : 2;
}
try { process.exitCode = run(process.argv.slice(2)); }
catch (error) {
  const candidate = typeof error?.code === 'string' ? error.code : error?.message;
  const code = typeof candidate === 'string' && /^[A-Z0-9_]+$/.test(candidate) ? candidate : 'OFFLINE_REVIEW_FAILED';
  console.error(JSON.stringify({ status: 'BLOCKED', code, ...POLICY, networkRequests: 0, fiscalWrites: 0, outboxWrites: 0 }));
  process.exitCode = 1;
}
