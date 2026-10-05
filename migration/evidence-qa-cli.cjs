#!/usr/bin/env node
'use strict';
// Fixed fictional inputs only. No real-data flag, database, Outbox or fiscal port.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
if(process.argv.length!==3||process.argv[2]!=='--isolated-synthetic-only'){
  console.error('EVIDENCE_ARGUMENTS_BLOCKED: sólo --isolated-synthetic-only, sin archivos ni RUC de entrada.');process.exit(2);
}
let networkAttempts=0;
const networkBlocked=()=>{networkAttempts++;throw new Error('EVIDENCE_NETWORK_BLOCKED');};
for(const [name,methods] of [['node:http',['request','get']],['node:https',['request','get']],['node:net',['connect','createConnection']],['node:tls',['connect']]])
  for(const method of methods)require(name)[method]=networkBlocked;
globalThis.fetch=networkBlocked;
const core=require('../packages/evidence-core/dist'),fixtures=require('../packages/evidence-core/dist/fixtures');
const {renderLocalDocumentPdf}=require('../packages/pdf-renderer/dist');
const {buildCryptoEvidenceFixture}=require('./evidence-crypto-fixture.cjs');
const pdf=require('./evidence-pdf.cjs');
const root=fs.realpathSync(path.join(__dirname,'..')),profile={environment:'BETA',datasetClass:'SYNTHETIC'};
let activeStep='INITIALIZATION';
function ownedDirectory(relative){let target=root;
  for(const part of relative.split('/')){assert.match(part,/^[A-Za-z0-9_-]+$/);target=path.join(target,part);
    if(!fs.existsSync(target))fs.mkdirSync(target);assert.equal(fs.lstatSync(target).isSymbolicLink(),false);assert(fs.statSync(target).isDirectory());
    assert(fs.realpathSync(target).startsWith(root+path.sep));}
  return target;}
function printable(s){const value={documentId:s.sourceDocumentId,companyId:s.ownership.companyId,branchId:s.ownership.branchId,
  environment:'BETA',documentTypeCode:s.ownership.documentTypeCode,series:s.ownership.series,number:s.number,fullNumber:s.ownership.series+'-'+s.number,
  issueDate:s.issueDate,currencyCode:s.currencyCode,operationTypeCode:s.operationTypeCode,paymentTerms:s.paymentTerms,
  issuer:{identityType:'6',identityNumber:s.issuer.ruc,legalName:s.issuer.legalName,tradeName:s.issuer.tradeName??undefined,address:s.issuer.address,ubigeo:s.issuer.ubigeo,establishmentCode:s.issuer.establishmentCode},
  customer:{identityType:s.customer.identityType,identityNumber:s.customer.identityNumber,legalName:s.customer.legalName,address:s.customer.address??undefined},
  lines:s.items.map(i=>({lineNumber:i.lineNumber,productCode:i.productCode??undefined,description:i.description,unitCode:i.unitCode,quantity:i.quantity,
    unitValue:i.unitValue,unitPriceWithTax:i.unitPriceWithTax,taxAffectationCode:i.taxAffectationCode,igvRate:i.igvRate,lineExtensionAmount:i.amounts.taxableAmount,
    igvAmount:i.amounts.igvAmount,totalAmount:i.amounts.payableAmount})),totals:{taxableAmount:s.amounts.taxableAmount,igvAmount:s.amounts.igvAmount,payableAmount:s.amounts.payableAmount}};
  if(s.reference)Object.assign(value,{reference:{fullNumber:s.reference.series+'-'+s.reference.number,documentTypeCode:s.reference.documentTypeCode,issueDate:s.issueDate},
    reasonCode:s.reference.reasonCode,reasonDescription:s.reference.reason});return value;}
async function main(){
  const runDirectory=fs.mkdtempSync(path.join(ownedDirectory('tmp/evidence-qa'),'run-'));
  const write=(name,bytes)=>{assert.match(name,/^[a-zA-Z0-9_-]+\.(json|csv|md|pdf|xml)$/);fs.writeFileSync(path.join(runDirectory,name),bytes,{flag:'wx'});};
  const checks=[],check=(label,fn)=>{activeStep=label;fn();checks.push({label,status:'PASS'});};
  const fixture=buildCryptoEvidenceFixture('00000000001');
  const certificateInput={...profile,certificatePem:fixture.certificatePem,rootCertificatePem:fixture.rootCertificatePem,pinnedRootSha256:fixture.pinnedRootSha256,checkedAt:fixture.checkedAt,issuerRuc:'00000000001'};
  const certificate=core.verifySyntheticCertificate(certificateInput),documents=[],legacy=[],factuez=[];
  check('PKI sintética directa, pin externo, identidad ficticia y vigencia',()=>{assert(certificate.chainSignatureVerified);assert.equal(certificate.officialTrust,false);assert.equal(certificate.revocationStatus,'NOT_CHECKED');});
  for(const [index,type] of ['01','03','07','08'].entries()){
    activeStep=`XML_${type}`;
    const snapshot=fixtures.createBusinessEvidenceSnapshot(type),unsigned=fixtures.buildBusinessEvidenceXml(snapshot),candidate=fixtures.buildBusinessEvidenceXml(snapshot,'b');
    const rootKind=type==='07'?'CreditNote':type==='08'?'DebitNote':'Invoice',signed=fixture.sign(unsigned,rootKind);
    const signature=core.verifySyntheticXmlSignature({...profile,xml:signed,certificatePem:fixture.certificatePem,expectedUnsignedXml:unsigned,rootKind});
    const bound=core.bindSyntheticBusinessXml(signature.authenticatedXml,snapshot),xmlComparison=core.compareSyntheticBusinessXml(unsigned,candidate);
    check(`XML ${type}: firma, snapshot completo y equivalencia semántica`,()=>{assert(bound.binding.match);assert(xmlComparison.match);assert.equal(signature.signatureVerified,true);});
    check(`XML ${type}: alteración de importe rechazada`,()=>assert.throws(()=>core.verifySyntheticXmlSignature({...profile,xml:signed.replace('>118.00<','>119.00<'),certificatePem:fixture.certificatePem,expectedUnsignedXml:unsigned,rootKind})));
    const expectedStatus=index===1?'SIMULATED_ACCEPTED_WITH_OBSERVATIONS':index===3?'SIMULATED_REJECTED':'SIMULATED_ACCEPTED';
    activeStep=`CDR_${type}`;
    const reference=snapshot.ownership.series+'-'+snapshot.number,cdrUnsigned=fixture.generateSyntheticCdr(snapshot.issuer.ruc,reference,expectedStatus,type),cdrXml=fixture.sign(cdrUnsigned,'ApplicationResponse');
    const cdrInput={...certificateInput,xml:cdrXml,expectedUnsignedXml:cdrUnsigned,reference,expectedDocumentTypeCode:type};
    const cdr=core.verifySyntheticCdr(cdrInput);
    check(`CDR ${type}: firma autenticada, destinatario, tipo y referencia`,()=>{assert.equal(cdr.status,expectedStatus);assert.equal(cdr.officialTrust,false);assert.equal(cdr.documentTypeBindingVerified,true);});
    check(`CDR ${type}: otro documento bloqueado`,()=>assert.throws(()=>core.verifySyntheticCdr({...cdrInput,reference:'FQ01-999'})));
    check(`CDR ${type}: mismo número con otro tipo bloqueado`,()=>assert.throws(()=>core.verifySyntheticCdr({...cdrInput,expectedDocumentTypeCode:type==='01'?'07':'01'})));
    const prints=[];
    for(const format of ['ticket','a4']){
      activeStep=`PDF_${type}_${format}`;
      const bytes=await renderLocalDocumentPdf(printable(snapshot),format,{digestValue:signature.digestValue,status:'SIGNED_LOCAL'});
      if(type==='01')write(format==='ticket'?'Factura_Ficticia_80mm.pdf':'Factura_Ficticia_A4.pdf',bytes);
      const options={...profile,format,...pdf.PDF_RUNTIME},comparison=pdf.compareSyntheticPdf(bytes,Buffer.from(bytes),options),inspection=comparison.left;
      write(`Inspection_${type}_${format}.json`,JSON.stringify(inspection,null,2));
      check(`PDF ${type} ${format}: bytes, tamaño, texto, píxeles y QR real`,()=>{assert(comparison.comparativeMatch);assert(comparison.qrEvidenceComplete);assert.equal(inspection.qrPayloads.length,1);});
      const qrBinding=pdf.bindSyntheticQr(inspection.qrPayloads[0],snapshot,signature.digestValue);
      check(`QR ${type} ${format}: vinculación de diez campos y digest firmado`,()=>assert(qrBinding.bound));
      if(format==='a4')check(`PDF ${type}: operación simple completa en una página A4`,()=>assert.equal(inspection.pageSizesMicrometers.length,1));
      const textBinding=pdf.bindSyntheticPdfText(inspection,snapshot,signature.digestValue);check(`Texto PDF ${type} ${format}: datos visibles del documento`,()=>assert(textBinding.bound));
      prints.push({format,pdfSha256:inspection.pdfSha256,pageSizesMicrometers:inspection.pageSizesMicrometers,textLines:inspection.textLines,
        rasterSha256:inspection.pages.map(p=>p.rasterSha256),qrBinding,textBinding,physicalPrintVerified:false});
      // Two samples retained, remaining PDFs inspected in memory and not persisted.
    }
    documents.push({type,fullNumber:reference,xmlComparison,binding:bound.binding,signature:{signatureVerified:true,digestValue:signature.digestValue,officialTrust:false},
      certificate, cdr:{status:cdr.status,responseCode:cdr.responseCode,notes:cdr.notes,documentTypeCode:cdr.documentTypeCode,documentTypeBindingVerified:cdr.documentTypeBindingVerified,signatureVerified:cdr.signatureVerified,officialTrust:false},prints});
    legacy.push({snapshot,xml:unsigned});factuez.push({snapshot,xml:candidate});
    write(`Ficticio_${type}_XML.xml`,signed);write(`Ficticio_${type}_CDR.xml`,cdrXml);
    console.log(JSON.stringify({type,status:'LOCAL_CHECKS_PASS',officialAcceptance:false}));
  }
  const original=fixtures.createBusinessEvidenceSnapshot(),unsigned=fixtures.buildBusinessEvidenceXml(original),signed=fixture.sign(unsigned,'Invoice');
  activeStep='NEGATIVE_PDF_CASES';
  const signature=core.verifySyntheticXmlSignature({...profile,xml:signed,certificatePem:fixture.certificatePem,expectedUnsignedXml:unsigned,rootKind:'Invoice'});
  const changed=structuredClone(original);changed.customer.legalName='CLIENTE FICTICIO CAMBIADO';changed.customer.identityNumber='00000000003';
  const originalPdf=await renderLocalDocumentPdf(printable(original),'a4',{digestValue:signature.digestValue,status:'SIGNED_LOCAL'});
  // Fixed-length metadata-only mutation of a self-generated fixture preserves
  // xref offsets. It is not an editor for customer PDFs or archived documents.
  const metadataSource=originalPdf.toString('latin1'),producerReference=/\/Producer\s+([0-9]+)\s+0\s+R/.exec(metadataSource);assert(producerReference);
  const producerObject=new RegExp(`(\\b${producerReference[1]} 0 obj\\s*)\\(PDFKit\\)(\\s*endobj\\b)`,'g');
  assert.equal([...metadataSource.matchAll(producerObject)].length,1);
  const metadataPdf=Buffer.from(metadataSource.replace(producerObject,'$1(QATEST)$2'),'latin1');
  const metadataComparison=pdf.compareSyntheticPdf(originalPdf,metadataPdf,{...profile,format:'a4',...pdf.PDF_RUNTIME});
  check('PDF: bytes distintos sólo por metadatos no cambian texto/píxeles/QR',()=>{assert(!metadataPdf.equals(originalPdf));assert(metadataComparison.comparativeMatch);});
  const changedPdf=await renderLocalDocumentPdf(printable(changed),'a4',{digestValue:signature.digestValue,status:'SIGNED_LOCAL'});
  const options={...profile,format:'a4',...pdf.PDF_RUNTIME},negativePdf=pdf.compareSyntheticPdf(originalPdf,changedPdf,options);
  check('PDF alterado: cliente visible y QR divergentes detectados',()=>{assert(!negativePdf.comparativeMatch);assert(!pdf.bindSyntheticQr(negativePdf.right.qrPayloads[0],original,signature.digestValue).bound);});
  const noQrPdf=await renderLocalDocumentPdf(printable(original),'a4'),noQrInspection=pdf.inspectSyntheticPdf(noQrPdf,options);
  check('PDF sin QR: evidencia ausente, no aceptación',()=>assert.equal(noQrInspection.qrStatus,'MISSING'));
  const reconciliation=core.reconcileSyntheticEvidence({schemaVersion:'factuez.evidence-reconciliation-input.v1',...profile,runId:'00000000-0000-4000-8000-000000040004',legacy,factuez});
  activeStep='RECONCILIATION';
  check('Conciliación íntegra por RUC/moneda/tipo/serie sin aprobación',()=>{assert.equal(reconciliation.issueCount,0);assert(reconciliation.totals.match);assert.equal(reconciliation.accountingApproved,false);});
  const differentFactuez=structuredClone(factuez);differentFactuez[0].snapshot.customer.legalName='DIFERENCIA FICTICIA PARA REVISAR';
  differentFactuez[0].xml=fixtures.buildBusinessEvidenceXml(differentFactuez[0].snapshot);
  const differences=core.reconcileSyntheticEvidence({schemaVersion:'factuez.evidence-reconciliation-input.v1',...profile,runId:'00000000-0000-4000-8000-000000040005',legacy,factuez:differentFactuez});
  check('Conciliación con importes iguales no oculta otro cliente',()=>assert(differences.issueCount>0));
  check('Cero conexiones/red y ningún cliente fiscal o BD cargado',()=>{assert.equal(networkAttempts,0);assert(!Object.keys(require.cache).some(p=>/[\\/](?:pg|bullmq|ioredis|soap|dotenv|@prisma)[\\/]/.test(p)));});
  const report={schemaVersion:'factuez.evidence-qa-run.v1',...core.EVIDENCE_POLICY,runDirectory,checks,documents,reconciliation,
    negativeCases:{pdfDifferenceCount:negativePdf.differenceCount,missingQr:noQrInspection.qrStatus,reconciliationIssues:differences.issueCount},
    networkAttempts,fixturesOnly:true,privateKeysPersisted:false,officialAcceptance:false,clientInformationRequiredToValidateRealMigration:true};
  write('Informe_evidencia_ficticia.json',JSON.stringify(report,null,2));write('Conciliacion_coincidente.json',JSON.stringify(reconciliation,null,2));
  write('Conciliacion_diferencias.json',JSON.stringify(differences,null,2));write('Conciliacion_diferencias.csv','\uFEFF'+core.reconciliationIssuesCsv(differences));
  write('LEEME.md',`# Ensayo ficticio de evidencia\n\n${checks.length} comprobaciones PASS. Tipos 01, 03, 07 y 08; PDF 80 mm/A4, QR decodificado, firma XML y CDR simulados.\n\nSólo BETA/SYNTHETIC. Ningún envío, correo, BD, Outbox, correlativo o producción.\n\nCadena ficticia de laboratorio: revocación NO comprobada, confianza oficial FALSE. No hay aceptación SUNAT ni aprobación de contabilidad/corte. El comparador XML es un perfil versionado del contrato histórico, no validación fiscal universal. Impresión física no verificada.\n\nLos dos PDF guardados son muestras sin validez tributaria; las claves efímeras no se guardaron.\n`);
  console.log(JSON.stringify({status:'PASS',checks:checks.length,documents:documents.length,pdfInspections:8,networkAttempts,output:runDirectory,officialAcceptance:false}));
}
main().catch(error=>{const code=/^[A-Z0-9_]{1,80}$/.test(error?.code??error?.message??'')?error.code??error.message:'UNEXPECTED_EVIDENCE_FAILURE';
  console.error(JSON.stringify({error:'EVIDENCE_QA_FAILED',step:activeStep,code,officialAcceptance:false}));process.exitCode=1;});
