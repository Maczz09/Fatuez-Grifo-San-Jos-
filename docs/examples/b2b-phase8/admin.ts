import {FactuEzB2bAdminClient,type FactuEzB2bAdminOptions,type ApplicationCreate} from '../../../packages/b2b-sdk/src';
/** Options require an independent live human adminBearer and explicit CA/cert/key/server DER pin.
 * The caller must immediately deliver the returned secret to its approved secret manager.
 * This example has no logging, persistence, PWA cookie, SERVICE fallback or automatic invocation. */
export function createApplicationOnce(options:FactuEzB2bAdminOptions,body:ApplicationCreate) {
  return new FactuEzB2bAdminClient(options).createApplication(body);
}
/** A separate explicit operation, with the revision read from current metadata. */
export function rotateApplicationSecretOnce(options:FactuEzB2bAdminOptions,id:string,expectedRevision:number) {
  return new FactuEzB2bAdminClient(options).rotateApplicationSecret(id,{expectedRevision});
}
