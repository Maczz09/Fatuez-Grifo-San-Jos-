'use strict';
// Generated, fictional data only. Never load an export, database, secrets or a certificate.
const {createHash}=require('node:crypto');
const f=require('../../tests/helpers/history-full-fixtures.cjs');
const sha=s=>createHash('sha256').update(s).digest('hex');
const digest=s=>createHash('sha256').update(`DECLARED-ONLY-NOT-A-SIGNED-XML:${s}`).digest('base64');
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function day(s){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s.issueDate));}
function xml(s,prefix='cbc',declaredDigest=null,signatureId='SYNTHETIC-ONLY'){
  const kind=s.ownership.documentTypeCode==='07'?'CreditNote':s.ownership.documentTypeCode==='08'?'DebitNote':'Invoice';
  const signature=declaredDigest?`<ds:Signature Id="${signatureId}"><ds:SignedInfo><ds:Reference URI=""><ds:DigestValue>${declaredDigest}</ds:DigestValue></ds:Reference></ds:SignedInfo></ds:Signature>`:'';
  const leaf=(name,value)=>`<${prefix}:${name}>${escape(value)}</${prefix}:${name}>`;
  return `<?xml version="1.0"?><${kind} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${kind}-2" xmlns:${prefix}="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent>${signature}</ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions>${leaf('ID',s.ownership.series+'-'+s.number)}${leaf('IssueDate',day(s))}${kind==='Invoice'?leaf('InvoiceTypeCode',s.ownership.documentTypeCode):''}${leaf('DocumentCurrencyCode',s.currencyCode)}${leaf('Note','XML FICTICIO, NO UBL VALIDADO, SIN FIRMA CRIPTOGRAFICA')}${leaf('PayableAmount',s.amounts.payableAmount)}</${kind}>`;
}
function print(s,format='TICKET_80MM',declaredDigest=null,label='legacy'){
  return {schemaVersion:'factuez.shadow-print.v1',provenance:'SYNTHETIC_DECLARED',format,
    pageSizesMicrometers:[{width:format==='A4'?210000:80000,height:format==='A4'?297000:150000}],
    textLines:['REPRESENTACION FICTICIA - NO ES UN PDF',s.ownership.series+'-'+s.number,s.customer.legalName,'Total '+s.amounts.payableAmount],
    qrFields:{issuerRuc:s.issuer.ruc,documentTypeCode:s.ownership.documentTypeCode,series:s.ownership.series,number:s.number,
      igvAmount:s.amounts.igvAmount,payableAmount:s.amounts.payableAmount,issueDate:day(s),customerIdentityType:s.customer.identityType,customerIdentityNumber:s.customer.identityNumber},
    digestValue:declaredDigest,pdfSha256:sha(`DECLARED-NOT-PDF-BYTES:${label}:${format}:${s.number}`)};
}
function side(s,label='legacy',signed=true){
  const d=signed?digest(label+':'+s.number):null;
  return {snapshot:s,xml:xml(s,label==='legacy'?'c':'b',d,'SYNTHETIC-'+label),
    prints:['TICKET_80MM','A4'].map(format=>print(s,format,d,label))};
}
function pair(number=1,type='01'){
  const s=f.document(number,1,type);
  return {schemaVersion:'factuez.shadow-case.v1',environment:'BETA',datasetClass:'SYNTHETIC',mode:'SHADOW',caseId:f.uuid(8000000+number),
    legacy:side(structuredClone(s),'legacy'),factuez:side(structuredClone(s),'factuez')};
}
function run(){
  const a=pair(1),b=pair(2),c=pair(3,'03'),d=pair(4,'07');
  const changed=b.factuez.snapshot;
  changed.amounts.taxableAmount='101.00';changed.amounts.igvAmount='18.18';changed.amounts.payableAmount='119.18';
  changed.items[0].quantity='2.02';changed.items[0].amounts={...changed.amounts};
  changed.tax[0].taxableAmount='101.00';changed.tax[0].taxAmount='18.18';b.factuez=side(changed,'factuez');
  c.factuez.xml=null;c.factuez.prints=[];
  d.factuez.snapshot.observations='OBSERVACION FICTICIA CON OTRA PRESENTACION';
  return {schemaVersion:'factuez.shadow-run.v1',environment:'BETA',datasetClass:'SYNTHETIC',mode:'SHADOW',runId:f.uuid(8100000),cases:[a,b,c,d]};
}
module.exports={pair,run,side,xml,print,digest,sha};
