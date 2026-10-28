'use strict';
// Read-only, explicit file inventory. Never uses process.env, DB or SUNAT.
const {readFileSync,realpathSync,lstatSync,openSync,fstatSync,readSync,closeSync}=require('node:fs');
const {isAbsolute}=require('node:path');
const {createHash}=require('node:crypto');
const {TextDecoder}=require('node:util');
const {reviewOfflineGuidePair,validateOfflineReviewScope}=require('../packages/evidence-core/dist/offline-review.js');
const MAX=2*1024*1024;
const fail=code=>{throw new Error(code);};
function stableRead(path,max){
 if(typeof path!=='string'||!isAbsolute(path)||lstatSync(path).isSymbolicLink())fail('FILE_PATH');
 const resolved=realpathSync(path),fd=openSync(resolved,'r');
 try{
  const before=fstatSync(fd);if(!before.isFile()||before.size<=0||before.size>max)fail('FILE_SIZE');
  const bytes=Buffer.alloc(before.size);let n=0;
  while(n<bytes.length){const got=readSync(fd,bytes,n,bytes.length-n,n);if(!got)fail('FILE_CHANGED');n+=got;}
  const after=fstatSync(fd);
  if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs||after.ino!==before.ino)fail('FILE_CHANGED');
  return bytes;
 }finally{closeSync(fd);}
}
function run(args){
 if(args.length!==3||args[0]!=='--authorized-offline-review'||args[1]!=='--manifest')fail('EXPLICIT_SCOPE_REQUIRED');
 const manifestBytes=stableRead(args[2],16384),m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifestBytes));
 if(!m||Object.keys(m).sort().join(',')!=='documentFiles,schemaVersion,scope'||m.schemaVersion!=='factuez.offline-guide-files.v1')fail('MANIFEST_FIELDS');
 const scope=validateOfflineReviewScope(m.scope);
 if(!Array.isArray(m.documentFiles)||m.documentFiles.length!==2)fail('FILE_INVENTORY');
 const roles=new Map();
 for(const entry of m.documentFiles){
  if(!entry||Object.keys(entry).sort().join(',')!=='path,role,sha256'||!['GUIDE_XML','CDR_XML'].includes(entry.role)||roles.has(entry.role)||
    typeof entry.sha256!=='string'||!/^[a-f0-9]{64}$/.test(entry.sha256))fail('FILE_INVENTORY');
  const bytes=stableRead(entry.path,MAX),hash=createHash('sha256').update(bytes).digest('hex');
  if(hash!==entry.sha256)fail('FILE_SHA256_MISMATCH');
  roles.set(entry.role,{path:realpathSync(entry.path),xml:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)});
 }
 if(roles.get('GUIDE_XML').path===roles.get('CDR_XML').path)fail('DUPLICATE_FILE');
 const r=reviewOfflineGuidePair({scope,documentXml:roles.get('GUIDE_XML').xml,cdrXml:roles.get('CDR_XML').xml});
 // Deliberately exclude personal IDs, names, addresses, plates, notes, QR URLs,
 // certificate subjects/DER and raw files from stdout. Keep output local.
 const report={schemaVersion:r.schemaVersion,environment:r.environment,purpose:r.purpose,
  sourceManifestSha256:createHash('sha256').update(manifestBytes).digest('hex'),
  guide:{rawSha256:r.guide.rawSha256,type:r.guide.projection.documentTypeCode,fullNumber:r.guide.projection.fullNumber,
    issuerRuc:r.guide.projection.issuer.identityNumber,issueDate:r.guide.projection.issueDate,lineCount:r.guide.projection.items.length,
    signature:r.guide.signature,mappingCompleteness:r.guide.mappingCompleteness},
  cdr:{rawSha256:r.cdr.rawSha256,signature:r.cdr.signature,responseCode:r.cdr.projection.responseCode,
    reportedResult:r.cdr.projection.reportedResult,warningCodes:r.cdr.warningCodes,contentAuthenticated:r.cdr.contentAuthenticated,
    senderClaimsSunat:r.cdr.senderClaimsSunat},bindings:r.bindings,issues:r.issues,
  cryptographicPairBound:r.cryptographicPairBound,typeBindingVerified:r.typeBindingVerified,
  officialTrust:false,officialAcceptance:false,canEmit:false,canImportHistory:false,canChangeCounters:false,
  phase2Closed:false,phase3Closed:false,networkRequests:0,fiscalWrites:0,outboxWrites:0};
 console.log(JSON.stringify(report,null,2));
 // A verified but untrusted pair remains diagnostic; discrepancies exit 2.
 return r.cryptographicPairBound?0:2;
}
try{process.exitCode=run(process.argv.slice(2));}
catch(error){console.error(JSON.stringify({status:'BLOCKED',code:error?.code&&typeof error.code==='string'?error.code:
  /^[A-Z0-9_]+$/.test(error?.message??'')?error.message:'OFFLINE_REVIEW_FAILED',officialAcceptance:false,canImportHistory:false}));process.exitCode=1;}
