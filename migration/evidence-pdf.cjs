'use strict';

// Local BETA/SYNTHETIC evidence only. No PDF authoring, filesystem PDF I/O or CLI.
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const { isProxy } = require('node:util/types');
const { homedir } = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const childProcess = require('node:child_process');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');

const PDF_LIMITS = Object.freeze({ pdfBytes: 4 * 1024 * 1024, pages: 10,
  pngBytes: 16 * 1024 * 1024, pixels: 8_000_000, totalPixels: 32_000_000,
  side: 8192, qrPerPage: 4, qrBytes: 2048, qrDecoderCalls: 128,
  qrScanPixels: 64_000_000, qrWindows: 512, textLines: 2000, textLineLength: 1000,
  textChars: 200_000, timeoutMs: 15_000, dpi: 144 });
const policy = Object.freeze({ environment: 'BETA', datasetClass: 'SYNTHETIC',
  noOfficialAuthority: true, fiscalAuthority: false, officialAcceptance: false,
  signatureVerified: false, cdrAuthenticityVerified: false, physicalPrintVerified: false,
  transmission: false, productionBlocked: true });
const runtimeRoot = path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies');
const PDF_RUNTIME = Object.freeze(process.platform === 'win32' ? {
  pythonPath: path.join(runtimeRoot, 'python', 'python.exe'),
  pdftoppmPath: path.join(runtimeRoot, 'native', 'poppler', 'Library', 'bin', 'pdftoppm.exe'),
} : { pythonPath: '/usr/bin/python3', pdftoppmPath: '/usr/bin/pdftoppm' });
const helperPath = path.join(__dirname, 'evidence-pdf-inspect.py');
const historyRequire = createRequire(path.join(__dirname, '../packages/history-core/package.json'));
const sha = value => createHash('sha256').update(value).digest('hex');
function fail(code) { const error = new Error(`Synthetic PDF evidence: ${code}`); error.code = code; throw error; }
function check(ok, code) { if (!ok) fail(code); }

function optionsChecked(input) {
  check(input && typeof input === 'object' && !isProxy(input) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(input)), 'PDF_PROFILE_BLOCKED');
  const allowed = ['environment', 'datasetClass', 'format', 'pythonPath', 'pdftoppmPath'];
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(input)) {
    check(typeof key === 'string' && allowed.includes(key), 'PDF_OPTIONS_BLOCKED');
    const d = Object.getOwnPropertyDescriptor(input, key);
    check(d && d.enumerable && 'value' in d, 'PDF_OPTIONS_BLOCKED');
    result[key] = d.value;
  }
  check(result.environment === 'BETA' && result.datasetClass === 'SYNTHETIC' &&
    ['ticket', 'a4'].includes(result.format), 'PDF_PROFILE_BLOCKED');
  // Paths are trusted runtime configuration, NEVER document input or arbitrary CLI commands.
  // The candidate cannot select a different executable, script, working directory or shell.
  for (const key of ['pythonPath', 'pdftoppmPath']) {
    const value = result[key];
    check(typeof value === 'string' && value.length <= 1024 && path.isAbsolute(value) &&
      !/[\x00-\x1f]/.test(value), 'PDF_RUNTIME_BLOCKED');
    const canonical = v => process.platform === 'win32' ? path.normalize(v).toLowerCase() : path.normalize(v);
    check(canonical(value) === canonical(PDF_RUNTIME[key]), 'PDF_RUNTIME_BLOCKED');
    try { check(fs.statSync(value).isFile(), 'PDF_RUNTIME_UNAVAILABLE'); }
    catch (error) { if (error.code === 'PDF_RUNTIME_UNAVAILABLE') throw error; fail('PDF_RUNTIME_UNAVAILABLE'); }
  }
  return result;
}
function inputChecked(pdf) {
  check(Buffer.isBuffer(pdf) && pdf.length > 0 && pdf.length <= PDF_LIMITS.pdfBytes, 'PDF_INPUT_LIMIT');
  check(/^%PDF-1\.[0-7](?:\r|\n)/.test(pdf.subarray(0, 10).toString('ascii')), 'PDF_INVALID');
  return Buffer.from(pdf); // Detach before passing the same bytes to both tools.
}
function run(executable, args, input, maxBuffer, kind) {
  const result = childProcess.spawnSync(executable, args, { input, shell: false, windowsHide: true,
    timeout: PDF_LIMITS.timeoutMs, maxBuffer, cwd: __dirname, encoding: null });
  check(!result.error && result.status === 0 && !result.signal && Buffer.isBuffer(result.stdout), `PDF_${kind}_FAILED`);
  return result.stdout;
}

/** Decode up to four QR occurrences from actual PNG pixels; duplicates remain occurrences.
 * qrScanLimitReached means completeness is unknown, even if all four payloads are identical.
 * Neither absence nor successful decoding asserts universal QR readability or physical printing.
 */
function decodeQrPng(png) {
  check(Buffer.isBuffer(png) && png.length >= 33 && png.length <= PDF_LIMITS.pngBytes, 'PNG_INPUT_LIMIT');
  check(png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) &&
    png.readUInt32BE(8) === 13 && png.toString('ascii', 12, 16) === 'IHDR', 'PNG_INVALID');
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  check(width > 0 && height > 0 && width <= PDF_LIMITS.side && height <= PDF_LIMITS.side &&
    width * height <= PDF_LIMITS.pixels, 'PNG_PIXEL_LIMIT');
  // pngjs uses unbounded native inflate for interlaced input. Accept only its bounded path.
  check(png[24] === 8 && [0,2,3,4,6].includes(png[25]) && png[26] === 0 &&
    png[27] === 0 && png[28] === 0, 'PNG_PROFILE_BLOCKED');
  let offset = 8, chunks = 0, ended = false;
  while (offset < png.length) {
    check(++chunks <= 20000 && offset + 12 <= png.length, 'PNG_INVALID');
    const length = png.readUInt32BE(offset), end = offset + length + 12;
    check(end <= png.length, 'PNG_INVALID');
    const type = png.toString('ascii', offset + 4, offset + 8);
    check(type !== 'IHDR' || offset === 8, 'PNG_INVALID');
    check(!['acTL','fcTL','fdAT'].includes(type), 'PNG_PROFILE_BLOCKED');
    offset = end;
    if (type === 'IEND') { check(length === 0 && offset === png.length, 'PNG_INVALID'); ended = true; break; }
  }
  check(ended, 'PNG_INVALID');
  let pixels;
  try { pixels = PNG.sync.read(png, { checkCRC: true }); } catch { fail('PNG_INVALID'); }
  check(pixels.width === width && pixels.height === height && pixels.data.length === width * height * 4, 'PNG_INVALID');
  const rgba = new Uint8ClampedArray(pixels.data);
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3] / 255;
    for (let channel = 0; channel < 3; channel++) rgba[i + channel] = Math.round(rgba[i + channel] * alpha + 255 * (1 - alpha));
    rgba[i + 3] = 255;
  }
  const dimensions = Buffer.alloc(8); dimensions.writeUInt32BE(width); dimensions.writeUInt32BE(height, 4);
  // Hash decoded, white-composited RGBA and dimensions, not PNG compression or metadata.
  const rasterSha256 = createHash('sha256').update(dimensions).update(rgba).digest('hex');
  const qrPayloads = [];
  let decoderCalls = 0, scannedPixels = 0, searchLimited = false;
  const decode = (pixels, w, h) => {
    if (decoderCalls >= PDF_LIMITS.qrDecoderCalls || scannedPixels + w * h > PDF_LIMITS.qrScanPixels) {
      searchLimited = true; return null;
    }
    decoderCalls++; scannedPixels += w * h;
    return jsQR(pixels, w, h, { inversionAttempts: 'attemptBoth' });
  };
  // A global jsQR locator can confuse finder patterns belonging to different codes
  // and return null. Overlapping bounded windows isolate candidates in that case.
  const tile = Math.min(512, width, height), step = Math.max(1, Math.floor(tile / 4));
  const offsets = (size) => {
    const values = [];
    for (let p = 0; p < size - tile && values.length <= PDF_LIMITS.qrWindows; p += step) values.push(p);
    if (values.at(-1) !== size - tile) values.push(size - tile);
    return values;
  };
  const windows = [];
  for (const y of offsets(height)) for (const x of offsets(width)) {
    if (windows.length <= PDF_LIMITS.qrWindows) windows.push({ x, y });
  }
  const locate = () => {
    const whole = decode(rgba, width, height);
    if (whole || searchLimited || tile < 21 || tile * tile === width * height) return whole;
    for (let index = 0; index < windows.length; index++) {
      if (index >= PDF_LIMITS.qrWindows) { searchLimited = true; break; }
      const { x, y } = windows[index], crop = new Uint8ClampedArray(tile * tile * 4);
      let dark = 0;
      for (let row = 0; row < tile; row++) {
        const start = ((y + row) * width + x) * 4;
        const source = rgba.subarray(start, start + tile * 4);
        crop.set(source, row * tile * 4);
        for (let p = 0; p < source.length; p += 4) if (source[p] + source[p + 1] + source[p + 2] < 576) dark++;
      }
      if (dark < 32) continue;
      const found = decode(crop, tile, tile);
      if (searchLimited) break;
      if (found) {
        for (const key of ['topLeftCorner','topRightCorner','bottomLeftCorner','bottomRightCorner']) {
          found.location[key].x += x; found.location[key].y += y;
        }
        return found;
      }
    }
    return null;
  };
  for (let attempt = 0; attempt < PDF_LIMITS.qrPerPage; attempt++) {
    const qr = locate();
    if (!qr) break;
    check(typeof qr.data === 'string' && Buffer.byteLength(qr.data, 'utf8') <= PDF_LIMITS.qrBytes, 'QR_PAYLOAD_LIMIT');
    qrPayloads.push(qr.data);
    const corners = [qr.location.topLeftCorner, qr.location.topRightCorner,
      qr.location.bottomLeftCorner, qr.location.bottomRightCorner];
    check(corners.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)), 'QR_LOCATION_INVALID');
    const x0 = Math.max(0, Math.floor(Math.min(...corners.map(p => p.x))) - 2);
    const x1 = Math.min(width - 1, Math.ceil(Math.max(...corners.map(p => p.x))) + 2);
    const y0 = Math.max(0, Math.floor(Math.min(...corners.map(p => p.y))) - 2);
    const y1 = Math.min(height - 1, Math.ceil(Math.max(...corners.map(p => p.y))) + 2);
    check(x1 >= x0 && y1 >= y0, 'QR_LOCATION_INVALID');
    for (let y = y0; y <= y1; y++) rgba.fill(255, (y * width + x0) * 4, (y * width + x1 + 1) * 4);
  }
  return { width, height, rasterSha256, qrPayloads, qrSearchLimitReached: searchLimited,
    qrScanLimitReached: searchLimited || qrPayloads.length === PDF_LIMITS.qrPerPage };
}

function metadataChecked(data, format) {
  check(data && data.schemaVersion === 'factuez.synthetic-pdf-metadata.v1' && data.format === format &&
    Array.isArray(data.pageSizesMicrometers) && data.pageSizesMicrometers.length > 0 &&
    data.pageSizesMicrometers.length <= PDF_LIMITS.pages && Array.isArray(data.textLines), 'PDF_METADATA_INVALID');
  let totalPixels = 0;
  for (const s of data.pageSizesMicrometers) {
    check(s && Number.isSafeInteger(s.width) && Number.isSafeInteger(s.height) && s.width > 0 && s.height > 0, 'PDF_METADATA_INVALID');
    check(format === 'ticket' ? Math.abs(s.width - 80000) <= 30 :
      Math.abs(s.width - 210000) <= 30 && Math.abs(s.height - 297000) <= 30, 'PDF_FORMAT_MISMATCH');
    const width = Math.ceil(s.width * PDF_LIMITS.dpi / 25400), height = Math.ceil(s.height * PDF_LIMITS.dpi / 25400);
    check(width <= PDF_LIMITS.side && height <= PDF_LIMITS.side && width * height <= PDF_LIMITS.pixels, 'PDF_PAGE_LIMIT');
    totalPixels += width * height;
  }
  check(totalPixels <= PDF_LIMITS.totalPixels, 'PDF_PAGE_LIMIT');
  check(data.textLines.length <= PDF_LIMITS.textLines && data.textLines.every(s => typeof s === 'string' &&
    s.length <= PDF_LIMITS.textLineLength && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(s)) &&
    data.textLines.reduce((n,s) => n + s.length, 0) <= PDF_LIMITS.textChars, 'PDF_TEXT_LIMIT');
  return { pageSizesMicrometers: data.pageSizesMicrometers.map(s => ({ width: s.width, height: s.height })),
    textLines: data.textLines.map(s => s.normalize('NFC').replace(/\s+/gu, ' ').trim()).filter(Boolean) };
}

/** Synchronous, bounded, read-only inspection. The only document input is a Buffer. */
function inspectSyntheticPdf(pdf, options) {
  const config = optionsChecked(options), input = inputChecked(pdf);
  const raw = run(config.pythonPath, ['-I', '-B', helperPath, '--format', config.format], input, 2 * 1024 * 1024, 'INSPECT');
  let data;
  try { data = JSON.parse(raw.toString('utf8')); } catch { fail('PDF_METADATA_INVALID'); }
  if (data.error) { check(/^PDF_[A-Z0-9_]{1,64}$/.test(data.error), 'PDF_METADATA_INVALID'); fail(data.error); }
  const metadata = metadataChecked(data, config.format);
  const pages = metadata.pageSizesMicrometers.map((size, index) => {
    // No output prefix: Poppler writes the single selected page to stdout; '-' reads stdin.
    const png = run(config.pdftoppmPath, ['-f', String(index + 1), '-l', String(index + 1),
      '-singlefile', '-r', String(PDF_LIMITS.dpi), '-png', '-'], input, PDF_LIMITS.pngBytes, 'RASTER');
    const decoded = decodeQrPng(png);
    check(Math.abs(decoded.width - Math.ceil(size.width * PDF_LIMITS.dpi / 25400)) <= 1 &&
      Math.abs(decoded.height - Math.ceil(size.height * PDF_LIMITS.dpi / 25400)) <= 1, 'PDF_RASTER_SIZE_MISMATCH');
    return decoded;
  });
  const qrPayloads = pages.flatMap(p => p.qrPayloads);
  const counts = new Map(); for (const p of qrPayloads) counts.set(p, (counts.get(p) || 0) + 1);
  return { schemaVersion: 'factuez.synthetic-pdf-inspection.v1', ...policy, format: config.format,
    pdfSha256: sha(input), ...metadata, pages, qrPayloads,
    duplicateQrPayloads: [...counts].filter(([,n]) => n > 1).map(([payload,count]) => ({ payload, count })),
    qrStatus: qrPayloads.length === 0 ? 'MISSING' : qrPayloads.length === 1 ? 'SINGLE' : 'MULTIPLE',
    qrScanLimitReached: pages.some(p => p.qrScanLimitReached) };
}

/** Compare actual text, dimensions and raster pixels. PDF byte hashes are audit evidence only. */
function compareSyntheticPdf(leftBuffer, rightBuffer, options) {
  const left = inspectSyntheticPdf(leftBuffer, options), right = inspectSyntheticPdf(rightBuffer, options);
  const differences = [];
  const compare = (field, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) differences.push({
    path: field, category: 'CORRECTION_REQUIRED', left: a, right: b }); };
  compare('textLines', left.textLines, right.textLines);
  compare('pageSizesMicrometers', left.pageSizesMicrometers, right.pageSizesMicrometers);
  compare('pages.rasterSha256', left.pages.map(p => p.rasterSha256), right.pages.map(p => p.rasterSha256));
  compare('pages.qrPayloads', left.pages.map(p => p.qrPayloads), right.pages.map(p => p.qrPayloads));
  const qrEvidenceComplete = [left,right].every(p => p.qrStatus === 'SINGLE' && !p.qrScanLimitReached);
  return { schemaVersion: 'factuez.synthetic-pdf-comparison.v1', ...policy, left, right, differences,
    differenceCount: differences.length, comparativeMatch: differences.length === 0, qrEvidenceComplete,
    status: !qrEvidenceComplete ? 'INCOMPLETE' : differences.length ? 'DIFFERENCES_FOUND' : 'MATCH_WITH_UNVERIFIED_EVIDENCE' };
}

const QR_FIELDS = Object.freeze(['issuerRuc','documentTypeCode','series','number','igvAmount','payableAmount',
  'issueDate','customerIdentityType','customerIdentityNumber','digestValue']);
const validDigest = value => typeof value === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(value) &&
  Buffer.from(value, 'base64').toString('base64') === value;
/** Exact ten fields + trailing '|'. Currency is validated in the snapshot but absent from this QR format. */
function bindSyntheticQr(payload, snapshot, digestValue) {
  const { validateHistoricalSnapshot } = historyRequire('./dist/index.js');
  const s = validateHistoricalSnapshot(snapshot);
  check(['PEN','USD'].includes(s.currencyCode) && /^00000000[0-9]{3}$/.test(s.issuer.ruc) &&
    (s.customer.identityType !== '6' || /^00000000[0-9]{3}$/.test(s.customer.identityNumber)), 'QR_SYNTHETIC_PROFILE_BLOCKED');
  check(validDigest(digestValue), 'QR_DIGEST_INVALID');
  check(typeof payload === 'string' && Buffer.byteLength(payload, 'utf8') <= PDF_LIMITS.qrBytes &&
    !/[\x00-\x20\x7f\u202a-\u202e\u2066-\u2069]/u.test(payload), 'QR_INVALID');
  const parts = payload.split('|');
  check(parts.length === 11 && parts.pop() === '' && parts.every(Boolean), 'QR_FIELDS_INVALID');
  const fields = Object.fromEntries(QR_FIELDS.map((field,index) => [field, parts[index]]));
  check(/^00000000[0-9]{3}$/.test(fields.issuerRuc) && /^(01|03|07|08)$/.test(fields.documentTypeCode) &&
    /^[FB][A-Z0-9]{3}$/.test(fields.series) && /^[1-9][0-9]{0,7}$/.test(fields.number) &&
    ['igvAmount','payableAmount'].every(k => /^(0|[1-9][0-9]{0,15})\.[0-9]{2}$/.test(fields[k])) &&
    /^\d{4}-\d{2}-\d{2}$/.test(fields.issueDate) && /^[01467AB]$/.test(fields.customerIdentityType) &&
    /^[A-Z0-9-]{1,15}$/.test(fields.customerIdentityNumber) &&
    (fields.customerIdentityType !== '6' || /^00000000[0-9]{3}$/.test(fields.customerIdentityNumber)) &&
    validDigest(fields.digestValue), 'QR_FIELDS_INVALID');
  check(!Number.isNaN(Date.parse(fields.issueDate)) && new Date(fields.issueDate).toISOString().slice(0,10) === fields.issueDate, 'QR_FIELDS_INVALID');
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s.issueDate));
  const expected = { issuerRuc: s.issuer.ruc, documentTypeCode: s.ownership.documentTypeCode,
    series: s.ownership.series, number: s.number, igvAmount: s.amounts.igvAmount, payableAmount: s.amounts.payableAmount,
    issueDate: day, customerIdentityType: s.customer.identityType, customerIdentityNumber: s.customer.identityNumber, digestValue };
  const differences = QR_FIELDS.filter(field => fields[field] !== expected[field]).map(field => ({
    path: `qr.${field}`, category: 'CORRECTION_REQUIRED', expected: expected[field], actual: fields[field] }));
  return { schemaVersion: 'factuez.synthetic-qr-binding.v1', ...policy, fields, expected, differences,
    differenceCount: differences.length, bound: differences.length === 0,
    currencyCode: s.currencyCode, currencyInQr: false, currencyBindingVerified: false,
    digestConsistencyOnly: true };
}

const normalizeText = value => value.normalize('NFC').replace(/\s+/gu, ' ').trim();
const printedText = value => normalizeText(value.replace(/[\u202a-\u202e\u2066-\u2069]/gu, ''));
function printedMoney(value) {
  const [whole, fraction = ''] = value.split('.');
  let decimals = fraction.padEnd(2, '0');
  while (decimals.length > 2 && decimals.endsWith('0')) decimals = decimals.slice(0, -1);
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decimals}`;
}
const printedQuantity = value => value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;

/** Bind the extracted inspection text to the CURRENT local renderer's fixed labels.
 * Checks entire contiguous blocks, never amount/name substrings. It does not read
 * another PDF, authenticate a caller-supplied report, inspect glyph visibility, or
 * prove full PDF semantics, signature validity, CDR acceptance or physical print.
 * A changed renderer/layout requires review of this deliberately strict profile.
 */
function bindSyntheticPdfText(report, snapshot, digestValue) {
  const { validateHistoricalSnapshot, historyJson } = historyRequire('./dist/index.js');
  const s = validateHistoricalSnapshot(snapshot), r = historyJson(report);
  check(r.schemaVersion === 'factuez.synthetic-pdf-inspection.v1' && r.environment === 'BETA' &&
    r.datasetClass === 'SYNTHETIC' && r.noOfficialAuthority === true && r.fiscalAuthority === false &&
    ['ticket','a4'].includes(r.format) && typeof r.pdfSha256 === 'string' && /^[a-f0-9]{64}$/.test(r.pdfSha256), 'PDF_TEXT_PROFILE_BLOCKED');
  check(validDigest(digestValue), 'QR_DIGEST_INVALID');
  check(s.customer.identityType !== '6' || /^00000000[0-9]{3}$/.test(s.customer.identityNumber), 'QR_SYNTHETIC_PROFILE_BLOCKED');
  check(Array.isArray(r.textLines) && r.textLines.length <= PDF_LIMITS.textLines &&
    r.textLines.every(line => typeof line === 'string' && line.length <= PDF_LIMITS.textLineLength &&
      !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u202a-\u202e\u2066-\u2069]/u.test(line)) &&
    r.textLines.reduce((n,line) => n + line.length, 0) <= PDF_LIMITS.textChars, 'PDF_TEXT_LIMIT');
  const fullNumber = `${s.ownership.series}-${s.number}`;
  const table = 'Descripción Cant. Und. P. unit. * Importe';
  const normalized = r.textLines.map(normalizeText).filter(Boolean), lines = [];
  // Remove only exact known continuation headers, page footers and table headers.
  // They otherwise occur between item blocks in a multi-page A4 extraction.
  for (let index = 0; index < normalized.length; index++) {
    const line = normalized[index];
    if (line === `${fullNumber} · RUC ${s.issuer.ruc} · PRUEBA LOCAL` ||
      (line.startsWith(`Prueba local · ${fullNumber} · Página `) &&
       /^\d+ de \d+$/.test(line.slice(`Prueba local · ${fullNumber} · Página `.length)))) continue;
    let tableLength = 0;
    for (let n = 1; n <= 5 && index + n <= normalized.length; n++) {
      if (normalized.slice(index,index + n).join(' ') === table) { tableLength = n; break; }
    }
    if (tableLength) { index += tableLength - 1; continue; }
    lines.push(line);
  }
  const title = /^(FACTURA|BOLETA DE VENTA|NOTA DE CRÉDITO|NOTA DE DÉBITO)(?:\s|$)/u;
  const identity = /^(RUC|DNI|Documento):(?:\s|$)/u;
  const item = /^[1-9][0-9]*\.\s/u;
  const afterTotal = /^(Forma de pago:|Saldo pendiente:|FIRMA LOCAL|CIRCUITO SIMULADO|Firma digital,|Estado de prueba:|Hash XML firmado:|Esta prueba)/u;
  const checks = [];
  const checkValue = (field, expected, candidates) => {
    const matched = candidates.length === 1 && candidates[0] === expected;
    checks.push({ path: field, matched, expected, actualCandidates: candidates,
      ambiguous: candidates.length > 1 });
  };
  const blocks = (start, stop, join = parts => parts.join(' ')) => {
    const values = [];
    for (let index = 0; index < lines.length; index++) {
      if (!start.test(lines[index])) continue;
      let end = index + 1;
      while (end < lines.length && !stop.test(lines[end]) && end - index <= 12) end++;
      // Oversized or unclosed blocks never match a partial expected prefix.
      const closed = end < lines.length && stop.test(lines[end]);
      values.push(closed && end - index <= 12 ? join(lines.slice(index,end)) : '[UNBOUNDED_OR_UNCLOSED_BLOCK]');
    }
    return values;
  };
  const field = (name, expected, start, stop) => checkValue(name, printedText(expected), blocks(start,stop));
  const issuer = [s.issuer.tradeName, s.issuer.legalName].filter(Boolean).join(' ');
  field('text.header.issuer', `DOCUMENTO LOCAL DE PRUEBA SIN VALIDEZ TRIBUTARIA · NO ACEPTADO POR SUNAT ${issuer} RUC ${s.issuer.ruc} ${s.issuer.address}`,
    /^DOCUMENTO LOCAL DE PRUEBA$/u, title);
  const titles = { '01': 'FACTURA', '03': 'BOLETA DE VENTA', '07': 'NOTA DE CRÉDITO', '08': 'NOTA DE DÉBITO' };
  field('text.header.document', `${titles[s.ownership.documentTypeCode]} · ${fullNumber}`, title, /^Emisión:/u);
  const day = new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima' }).format(new Date(s.issueDate));
  field('text.header.issueDate', `Emisión: ${day} · Lima`, /^Emisión:/u, /^(Comprobante afectado:|Cliente:)/u);
  field('text.customer.legalName', `Cliente: ${s.customer.legalName}`, /^Cliente:/u, identity);
  const customerLabel = s.customer.identityType === '6' ? 'RUC' : s.customer.identityType === '1' ? 'DNI' : 'Documento';
  field('text.customer.identityAndAddress', `${customerLabel}: ${s.customer.identityNumber} ${s.customer.address || ''}`, identity, /^Moneda:/u);
  field('text.header.currency', `Moneda: ${s.currencyCode} · Entorno: BETA`, /^Moneda:/u,
    /^(Descripción(?:\s|$)|[1-9][0-9]*\.\s)/u);
  const itemNumbers = lines.filter(line => item.test(line)).map(line => Number(line.match(/^([1-9][0-9]*)\./u)[1]));
  checkValue('text.items.orderAndCount', JSON.stringify(s.items.map(i => i.lineNumber)), [JSON.stringify(itemNumbers)]);
  for (const line of s.items) {
    const expected = `${line.lineNumber}. ${line.description} ${printedQuantity(line.quantity)} ${line.unitCode} ${r.format === 'ticket' ? '× ' : ''}${printedMoney(line.unitPriceWithTax)} ${printedMoney(line.amounts.payableAmount)}`;
    field(`text.items.${line.lineNumber}.row`, expected, new RegExp(`^${line.lineNumber}\\.\\s`, 'u'),
      /^(?:[1-9][0-9]*\.\s|\* Precios unitarios con impuestos incluidos\.)/u);
  }
  field('text.amounts.taxableAmount', `Base de ítems sin IGV ${printedMoney(s.amounts.taxableAmount)}`,
    /^Base de ítems sin IGV(?:\s|$)/u, /^IGV(?:\s|$)/u);
  field('text.amounts.igvAmount', `IGV ${printedMoney(s.amounts.igvAmount)}`, /^IGV(?:\s|$)/u, /^TOTAL(?:\s|$)/u);
  field('text.amounts.payableAmount', `TOTAL ${s.currencyCode} ${printedMoney(s.amounts.payableAmount)}`,
    /^TOTAL(?:\s|$)/u, afterTotal);
  // PDFKit/Inter wraps the unbroken Base64 token inside narrow ticket cells.
  // Rejoin ONLY complete Base64 line fragments inside this anchored block. Spaces
  // within a line, extra prose, repeated labels and noncanonical/full-length
  // digests remain differences; other printed fields retain ordinary word spaces.
  const visibleDigests = blocks(/^Hash XML firmado:/u, /^QR de prueba/u, parts => {
    const first = parts[0].match(/^Hash XML firmado:(?: ([A-Za-z0-9+/=]+))?$/u);
    if (!first || !parts.slice(1).every(part => /^[A-Za-z0-9+/=]+$/u.test(part))) return parts.join(' ');
    const joined = (first[1] || '') + parts.slice(1).join('');
    return validDigest(joined) ? `Hash XML firmado: ${joined}` : parts.join(' ');
  });
  checkValue('text.digestValue', `Hash XML firmado: ${digestValue}`, visibleDigests);
  const differences = checks.filter(c => !c.matched).map(c => ({ path: c.path,
    category: c.actualCandidates.length ? 'CORRECTION_REQUIRED' : 'DATA_MISSING',
    expected: c.expected, actual: c.actualCandidates.length ? c.actualCandidates : null, ambiguous: c.ambiguous }));
  return { schemaVersion: 'factuez.synthetic-pdf-text-binding.v1', ...policy, inspectionPdfSha256: r.pdfSha256,
    format: r.format, checks, differences, differenceCount: differences.length, bound: differences.length === 0,
    bindingCoverage: ['RENDERER_HEADER','CUSTOMER_NAME_ID_ADDRESS','ITEM_ORDER_DESCRIPTION_QUANTITY_UNIT_PRICE_AMOUNT',
      'TAXABLE_IGV_TOTAL_CURRENCY','VISIBLE_DIGEST_CONSISTENCY'],
    completePdfSemanticsVerified: false, cryptographicHashVerified: false, digestConsistencyOnly: true,
    reportProvenanceVerified: false };
}

module.exports = { inspectSyntheticPdf, compareSyntheticPdf, decodeQrPng, bindSyntheticQr,
  bindSyntheticPdfText, PDF_LIMITS, PDF_RUNTIME, QR_FIELDS };
