import type { FiscalDocumentSnapshot } from '@factuez/contracts';
import { assertFiscalSnapshot, buildInvoiceUbl, buildReceiptSummary } from '@factuez/sunat-core';
import { zipSync } from 'fflate';
import { inspectCertificate } from './certificate-inspector';
import { XmlSignerService } from './xml-signer.service';

/** Preparación criptográfica Beta; el llamador debe acreditar autorización/cadena/CRL antes de iniciar el worker. */
export function prepareBetaXml(snapshot: FiscalDocumentSnapshot, bytes: Buffer, password: string, identifier?: string) {
  if (snapshot.environment !== 'BETA') throw new Error('Producción no admitida');
  assertFiscalSnapshot(snapshot, { mode: 'REAL_PREPARATION' });
  const metadata = inspectCertificate(bytes, password);
  if (metadata.selfSigned || !metadata.digitalSignature || metadata.subjectRucCandidates.length !== 1 ||
    metadata.subjectRucCandidates[0] !== snapshot.issuer.identityNumber) throw new Error('Certificado no vinculado al RUC Beta');
  const signer = new XmlSignerService();
  const document = signer.sign(buildInvoiceUbl(snapshot, { mode: 'REAL_PREPARATION' }), bytes, password);
  const documentFileName = `${snapshot.issuer.identityNumber}-${snapshot.documentTypeCode}-${snapshot.fullNumber}`;
  const request = snapshot.documentTypeCode === '03'
    ? signer.sign(buildReceiptSummary(snapshot, identifier!, 'REAL_PREPARATION'), bytes, password, 'SummaryDocuments') : document;
  const fileName = snapshot.documentTypeCode === '03' ? `${snapshot.issuer.identityNumber}-${identifier}` : documentFileName;
  const zip = Buffer.from(zipSync({ [`${fileName}.xml`]: Buffer.from(request.xml) }, { level: 6, mtime: new Date('2020-01-01T00:00:00Z') }));
  return { document, request, fileName, documentFileName, zip };
}
