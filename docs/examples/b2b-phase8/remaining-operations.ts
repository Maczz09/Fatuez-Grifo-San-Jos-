import {
  FactuEzB2bClient,FactuEzB2bOwnerAdminClient,
  type FactuEzB2bOptions,type BusinessBinding,type ReceivedScope,
  type HistoricalArtifactKind,type ReceptionConfigurationSave,
  type ReceptionConfigurationWriteOptions,
} from '../../../packages/b2b-sdk/src';

// Importing this file performs no requests. TI supplies origin, verified CA/pin,
// client certificate and a provider of current, authorized credentials.
export async function readHistoricalOriginal(options:FactuEzB2bOptions,binding:BusinessBinding,recordId:string,kind:HistoricalArtifactKind){
  return new FactuEzB2bClient(options).downloadHistoricalArtifact(binding,recordId,kind);
}

// Configuration is staged. Saving it does not request OAuth or connect to a mailbox.
export async function stageReception(options:FactuEzB2bOptions,scope:ReceivedScope,body:ReceptionConfigurationSave,write:ReceptionConfigurationWriteOptions){
  return new FactuEzB2bClient(options).saveReceptionConfiguration(scope,body,write);
}

// Use a current delegated USER bearer here. The owner independently verifies
// human roles, additional verification and the exact issuer/branch/point/series.
export async function readFiscalReadiness(userOptions:FactuEzB2bOptions,binding:BusinessBinding){
  return new FactuEzB2bOwnerAdminClient(userOptions).readFiscalConfiguration(binding);
}

export async function renameBranch(userOptions:FactuEzB2bOptions,binding:BusinessBinding,expectedRevision:number,name:string){
  return new FactuEzB2bOwnerAdminClient(userOptions).updateBranch(binding,{expectedRevision,name});
}
