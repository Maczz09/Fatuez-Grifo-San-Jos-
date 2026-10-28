import {FactuEzB2bClient,type ReceivedScope,type ReceivedUpload,type ReceivedAttachment} from '../../../packages/b2b-sdk/src';
/** Uploads carry canonical base64, never a filesystem path. Each original is <=65536 decoded bytes. */
export async function receivedExample(client:FactuEzB2bClient,scope:ReceivedScope,xml:ReceivedUpload,
  attachment:ReceivedAttachment,expectedXmlSha256:string,targetBranchId:string,
  keys:{import:string;attach:string;register:string;assign:string}) {
  const imported=await client.receivedImportXML(scope,xml,{idempotencyKey:keys.import});
  const id=imported.result.documentId;
  await client.receivedAttach(scope,id,attachment,{idempotencyKey:keys.attach});
  await client.receivedRegister(scope,id,{registeredAt:null,erpReference:'ERP-1',expectedErpReference:null},{idempotencyKey:keys.register});
  // Caller obtains this hash from the verified detail/original. Target needs its own current grant.
  return client.receivedAssign(scope,id,{targetBranchId,expectedXmlSha256},{idempotencyKey:keys.assign});
}
