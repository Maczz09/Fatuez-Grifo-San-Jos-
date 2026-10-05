'use strict';
// LOCAL rehearsal only: bounded JSON + optional dedicated offline artifact bundle.
// No DB, Redis, environment secrets, SUNAT, email, migration or filesystem writes.
const fs = require('node:fs'), path = require('node:path');
function fail() { throw new Error('REHEARSAL_ARGUMENTS_OR_FILE_INVALID'); }
function readJson(name) {
  const target = path.resolve(name);
  if (path.extname(target).toLowerCase() !== '.json' || /(?:secret|credential|password|certificate|certificado)/i.test(path.basename(target)) ||
    /^(?:\\\\|\/\/)/.test(target)) fail();
  const stat = fs.lstatSync(target, { bigint: true });
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1n || stat.size < 1n || stat.size > 16n * 1024n * 1024n || fs.realpathSync(target) !== target) fail();
  const fd = fs.openSync(target, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const before = fs.fstatSync(fd, { bigint: true });
    const same = (a, b) => a.ino === b.ino && a.dev === b.dev && a.size === b.size && a.nlink === b.nlink &&
      a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
    if (!same(before, stat)) fail();
    const bounded = Buffer.alloc(Number(before.size) + 1); let length = 0, count;
    while (length < bounded.length && (count = fs.readSync(fd, bounded, length, bounded.length - length, null)) > 0) length += count;
    if (BigInt(length) !== before.size || !same(before, fs.fstatSync(fd, { bigint: true })) || !same(before, fs.lstatSync(target, { bigint: true })) ||
      fs.realpathSync(target) !== target) fail();
    const bytes = bounded.subarray(0, length), value = bytes.toString('utf8');
    if (!Buffer.from(value).equals(bytes)) fail();
    return JSON.parse(value);
  } finally { fs.closeSync(fd); }
}
function run(args) {
  const flags = new Set(), values = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!['--dry-run', '--development-only', '--input', '--bundle-root', '--rehearsal-state', '--batches', '--full-report'].includes(flag) || flags.has(flag)) fail();
    flags.add(flag);
    if (['--input', '--bundle-root', '--rehearsal-state', '--batches'].includes(flag)) {
      const value = args[++i]; if (!value || value.startsWith('--')) fail(); values[flag] = value;
    }
  }
  if (!flags.has('--dry-run') || !flags.has('--development-only') || !values['--input'] ||
    (values['--batches'] && !/^(?:[1-9]|1[0-9]|20)$/.test(values['--batches']))) fail();
  const { rehearseHistoryArchive } = require('./dist/history-rehearsal');
  const { verifyHistoryArtifactBundle } = require('./dist/history-artifacts');
  const input = readJson(values['--input']);
  const rehearsal = rehearseHistoryArchive(input, values['--rehearsal-state'] ? readJson(values['--rehearsal-state']) : undefined,
    values['--batches'] ? Number(values['--batches']) : 1);
  const bundle = values['--bundle-root'] ? verifyHistoryArtifactBundle(input, values['--bundle-root']) : null;
  const summary = { ...rehearsal }; delete summary.state;
  const result = { schemaVersion: 'factuez.history-stage3-cli.v1',
    status: bundle?.status === 'BLOCKED' ? 'BLOCKED' : 'REVIEW_REQUIRED',
    rehearsal: flags.has('--full-report') ? rehearsal : summary, bundle,
    notice: 'Ensayo local en memoria. Sin importación, persistencia, copias, cambios de correlativo o aceptación fiscal. Confianza CDR pendiente.' };
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === 'BLOCKED' ? 2 : 3;
}
try { run(process.argv.slice(2)); }
catch (error) {
  process.exitCode = error?.code === 'BLOCKED_METADATA' ? 2 : 1;
  console.error(JSON.stringify({ status: 'BLOCKED', reason: typeof error?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(error.code) ? error.code : 'REHEARSAL_ARGUMENTS_OR_FILE_INVALID',
    simulationOnly: true, persisted: false, fiscalWrites: 0, transmission: false, productionBlocked: true }));
}
