import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { snapshot09, snapshotPublic09, snapshot31 } from './production-guides.fixture';
import { buildProductionGuidesXml, validateProductionGuidesSnapshot, productionGuidesHash as hash } from '../packages/sunat-core/src/production-guides';
import { ProductionGuidesCatalogueRules } from '../services/sunat-service/src/production-guides-crypto';
import { createGuideSidecarPki } from './helpers/guide-sidecar-ephemeral-pki.fixture';
import { signLocalGuideXml } from '../services/sunat-service/src/infrastructure/crypto/guide-artifact-crypto';
import { verifyLocalSignedInvoice } from '../services/sunat-service/src/infrastructure/crypto/xml-signer.service';

const fuel={schemaVersion:'factuez.fuel-guide.v1',regime:'ORDINARY_GRE',scopCode:'000123456789'};
function addFuel(s:any){
 s.profile=({GRE09_PRIVATE04_V1:'GRE09_FUEL_PRIVATE04_SCOP_V1',GRE09_PUBLIC01_V1:'GRE09_FUEL_PUBLIC01_SCOP_V1',GRE31_PUBLIC_SINGLE09_V1:'GRE31_FUEL_PUBLIC_SINGLE09_V1'} as any)[s.profile];
 s.body.fuel={...fuel};s.body.items=[{code:'FUEL-TEST',description:'DIESEL B5 S50 SINTETICO',quantity:'100.5',unitCode:'GLL'}];return s;
}
function carrier(){const {s,ref}=snapshot31();addFuel(s);addFuel(ref.snapshot);const p=ref.projection as any;p.fuel={...fuel};p.items=(s.body as any).items;ref.projectionSha256=hash(p);(s.body as any).reference09.snapshotSha256=ref.projectionSha256;return {s,ref};}

describe('independent ordinary fuel GRE profiles',()=>{
 it.each([snapshot09,snapshotPublic09])('preserves SCOP leading zeros and immutable fuel hash; maps cat61 code81 only on09',factory=>{
  const s=addFuel(factory()),v=validateProductionGuidesSnapshot(s),x=buildProductionGuidesXml(s);
  expect(v).toEqual(s);expect(v).not.toBe(s);expect(x.snapshotSha256).toBe(hash(s));
  expect(x.xml).toContain('<cbc:ID>000123456789</cbc:ID>');expect(x.xml).toContain('catalogo61">81</cbc:DocumentTypeCode>');
  expect(x.xml).toContain('<cbc:DocumentType>Código de autorización emitida por el SCOP</cbc:DocumentType>');expect(x.xml).not.toContain('catalogo12');
  expect(x.xml.indexOf('<cac:AdditionalDocumentReference>')).toBeLessThan(x.xml.indexOf('<cac:Signature>'));
 });
 it('31 binds complete accepted09 fuel projection, omits code81 in XML and rejects changed SCOP',()=>{
  const {s,ref}=carrier(),xml=buildProductionGuidesXml(s,ref).xml;
  expect(xml).toContain('catalogo61">09</cbc:DocumentTypeCode>');expect(xml).not.toContain('>81</cbc:DocumentTypeCode>');
  (s.body as any).fuel.scopCode='DIFFERENT';expect(()=>buildProductionGuidesXml(s,ref)).toThrow('GRE_REFERENCE_MISMATCH');
 });
 it('rejects forged projection even if its caller recomputes the projection hash',()=>{
  const {s,ref}=carrier();(ref.projection as any).fuel.scopCode='FORGED';ref.projectionSha256=hash(ref.projection);(s.body as any).reference09.snapshotSha256=ref.projectionSha256;
  expect(()=>buildProductionGuidesXml(s,ref)).toThrow('GRE_REFERENCE_MISMATCH');
 });
 it('rejects cross-profile references to ordinary merchandise and unverified acceptance',()=>{
  const {s}=carrier();expect(()=>buildProductionGuidesXml(s,snapshot31().ref)).toThrow('GRE_REFERENCE_PROFILE_MISMATCH');
  const good=carrier();expect(()=>buildProductionGuidesXml(good.s,{...good.ref,signatureTrusted:false} as any)).toThrow('GRE_REFERENCE_UNTRUSTED');
 });
 it.each(['','a'.repeat(21),'123 456','<script>','123\n','123\t','á123',123456,null])('rejects invalid SCOP %j',code=>{
  const s=addFuel(snapshot09());s.body.fuel.scopCode=code;expect(()=>validateProductionGuidesSnapshot(s)).toThrow();
 });
 it.each(['GRE_BF','PENDING_REVIEW','GENERAL'])('never relabels unsupported regime %s as ordinary GRE',regime=>{
  const s=addFuel(snapshot09());s.body.fuel.regime=regime;expect(()=>validateProductionGuidesSnapshot(s)).toThrow('GRE_FUEL_REGIME_UNSUPPORTED');
 });
 it.each(['KGM','TNE','NIU'])('does not convert volume/weight or silently accept unsupported unit %s',unit=>{
  const s=addFuel(snapshot09());s.body.items[0].unitCode=unit;expect(()=>validateProductionGuidesSnapshot(s)).toThrow('GRE_FUEL_UNIT_UNSUPPORTED');
 });
 it('rejects missing, extra or falsely activated fuel fields and retains old strict profiles',()=>{
  for(const mutate of [(s:any)=>delete s.body.fuel,(s:any)=>s.body.fuel.verified=true,(s:any)=>s.body.regulatedGoods=true,(s:any)=>s.body.fuel.schemaVersion='other']){
   const s=addFuel(snapshot09());mutate(s);expect(()=>validateProductionGuidesSnapshot(s)).toThrow();
  }
  const legacy=snapshot09();(legacy.body as any).fuel=fuel;expect(()=>validateProductionGuidesSnapshot(legacy)).toThrow();
 });
 it('requires reviewed fuel goods and ordinary route classification under the exact grant hash',async()=>{
  const s=addFuel(snapshot09()),b=s.body;
  const catalogue:any={version:'factuez.production-guides.catalogue.v1',companyId:s.scope.companyId,issuerRuc:s.issuer.ruc,sourceUrl:'https://cpe.sunat.gob.pe/node/116',sourceSha256:'a'.repeat(64),
   units:['GLL'],ubigeos:[b.origin.ubigeo,b.destination.ubigeo],goods:b.items.map((i:any)=>({code:i.code,description:i.description,unitCode:i.unitCode,classification:'FUEL_SCOP'})),
   routes:[{origin:b.origin,destination:b.destination,fuelRegime:'ORDINARY_GRE'}],vehicles:[b.transport.vehicle],drivers:[b.transport.driver]};
  const check=(c:any)=>new ProductionGuidesCatalogueRules(c).validate(s,{rulesSha256:hash(c)} as any);
  await expect(check(catalogue)).resolves.toBeUndefined();
  const wrongGoods=structuredClone(catalogue);wrongGoods.goods[0].classification='NON_REGULATED';await expect(check(wrongGoods)).rejects.toThrow('GRE_CATALOGUE_NOT_APPROVED');
  const noRegime=structuredClone(catalogue);delete noRegime.routes[0].fuelRegime;await expect(check(noRegime)).rejects.toThrow('GRE_CATALOGUE_NOT_APPROVED');
  await expect(new ProductionGuidesCatalogueRules(catalogue).validate(s,{rulesSha256:'b'.repeat(64)} as any)).rejects.toThrow('GRE_CATALOGUE_PIN_INVALID');
 });
 it('signs all three fuel profiles with fresh keys, checks signature binding and official UBL2.1 XSD offline',()=>{
  const pairs=[{s:addFuel(snapshot09()),ref:undefined},{s:addFuel(snapshotPublic09()),ref:undefined},carrier()];
  const xmls=pairs.map(({s,ref})=>{
   const pki=createGuideSidecarPki(s.issuer.ruc),x=buildProductionGuidesXml(s,ref);
   const signed=signLocalGuideXml({issuerRuc:s.issuer.ruc,documentType:s.documentType,fullNumber:x.fullNumber,unsignedXml:x.xml},pki.issuer.pkcs12,pki.password);
   expect(verifyLocalSignedInvoice(signed.xml,pki.issuer.certificatePem,x.xml,'DespatchAdvice')).toBe(signed.digestValue);
   const changed=s.documentType==='09'?signed.xml.replace('000123456789','000123456780'):signed.xml.replace('100.5','100.6');
   expect(()=>verifyLocalSignedInvoice(changed,pki.issuer.certificatePem,x.xml,'DespatchAdvice')).toThrow();return signed.xml;
  });
  const run=spawnSync('python',[fileURLToPath(new URL('./production-guides-xsd.py',import.meta.url))],{input:JSON.stringify({xmls}),encoding:'utf8',windowsHide:true,timeout:30000});
  expect(run.status,run.stderr).toBe(0);expect(JSON.parse(run.stdout)).toEqual({validated:3});
 },60000);
});
