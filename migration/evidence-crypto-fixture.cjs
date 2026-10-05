'use strict';
// Offline BETA/SYNTHETIC fixtures only. No configuration, credentials, files,
// services or TS/test imports. All RSA private keys remain in factory closures.
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');
const localRequire = createRequire(path.join(__dirname, '..', 'packages', 'evidence-core', 'package.json'));
const forge = localRequire('node-forge');
const { SignedXml } = localRequire('xml-crypto');
const { DOMParser, XMLSerializer } = localRequire('@xmldom/xmldom');
const DS = 'http://www.w3.org/2000/09/xmldsig#';
const EXT = 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2';
const CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';
const CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
const SYNTHETIC_SCOPE = Object.freeze({ environment: 'BETA', datasetClass: 'SYNTHETIC' });
const CERT_PROFILE = Object.freeze({ organization: 'FactuEz SYNTHETIC FICTICIO QA', signerCommonNamePrefix: 'SYNTHETIC FICTICIO QA ',
  rootCommonName: 'SYNTHETIC FICTICIO QA ROOT', organizationIdentifierOid: '2.5.4.97' });
const XML_PROFILE = Object.freeze({ canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256', digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256' });

/** Default fixed hardened profile; optional perturbations are for adversarial synthetic tests. */
function createEvidenceCryptoFixture(options = {}) {
  const rootOptions = options.root ?? {};
  const leafOptions = options.leaf ?? {};
  const rootKeys = forge.pki.rsa.generateKeyPair({ bits: rootOptions.keyBits ?? 2048, e: 65537 });
  const leafKeys = forge.pki.rsa.generateKeyPair({ bits: leafOptions.keyBits ?? 2048, e: 65537 });
  const checkedAt = '2026-10-04T12:00:00.000Z';
  const senderRuc = leafOptions.ruc ?? '00000000099';
  const issuerRuc = '00000000101';
  let serial = 1;
  const makeCertificate = (role, config, root) => {
    const ruc = config.ruc ?? (role === 'root' ? '00000000000' : senderRuc);
    const certificate = forge.pki.createCertificate();
    certificate.publicKey = role === 'root' ? rootKeys.publicKey : leafKeys.publicKey;
    certificate.serialNumber = (++serial).toString(16).padStart(2, '0');
    certificate.validity.notBefore = new Date(config.notBefore ?? (role === 'root' ? '2026-01-01T00:00:00.000Z' : '2026-02-01T00:00:00.000Z'));
    certificate.validity.notAfter = new Date(config.notAfter ?? (role === 'root' ? '2027-12-31T23:59:59.000Z' : '2027-01-01T00:00:00.000Z'));
    certificate.setSubject([
      { name: 'commonName', value: config.commonName ?? (role === 'root' ? CERT_PROFILE.rootCommonName : `${CERT_PROFILE.signerCommonNamePrefix}${ruc}`) },
      { name: 'organizationName', value: config.organization ?? CERT_PROFILE.organization },
      ...(config.identityFields ?? [{ type: CERT_PROFILE.organizationIdentifierOid, value: ruc }]),
    ]);
    certificate.setIssuer(root ? root.subject.attributes : certificate.subject.attributes);
    certificate.setExtensions(config.extensions ?? (role === 'root' ? [
      { name: 'basicConstraints', critical: true, cA: true, pathLenConstraint: 0 },
      { name: 'keyUsage', critical: true, keyCertSign: true, cRLSign: true },
    ] : [
      { name: 'basicConstraints', critical: true, cA: false },
      { name: 'keyUsage', critical: true, digitalSignature: true },
    ]));
    certificate.sign(rootKeys.privateKey, config.sha1 ? forge.md.sha1.create() : forge.md.sha256.create());
    return certificate;
  };
  const root = makeCertificate('root', rootOptions);
  const leaf = makeCertificate('signer', leafOptions, root);
  const rootCertificatePem = forge.pki.certificateToPem(root);
  const certificatePem = forge.pki.certificateToPem(leaf);
  const pinnedRootSha256 = createHash('sha256').update(Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(root)).getBytes(), 'binary')).digest('hex');
  const sign = (xml, kindOrConfig = {}) => {
    const config = typeof kindOrConfig === 'string' ? {} : kindOrConfig;
    if (typeof kindOrConfig === 'string' && new DOMParser().parseFromString(xml, 'application/xml').documentElement.localName !== kindOrConfig) {
      throw new Error('SYNTHETIC_FIXTURE_ROOT_MISMATCH');
    }
    let keyPem = forge.pki.privateKeyToPem(leafKeys.privateKey);
    try {
      const signer = new SignedXml({ privateKey: keyPem, publicCert: certificatePem, ...XML_PROFILE,
        signatureAlgorithm: config.signatureAlgorithm ?? XML_PROFILE.signatureAlgorithm,
        ...(config.keyInfo === 'none' ? { getKeyInfoContent: () => null } : {}),
        ...(config.keyInfo === 'root' ? { getKeyInfoContent: () => SignedXml.getKeyInfoContent({ publicCert: rootCertificatePem }) } : {}),
      });
      for (let i = 0; i < (config.references ?? 1); i++) signer.addReference({
        xpath: config.xpath ?? '/*', isEmptyUri: config.uri === undefined, uri: config.uri,
        transforms: config.transforms ?? [`${DS}enveloped-signature`, XML_PROFILE.canonicalizationAlgorithm],
        digestAlgorithm: config.digestAlgorithm ?? XML_PROFILE.digestAlgorithm,
      });
      signer.computeSignature(xml, { attrs: { Id: 'signatureSyntheticQa' }, location: {
        reference: "/*/*[local-name()='UBLExtensions']/*[local-name()='UBLExtension']/*[local-name()='ExtensionContent']", action: 'append',
      } });
      return signer.getSignedXml();
    } finally { keyPem = ''; }
  };
  return { checkedAt, senderRuc, issuerRuc, certificatePem, rootCertificatePem, pinnedRootSha256, sign,
    issueLeaf: config => forge.pki.certificateToPem(makeCertificate('signer', config, root)),
    issueLeafDer: edit => {
      const asn = forge.pki.certificateToAsn1(makeCertificate('signer', {}, root));
      edit(asn);
      const parts = asn.value;
      const md = forge.md.sha256.create();
      md.update(forge.asn1.toDer(parts[0]).getBytes());
      parts[2].value = '\x00' + rootKeys.privateKey.sign(md);
      return forge.pem.encode({ type: 'CERTIFICATE', body: forge.asn1.toDer(asn).getBytes() });
    },
  };
}

function buildCryptoEvidenceFixture(issuerRuc = '00000000001') {
  if (!/^00000000[0-9]{3}$/.test(issuerRuc)) throw new Error('SYNTHETIC_FIXTURE_RUC_INVALID');
  const fixture = createEvidenceCryptoFixture({ leaf: { ruc: issuerRuc } });
  return { ...fixture, issuerRuc,
    generateSyntheticCdr: (recipientRuc, reference, status, documentTypeCode) => generateSyntheticCdr(recipientRuc, reference, status, fixture.senderRuc, documentTypeCode),
  };
}
/** Unsigned XML; caller signs it with its in-memory fixture closure. */
function generateSyntheticCdr(issuerRuc, reference, status, senderRuc = '00000000001', documentTypeCode) {
  if (!/^00000000[0-9]{3}$/.test(issuerRuc) || !/^00000000[0-9]{3}$/.test(senderRuc) || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(reference)) {
    throw new Error('SYNTHETIC_FIXTURE_CDR_BINDING_INVALID');
  }
  if (!['SIMULATED_ACCEPTED', 'SIMULATED_ACCEPTED_WITH_OBSERVATIONS', 'SIMULATED_REJECTED', 'ACCEPTED', 'ACCEPTED_WITH_OBSERVATIONS', 'REJECTED'].includes(status)) {
    throw new Error('SYNTHETIC_FIXTURE_STATUS_INVALID');
  }
  if (documentTypeCode !== undefined && (typeof documentTypeCode !== 'string' || !/^(?:01|03|07|08)$/.test(documentTypeCode))) {
    throw new Error('SYNTHETIC_FIXTURE_DOCUMENT_TYPE_INVALID');
  }
  return unsignedSyntheticCdr({ issuerRuc, senderRuc, reference, responseReference: reference,
    documentTypeCode,
    responseCode: status.endsWith('REJECTED') ? '2335' : '0',
    notes: status.endsWith('ACCEPTED_WITH_OBSERVATIONS') ? ['Observación FICTICIA SYNTHETIC QA'] : [],
  });
}
function unsignedSyntheticXml(rootKind = 'Invoice', content = '<cbc:ID>QA-001</cbc:ID>') {
  return `<${rootKind} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${rootKind}-2" xmlns:ext="${EXT}" xmlns:cbc="${CBC}" xmlns:cac="${CAC}"><ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>${content}</${rootKind}>`;
}
function unsignedSyntheticCdr(options = {}) {
  const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const party = (name, ruc) => `<cac:${name}><cac:PartyIdentification><cbc:ID>${escape(ruc)}</cbc:ID></cac:PartyIdentification></cac:${name}>`;
  return unsignedSyntheticXml('ApplicationResponse', '<cbc:ID>SYNTHETIC-CDR-QA</cbc:ID>' +
    (options.notes ?? []).map(note => `<cbc:Note>${escape(note)}</cbc:Note>`).join('') +
    party('SenderParty', options.senderRuc ?? '00000000099') + party('ReceiverParty', options.issuerRuc ?? '00000000101') +
    `<cac:DocumentResponse><cac:Response>${options.responseReference === undefined ? '' : `<cbc:ReferenceID>${escape(options.responseReference)}</cbc:ReferenceID>`}` +
    `<cbc:ResponseCode>${escape(options.responseCode ?? '0')}</cbc:ResponseCode><cbc:Description>Resultado FICTICIO SYNTHETIC QA</cbc:Description>` +
    `</cac:Response><cac:DocumentReference><cbc:ID>${escape(options.reference ?? 'FQA1-1')}</cbc:ID>` +
    (options.documentTypeCode === undefined ? '' : `<cbc:DocumentTypeCode>${escape(options.documentTypeCode)}</cbc:DocumentTypeCode>`) +
    '</cac:DocumentReference></cac:DocumentResponse>');
}
function editSyntheticXml(xml, edit) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  edit(document);
  return new XMLSerializer().serializeToString(document);
}
/** Mutates only public DER of an in-memory generated fixture. */
function corruptSyntheticCertificate(pem) {
  const certificate = forge.pki.certificateFromPem(pem);
  const asn = forge.pki.certificateToAsn1(certificate);
  const signature = asn.value[2].value;
  asn.value[2].value = signature.slice(0, -1) + String.fromCharCode(signature.charCodeAt(signature.length - 1) ^ 1);
  return forge.pem.encode({ type: 'CERTIFICATE', body: forge.asn1.toDer(asn).getBytes() });
}
module.exports = Object.freeze({ DS, EXT, CBC, CAC, SYNTHETIC_SCOPE, createEvidenceCryptoFixture, unsignedSyntheticCdr,
  buildCryptoEvidenceFixture, generateSyntheticCdr, unsignedSyntheticXml, editSyntheticXml, corruptSyntheticCertificate });
