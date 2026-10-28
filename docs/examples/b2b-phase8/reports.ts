import {FactuEzB2bClient,type ReportFilters,type ReportFormat} from '../../../packages/b2b-sdk/src';
/** Explicit single capture/create/read/download. There is no timer, poller or automatic retry. */
export async function reportExample(client:FactuEzB2bClient,filters:ReportFilters,format:ReportFormat,idempotencyKey:string) {
  const dashboard=await client.dashboard(filters);
  const created=await client.createReport(filters,format,{idempotencyKey});
  const metadata=await client.readReport(created.data.id);
  if(metadata.data.state!=='READY')return {dashboard,metadata,download:null};
  const download=await client.downloadReport(metadata.data.id);
  return {dashboard,metadata,download};
}
