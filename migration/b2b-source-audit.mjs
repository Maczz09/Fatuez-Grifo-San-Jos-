// B2B-01: bounded source-only inventory. No application imports, network or runtime data.
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ts = require('typescript'); // Parse text only; never evaluate TS decorators/modules.
const manifestPath = 'packages/contracts/src/b2b-inventory.v1.json';
const MAX_BYTES = 1024 * 1024;
const classifications = ['ADAPT', 'NEW', 'LAB_ONLY', 'INTERNAL_ONLY'];
const permissionCodes = new Set(['setup.manage', 'user.manage', 'role.manage', 'product.manage', 'series.manage', 'sunat.configure', 'document.issue', 'document.view', 'document.retry', 'document.email', 'shift.open', 'shift.close', 'report.view', 'report.export', 'audit.view']);
function assert(ok, message) { if (!ok) throw new Error(message); }
function allowedSource(path) {
  return typeof path === 'string' && !path.includes('..') && !path.includes('\\') &&
    /^services\/[a-z][a-z0-9-]+\/(?:src\/[a-zA-Z0-9_./-]+\.ts|prisma\/schema\.prisma)$/.test(path) &&
    !/(?:^|\/)(?:generated|node_modules|dist|secrets|credentials)(?:\/|$)/i.test(path);
}

export function validateB2bInventory(value) {
  assert(value?.schemaVersion === 'factuez.b2b.inventory.v1' && value.phase === 'B2B-01', 'INVENTORY_VERSION_INVALID');
  assert(value.status === 'SOURCE_CONTRACT_ONLY' && value.runtimeImplemented === false &&
    JSON.stringify(value.environments) === '["BETA"]', 'SOURCE_ONLY_BETA_REQUIRED');
  assert(Array.isArray(value.features) && value.features.length >= 20 && value.features.length <= 100, 'FEATURES_INVALID');
  const ids = new Set(), actions = new Set();
  for (const feature of value.features) {
    assert(typeof feature.id === 'string' && /^[a-z][a-z0-9-]+$/.test(feature.id) && !ids.has(feature.id), 'FEATURE_ID_INVALID');
    ids.add(feature.id);
    assert(classifications.includes(feature.classification) && Number.isInteger(feature.phase) && feature.phase >= 1 && feature.phase <= 9, 'CLASSIFICATION_INVALID');
    for (const key of ['label', 'businessState', 'gap']) assert(typeof feature[key] === 'string' && feature[key].length > 0, 'FEATURE_DESCRIPTION_REQUIRED');
    assert(Array.isArray(feature.owners) && feature.owners.length && feature.owners.every(owner => /^[a-z][a-z0-9-]+$/.test(owner)), 'OWNER_REQUIRED');
    assert(Array.isArray(feature.humanPermissions) && feature.humanPermissions.every(permission => permissionCodes.has(permission)), 'HUMAN_PERMISSION_INVALID');
    assert(typeof feature.humanStepUp === 'boolean', 'STEP_UP_POLICY_REQUIRED');
    assert(Array.isArray(feature.screens) && feature.screens.every(screen => /^[a-z-]+(?:\/\[id\])?$/.test(screen)), 'SCREEN_INVALID');
    // Dedicated reception-original permission, not an emitted-artifact grant.
    // Keep other multi-segment/unregistered scope spellings outside this grammar.
    assert(Array.isArray(feature.scopes) && feature.scopes.every(scope => /^b2b:[a-z-]+:[a-z-]+$/.test(scope) || scope === 'b2b:received:artifacts:read'), 'B2B_SCOPE_INVALID');
    assert(Array.isArray(feature.events) && feature.events.every(event => /^[a-z][a-z.-]+\.v1$/.test(event)), 'EVENT_INVALID');
    assert(Array.isArray(feature.sources) && feature.sources.length > 0, 'SOURCE_REQUIRED');
    for (const source of feature.sources) {
      assert(allowedSource(source.path), 'SOURCE_PATH_INVALID');
      assert(Array.isArray(source.anchors) && source.anchors.length && source.anchors.every(anchor => typeof anchor === 'string' && anchor.length > 0 && anchor.length <= 200), 'ANCHOR_INVALID');
    }
    assert(Array.isArray(feature.actions), 'ACTIONS_REQUIRED');
    for (const action of feature.actions) {
      assert(typeof action === 'string' && /^(GET|POST|PATCH) \/b2b\/v1\/[a-zA-Z0-9/{}-]+$/.test(action) && !actions.has(action), 'ACTION_INVALID_OR_DUPLICATE');
      assert(!/^(PATCH|POST) \/b2b\/v1\/documents\/\{documentId\}$/.test(action), 'ISSUED_DOCUMENT_IMMUTABLE');
      actions.add(action);
    }
    if (feature.classification === 'INTERNAL_ONLY') assert(!feature.actions.length && !feature.scopes.length && !feature.events.length, 'INTERNAL_CAPABILITY_CANNOT_BE_PUBLISHED');
    else assert(feature.scopes.length > 0 && feature.phase >= 2, 'EXTERNAL_SCOPE_AND_PHASE_REQUIRED');
  }
  return value;
}

const decorators = node => ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
function decoratedCall(node, names) {
  return decorators(node).map(dec => dec.expression).find(expression =>
    ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && names.includes(expression.expression.text));
}
function literalPath(call) {
  if (!call.arguments.length) return '';
  assert(call.arguments.length === 1 && ts.isStringLiteralLike(call.arguments[0]), 'DYNAMIC_CONTROLLER_ROUTE_REQUIRES_REVIEW');
  return call.arguments[0].text;
}
function decoratorArguments(node, name, source) {
  const call = decoratedCall(node, [name]);
  return call ? call.arguments.map(argument => argument.getText(source)) : [];
}
export function inspectControllerText(path, content) {
  const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert(!source.parseDiagnostics.length, `SOURCE_PARSE_FAILED:${path}`);
  const routes = [];
  const visit = node => {
    if (ts.isClassDeclaration(node)) {
      const controller = decoratedCall(node, ['Controller']);
      if (controller) {
        const prefix = literalPath(controller);
        for (const member of node.members) {
          const route = decoratedCall(member, ['Get', 'Post', 'Patch', 'Put', 'Delete', 'Head', 'Options', 'All']);
          if (!route) continue;
          const suffix = literalPath(route);
          routes.push({ path: `/${[prefix, suffix].filter(Boolean).join('/')}`,
            method: route.expression.text.toUpperCase(), controller: node.name?.text ?? 'ANONYMOUS',
            handler: member.name?.getText(source) ?? 'UNKNOWN',
            source: path, line: source.getLineAndCharacterOfPosition(member.getStart(source)).line + 1,
            declaredAccess: {
              controllerGuards: decoratorArguments(node, 'UseGuards', source),
              handlerGuards: decoratorArguments(member, 'UseGuards', source),
              controllerPermissions: decoratorArguments(node, 'RequiredPermissions', source),
              handlerPermissions: decoratorArguments(member, 'RequiredPermissions', source),
              interpretation: 'SOURCE_ANNOTATIONS_NOT_EFFECTIVE_AUTHORIZATION',
            } });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return routes;
}

async function safeRead(path) {
  const resolvedRoot = await realpath(root), target = await realpath(resolve(root, path));
  const child = relative(resolvedRoot, target);
  assert(child && child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child), 'SOURCE_OUTSIDE_REPOSITORY');
  const info = await stat(target);
  assert(info.isFile() && info.size <= MAX_BYTES, 'SOURCE_SIZE_LIMIT');
  const bytes = await readFile(target);
  assert(bytes.byteLength <= MAX_BYTES, 'SOURCE_SIZE_LIMIT');
  return bytes;
}
async function sourceFiles(directory, predicate, result = []) {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (entry.isSymbolicLink() || /^(?:generated|node_modules|dist|secrets|credentials|\.git)$/.test(entry.name)) continue;
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await sourceFiles(path, predicate, result);
    else if (entry.isFile() && predicate(path)) result.push(path);
    assert(result.length <= 2000, 'SOURCE_FILE_COUNT_LIMIT');
  }
  return result;
}

export async function auditB2bSources() {
  const manifestBytes = await safeRead(manifestPath);
  const inventory = validateB2bInventory(JSON.parse(manifestBytes.toString('utf8')));
  const evidence = new Map();
  for (const feature of inventory.features) {
    for (const source of feature.sources) {
      const bytes = await safeRead(source.path), content = bytes.toString('utf8');
      const anchors = source.anchors.map(anchor => {
        const offset = content.indexOf(anchor);
        assert(offset >= 0, `SOURCE_ANCHOR_MISSING:${feature.id}:${anchor}`);
        return { anchor, line: content.slice(0, offset).split('\n').length };
      });
      const item = evidence.get(source.path) ?? { path: source.path, sha256: createHash('sha256').update(bytes).digest('hex'), features: [], anchors: [] };
      item.features.push(feature.id); item.anchors.push(...anchors); evidence.set(source.path, item);
    }
  }
  const routes = [];
  const services = (await readdir(resolve(root, 'services'), { withFileTypes: true })).filter(entry => entry.isDirectory() && /^[a-z][a-z0-9-]+$/.test(entry.name));
  for (const service of services) {
    const src = `services/${service.name}/src`;
    try { await stat(resolve(root, src)); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const path of await sourceFiles(src, path => path.endsWith('.ts') && !path.endsWith('.spec.ts') && !path.endsWith('.test.ts') && !path.endsWith('.d.ts'))) {
      const content = (await safeRead(path)).toString('utf8');
      if (!content.includes('@Controller')) continue;
      for (const route of inspectControllerText(path, content)) {
        const special = route.path === '/health' ? 'INTERNAL_HEALTH' : route.path.startsWith('/internal/integration') ? 'INTERNAL_INTEGRATION'
          : route.path.startsWith('/integration/oauth') ? 'EXISTING_READONLY_OAUTH'
          : route.path.startsWith('/.well-known') ? 'IDENTITY_PUBLIC_METADATA' : null;
        const features = evidence.get(path)?.features ?? [];
        assert(special || features.length, `UNCLASSIFIED_CONTROLLER:${path}:${route.path}`);
        routes.push({ ...route, classification: special ?? 'FEATURE_MATRIX', features,
          availability: 'SOURCE_DECLARATION_ONLY_NOT_RUNTIME_VERIFIED' });
      }
    }
  }
  const screens = [];
  for (const path of await sourceFiles('apps/web-pwa/app', path => path.endsWith('/page.tsx'))) {
    const screen = path.replace('apps/web-pwa/app/', '').replace('(workspace)/', '').replace(/\/?page\.tsx$/, '');
    const features = inventory.features.filter(feature => feature.screens.includes(screen)).map(feature => feature.id);
    assert(screen === '' || features.length, `UNCLASSIFIED_SCREEN:${screen}`);
    screens.push({ path, screen: screen || '(entry redirect)', features });
  }
  return {
    schemaVersion: 'factuez.b2b.source-audit.v1', phase: 'B2B-01', status: 'SOURCE_EVIDENCE_VERIFIED',
    inventorySha256: createHash('sha256').update(manifestBytes).digest('hex'),
    runtimeEnabled: false, runtimeDataRead: false, credentialsRead: false, externalNetworkUsed: false,
    fiscalAcceptance: 'NOT_VERIFIED', controllerRegistration: 'NOT_INFERRED_FROM_DECLARATIONS',
    featureCount: inventory.features.length, plannedActionCount: inventory.features.reduce((n, f) => n + f.actions.length, 0),
    routeCount: routes.length, screenCount: screens.length,
    classifications: Object.fromEntries(classifications.map(category => [category, inventory.features.filter(f => f.classification === category).length])),
    routes, screens, evidence: [...evidence.values()],
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    assert(process.argv.length === 3 && process.argv[2] === '--source-only', 'REQUIRES_SOURCE_ONLY_NO_OTHER_ARGUMENTS');
    console.log(JSON.stringify(await auditB2bSources(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'B2B_SOURCE_AUDIT_FAILED');
    process.exitCode = 1;
  }
}
