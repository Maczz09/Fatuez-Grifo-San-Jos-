// Mechanical generation of public design artifacts only. No application imports or DB access.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== '--refresh-design-artifacts') throw new Error('EXPLICIT_DESIGN_ARTIFACT_FLAG_REQUIRED');
  const { b2bDesignOpenApiV1 } = require('../packages/contracts/dist/b2b-openapi');
  const { b2bWebhookCatalog,b2bWebhookAsyncApiCandidate } = require('../packages/contracts/dist/b2b-webhooks');
  const { b2bReadOpenApiV1,b2bDraftOpenApiV1,b2bCandidateOpenApiV1 } = require('../packages/contracts/dist/b2b-read-openapi');
  const { auditB2bSources } = await import('./b2b-source-audit.mjs');
  const artifacts = [
    ['docs/b2b/openapi.design.v1.json', b2bDesignOpenApiV1()],
    ['docs/b2b/openapi.read.candidate.v1.json', b2bReadOpenApiV1()],
    ['docs/b2b/openapi.drafts.candidate.v1.json', b2bDraftOpenApiV1()],
    ['docs/b2b/openapi.candidate.v1.json', b2bCandidateOpenApiV1()],
    ['docs/b2b/webhooks.design.v1.json', b2bWebhookCatalog()],
    ['docs/b2b/asyncapi.webhooks.candidate.v1.json', b2bWebhookAsyncApiCandidate()],
    ['docs/b2b/source-audit.v1.json', await auditB2bSources()],
  ];
  for (const [relative, value] of artifacts) {
    const target = path.resolve(root, relative);
    if (!fs.realpathSync(path.dirname(target)).startsWith(fs.realpathSync(root) + path.sep) || fs.lstatSync(target).isSymbolicLink()) throw new Error('DESIGN_ARTIFACT_TARGET_INVALID');
    fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n', 'utf8');
  }
  console.log(JSON.stringify({ generated: artifacts.map(([name]) => name), runtimeEnabled: false }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
