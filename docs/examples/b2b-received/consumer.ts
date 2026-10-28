import {
  FactuEzB2bClient, B2bSdkError,
  type FactuEzB2bOptions, type ReceivedScope, type ReceivedDownload,
} from '@factuez/b2b-sdk';

/** Example only: TI supplies secure credentials and a private storage sink.
 * No request occurs merely by importing this file. No tokens/PII are logged. */
export async function readReceivedPage(
  options: FactuEzB2bOptions,
  scope: ReceivedScope,
  period: { from: string; to: string; after?: string },
  saveOriginal: (documentId: string, original: ReceivedDownload) => Promise<void>,
) {
  const sdk = new FactuEzB2bClient(options);
  const capabilities = await sdk.capabilities();
  if (!['received-documents','received-originals'].every(id =>
    capabilities.features.some(f => f.id === id && f.state === 'ENABLED'))) {
    return { outcome: 'ASK_TI_FOR_RECEIVED_PERMISSIONS' as const };
  }
  try {
    const page = await sdk.listReceived({ scope, ...period, limit: 25 });
    for (const document of page.items) {
      const detail = await sdk.detail(scope, document.id);
      // Decimal strings are not converted to binary floating-point amounts.
      const itemCount = detail.projection.items.length;
      if (itemCount !== document.itemCount) throw new Error('PAGE_CHANGED_REVIEW_REQUIRED');
      const manifest = await sdk.artifactManifest(scope, document.id);
      for (const artifact of manifest.items) {
        // An explicit ID avoids guessing between multiple CDR originals.
        const original = artifact.kind === 'XML'
          ? await sdk.downloadXML(scope, document.id, artifact.id)
          : artifact.kind === 'CDR'
            ? await sdk.downloadCDR(scope, document.id, artifact.id)
            : await sdk.downloadProviderPDF(scope, document.id, artifact.id);
        // saveOriginal must use IDs/private storage, not blindly join fileName to a path.
        await saveOriginal(document.id, original);
      }
    }
    return { outcome:'READ' as const, nextAfter:page.page.nextAfter,
      hasMore:page.page.hasMore, consistency:page.page.consistency };
  } catch(error) {
    // Do not log HTTP bodies, document/customer data, credentials or the options object.
    if(error instanceof B2bSdkError) return { outcome:'FAILED' as const, code:error.code, status:error.status };
    throw new Error('LOCAL_PROCESSING_FAILED');
  }
}
