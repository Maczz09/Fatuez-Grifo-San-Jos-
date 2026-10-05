import type { FiscalDocumentSnapshot } from '@factuez/contracts';
import { assertFiscalSnapshot, type FiscalValidationMode } from './fiscal-rules';
import { limaIssueDate } from './local-validation';
import { fiscalSnapshotSha256 } from './fiscal-note';
import { buildFiscalBatchSnapshot, buildFiscalBatchUbl } from './fiscal-batch';

/** Snapshot estable del RC inicial. ID técnico independiente del ID de la boleta. */
export function buildReceiptSummarySnapshot(snapshot: FiscalDocumentSnapshot, identifier: string, asOf = new Date().toISOString()) {
  if (snapshot.environment !== 'BETA' || snapshot.documentTypeCode !== '03' || !/^RC-\d{8}-[1-9]\d{0,4}$/.test(identifier))
    throw new Error('RC inicial sólo admite boleta BETA');
  const hash = fiscalSnapshotSha256({ issuerRuc: snapshot.issuer.identityNumber, environment: 'BETA', identifier, memberId: snapshot.documentId });
  // UUIDv8: identificador técnico determinista, no un correlativo comercial.
  const documentId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  const compact = identifier.slice(3, 11);
  return buildFiscalBatchSnapshot({ kind: 'RC', entries: [{ document: { snapshot }, conditionCode: '1' }] }, {
    documentId, identifier, issueDate: `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6)}`, referenceDate: limaIssueDate(snapshot.issueDate),
  }, asOf);
}

/** RC de una boleta, alta, PEN/IGV18. Mismo algoritmo en preparación Beta y fixtures; nunca cambia su RUC. */
export function buildReceiptSummary(snapshot: FiscalDocumentSnapshot, identifier: string, mode: FiscalValidationMode) {
  assertFiscalSnapshot(snapshot, { mode });
  if (mode === 'REAL_PREPARATION') {
    const asOf = new Date().toISOString(); return buildFiscalBatchUbl(buildReceiptSummarySnapshot(snapshot, identifier, asOf), asOf);
  }
  if (snapshot.documentTypeCode !== '03' || snapshot.currencyCode !== 'PEN' || !/^RC-\d{8}-[1-9]\d{0,4}$/.test(identifier))
    throw new Error('Perfil de resumen: una boleta PEN y un identificador RC válido');
  const compact = identifier.slice(3, 11), issue = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6)}`;
  const date = new Date(`${issue}T12:00:00Z`), reference = limaIssueDate(snapshot.issueDate);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== issue || issue < reference)
    throw new Error('Fecha de resumen inválida');
  const x = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
  return `<?xml version="1.0" encoding="UTF-8"?><SummaryDocuments xmlns="urn:sunat:names:specification:ubl:peru:schema:xsd:SummaryDocuments-1" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1"><ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions><cbc:UBLVersionID>2.0</cbc:UBLVersionID><cbc:CustomizationID>1.1</cbc:CustomizationID><cbc:ID>${x(identifier)}</cbc:ID><cbc:ReferenceDate>${reference}</cbc:ReferenceDate><cbc:IssueDate>${issue}</cbc:IssueDate><cac:Signature><cbc:ID>signatureFactuEz</cbc:ID><cac:SignatoryParty><cac:PartyIdentification><cbc:ID>${snapshot.issuer.identityNumber}</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>${x(snapshot.issuer.legalName)}</cbc:Name></cac:PartyName></cac:SignatoryParty><cac:DigitalSignatureAttachment><cac:ExternalReference><cbc:URI>#signatureFactuEz</cbc:URI></cac:ExternalReference></cac:DigitalSignatureAttachment></cac:Signature><cac:AccountingSupplierParty><cbc:CustomerAssignedAccountID>${snapshot.issuer.identityNumber}</cbc:CustomerAssignedAccountID><cbc:AdditionalAccountID>6</cbc:AdditionalAccountID><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>${x(snapshot.issuer.legalName)}</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty><sac:SummaryDocumentsLine><cbc:LineID>1</cbc:LineID><cbc:DocumentTypeCode>03</cbc:DocumentTypeCode><cbc:ID>${snapshot.fullNumber}</cbc:ID><cac:AccountingCustomerParty><cbc:CustomerAssignedAccountID>${x(snapshot.customer.identityNumber)}</cbc:CustomerAssignedAccountID><cbc:AdditionalAccountID>${x(snapshot.customer.identityType)}</cbc:AdditionalAccountID></cac:AccountingCustomerParty><cac:Status><cbc:ConditionCode>1</cbc:ConditionCode></cac:Status><sac:TotalAmount currencyID="PEN">${snapshot.totals.payableAmount}</sac:TotalAmount><sac:BillingPayment><cbc:PaidAmount currencyID="PEN">${snapshot.totals.taxableAmount}</cbc:PaidAmount><cbc:InstructionID>01</cbc:InstructionID></sac:BillingPayment><cac:TaxTotal><cbc:TaxAmount currencyID="PEN">${snapshot.totals.igvAmount}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxAmount currencyID="PEN">${snapshot.totals.igvAmount}</cbc:TaxAmount><cac:TaxCategory><cac:TaxScheme><cbc:ID>1000</cbc:ID><cbc:Name>IGV</cbc:Name><cbc:TaxTypeCode>VAT</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal></sac:SummaryDocumentsLine></SummaryDocuments>`;
}
