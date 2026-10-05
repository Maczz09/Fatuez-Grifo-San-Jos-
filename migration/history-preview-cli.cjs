// Explicit local dry-run only. Reads two bounded JSON metadata files at most;
// never opens artifacts/certificates, DB/Redis, environment secrets or network.
'use strict';
const fs = require('node:fs'), path = require('node:path');
function fail() { throw new Error('DRY_RUN_ARGUMENTS_OR_FILE_INVALID'); }
function readJson(name) {
  const target = path.resolve(name);
  if (path.extname(target).toLowerCase() !== '.json' || /(?:secret|credential|password|certificate|certificado)/i.test(path.basename(target))) fail();
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 16 * 1024 * 1024 || fs.realpathSync(target) !== target) fail();
  const fd = fs.openSync(target, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const before = fs.fstatSync(fd);
    if (before.ino !== stat.ino || before.dev !== stat.dev || before.size !== stat.size) fail();
    const bounded = Buffer.alloc(before.size + 1); let length = 0, count;
    while (length < bounded.length && (count = fs.readSync(fd, bounded, length, bounded.length - length, null)) > 0) length += count;
    const after = fs.fstatSync(fd);
    if (length !== before.size || after.mtimeMs !== before.mtimeMs || after.size !== before.size) fail();
    const bytes = bounded.subarray(0, length), value = bytes.toString('utf8'); if (!Buffer.from(value).equals(bytes)) fail();
    return JSON.parse(value);
  } finally { fs.closeSync(fd); }
}
function run(args) {
  const flags = new Set(), values = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!['--dry-run', '--development-only', '--input', '--checkpoint', '--full-report'].includes(flag) || flags.has(flag)) fail();
    flags.add(flag);
    if (flag === '--input' || flag === '--checkpoint') { const value = args[++i]; if (!value || value.startsWith('--')) fail(); values[flag] = value; }
  }
  if (!flags.has('--dry-run') || !flags.has('--development-only') || !values['--input']) fail();
  // Fixed compiled local module, not a script/module path supplied by the input.
  const { previewHistory } = require('./dist/history-preview');
  const report = previewHistory(readJson(values['--input']), values['--checkpoint'] ? readJson(values['--checkpoint']) : undefined);
  if (report.dryRun !== true || report.fiscalWrites !== 0 || report.transmission !== false || report.environment !== 'BETA') fail();
  const result = flags.has('--full-report') ? report : {
    schemaVersion: report.schemaVersion, status: report.status, rowCount: report.rowCount,
    dryRun: true, fiscalWrites: 0, transmission: false, environment: 'BETA', productionBlocked: true,
    blockingCount: report.diagnostics.blockingCount, reviewCount: report.diagnostics.reviewCount,
    duplicates: report.duplicates, artifacts: report.artifacts,
    inputSha256: report.plan.inputSha256, planSha256: report.plan.planSha256,
    validationBatches: report.plan.batches.length, resume: report.resume,
    notice: 'Sólo metadatos declarados. No importa históricos, verifica archivos/CDR ni modifica series. Checkpoint sólo de validación.' };
  console.log(JSON.stringify(result, null, 2));
  if (report.status === 'BLOCKED') process.exitCode = 2;
  else if (report.status === 'REVIEW_REQUIRED') process.exitCode = 3;
}
try { run(process.argv.slice(2)); }
catch (error) {
  process.exitCode = 1;
  console.error(JSON.stringify({ status: 'BLOCKED', reason: typeof error?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(error.code) ? error.code : 'DRY_RUN_ARGUMENTS_OR_FILE_INVALID',
    dryRun: true, fiscalWrites: 0, transmission: false, productionBlocked: true }));
}
