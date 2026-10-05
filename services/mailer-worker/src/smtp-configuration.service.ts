import { Injectable } from '@nestjs/common';
import { AccessError, identity, privateJson } from '@factuez/service-access';
import { SmtpConfigurationVault } from './smtp-configuration.crypto';
import { approvedHost, approvedSmtpHosts, EXTERNAL_SMTP_STATE, parseSmtpCredentials, parseSmtpInput, parseSmtpSettings, type CorporateSmtpConfiguration } from './smtp-configuration.policy';
import { SmtpConfigurationStore, type SmtpIssuer, type StoredSmtpConfiguration } from './smtp-configuration.store';
import { PreparedCorporateSmtp } from './smtp-configuration.transport';

@Injectable()
export class SmtpConfigurationService {
  constructor(private readonly store: SmtpConfigurationStore, private readonly vault: SmtpConfigurationVault,
    private readonly transport: PreparedCorporateSmtp) {}

  /** Valida authVersion actual en Identity y existencia/acceso al RUC en Billing, nunca otra DB. */
  private async context(companyId: string, authorization: string) {
    const user = await identity(authorization, 'document.email');
    if (!user.roles.includes('ADMIN') || user.scope.kind !== 'GLOBAL') throw new AccessError(403, 'Configuración SMTP requiere un administrador general');
    if (!/^[1-9]\d{0,9}$/.test(companyId) || !Number.isSafeInteger(Number(companyId)) || Number(companyId) > 2147483647)
      throw new AccessError(400, 'Emisor SMTP inválido');
    const catalog = await privateJson<{ companies?: Array<{ id: number; ruc: string }> }>(process.env.BILLING_INTERNAL_URL ?? 'http://billing-service:3002',
      '/api/v1/documents/catalog/issuance', authorization);
    if (!Array.isArray(catalog.companies)) throw new AccessError(503, 'No se pudo verificar el emisor SMTP');
    const issuer = catalog.companies.find(row => row && row.id === Number(companyId));
    if (!issuer || typeof issuer.ruc !== 'string' || !/^\d{11}$/.test(issuer.ruc)) throw new AccessError(404, 'Emisor no disponible');
    return { issuer: { companyId: issuer.id, ruc: issuer.ruc }, actorId: user.sub };
  }

  private decode(issuer: SmtpIssuer, row: StoredSmtpConfiguration): CorporateSmtpConfiguration {
    if (row.companyId !== issuer.companyId || row.ruc !== issuer.ruc || !Number.isInteger(row.keyVersion) ||
      row.configurationCipher.split('.')[1] !== String(row.keyVersion)) throw new AccessError(503, 'Integridad de configuración SMTP no verificable');
    const bytes = this.vault.open(row.configurationCipher, { ...issuer, field: 'configuration' });
    try {
      const parsed = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).sort().join(',') !== 'fromAddress,fromName,host,password,port,replyTo,tlsMode,username') throw new Error();
      return { ...parseSmtpSettings({ host: parsed.host, port: parsed.port, tlsMode: parsed.tlsMode, fromName: parsed.fromName,
        fromAddress: parsed.fromAddress, replyTo: parsed.replyTo }), ...parseSmtpCredentials({ username: parsed.username, password: parsed.password }) };
    } catch { throw new AccessError(503, 'Integridad de configuración SMTP no verificable'); }
    finally { bytes.fill(0); }
  }

  private async localStatus(issuer: SmtpIssuer) {
    const storageReady = await this.store.ready();
    const row = storageReady ? await this.store.read(issuer) : null;
    const encryption = this.vault.readiness();
    let config: CorporateSmtpConfiguration | undefined;
    let integrity: 'NOT_CONFIGURED' | 'NOT_CHECKED' | 'VALID' | 'INVALID' = row ? 'NOT_CHECKED' : 'NOT_CONFIGURED';
    if (row && encryption === 'READY') {
      try { config = this.decode(issuer, row); integrity = 'VALID'; } catch { integrity = 'INVALID'; }
    }
    const { username: _username, password: _password, ...settings } = config ?? {} as Partial<CorporateSmtpConfiguration>;
    return { view: { ...issuer, state: EXTERNAL_SMTP_STATE, revision: row?.revision ?? 0, updatedAt: row?.updatedAt ?? null,
      configured: Boolean(row), credentialsConfigured: Boolean(config?.username && config.password),
      settings: config ? settings : null, storageReady, encryption, integrity,
      approvedHostListConfigured: approvedSmtpHosts().length > 0, hostnameApproved: Boolean(config && approvedHost(config.host)),
      networkAttempted: false, dnsValidated: false, smtpAuthenticationVerified: false, deliveredToClient: false, readyToSend: false }, config };
  }

  async status(companyId: string, authorization: string) {
    const { issuer } = await this.context(companyId, authorization);
    return (await this.localStatus(issuer)).view;
  }

  async save(companyId: string, body: unknown, authorization: string) {
    const context = await this.context(companyId, authorization);
    const input = parseSmtpInput(body);
    if (!approvedHost(input.settings.host)) throw new AccessError(400, 'Servidor SMTP no aprobado por el administrador de infraestructura');
    const existing = await this.store.read(context.issuer);
    if ((existing?.revision ?? 0) !== input.expectedRevision) throw new AccessError(409, 'La configuración SMTP cambió; vuelva a consultar antes de guardar');
    const previous = input.credentials ? undefined : existing ? this.decode(context.issuer, existing) : undefined;
    const credentials = input.credentials ?? (previous ? { username: previous.username, password: previous.password } : undefined);
    if (!credentials) throw new AccessError(400, 'Complete usuario y contraseña SMTP para la configuración inicial');
    const config = { ...input.settings, ...credentials };
    this.transport.dryRun(config); // Política local, no conexiones, DNS, verify() ni sendMail().
    const plaintext = Buffer.from(JSON.stringify(config), 'utf8');
    let sealed: { cipher: string; keyVersion: number };
    try { sealed = this.vault.seal(plaintext, { ...context.issuer, field: 'configuration' }); }
    finally { plaintext.fill(0); }
    // Evita admitir una mutación después de revocar la sesión durante la preparación.
    const current = await this.context(companyId, authorization);
    if (current.actorId !== context.actorId || current.issuer.ruc !== context.issuer.ruc) throw new AccessError(401, 'Sesión o emisor cambió; vuelva a consultar');
    await this.store.save(context.issuer, sealed, input.expectedRevision, context.actorId, Boolean(input.credentials));
    return (await this.localStatus(context.issuer)).view;
  }

  async dryRun(companyId: string, body: unknown, authorization: string) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) throw new AccessError(400, 'El diagnóstico local no admite destinatarios ni parámetros de conexión');
    const { issuer } = await this.context(companyId, authorization);
    const { view, config } = await this.localStatus(issuer);
    const locallyPrepared = Boolean(view.storageReady && view.encryption === 'READY' && view.integrity === 'VALID' && config && view.hostnameApproved);
    if (locallyPrepared && config) this.transport.dryRun(config);
    return { companyId: issuer.companyId, ruc: issuer.ruc, state: EXTERNAL_SMTP_STATE, locallyPrepared,
      checks: [
        { code: 'STORAGE', status: view.storageReady ? 'READY' : 'MISSING' },
        { code: 'ENCRYPTION_KEY', status: view.encryption },
        { code: 'CONFIGURATION', status: view.configured ? 'STORED' : 'MISSING' },
        { code: 'AUTHENTICATED_ENCRYPTION', status: view.integrity },
        { code: 'APPROVED_HOST', status: view.hostnameApproved ? 'APPROVED' : view.approvedHostListConfigured ? 'NOT_APPROVED_OR_MISSING' : 'MISSING_ALLOWLIST' },
        { code: 'CREDENTIALS', status: view.credentialsConfigured ? 'STORED' : 'MISSING_OR_NOT_VERIFIABLE' },
        { code: 'TLS_POLICY', status: locallyPrepared ? 'STRICT' : 'NOT_CHECKED' },
        { code: 'DNS_AND_EGRESS', status: 'NOT_TESTED' },
        { code: 'SMTP_AUTHENTICATION', status: 'NOT_TESTED' },
        { code: 'DELIVERY', status: 'DISABLED' },
      ], networkAttempted: false, dnsValidated: false, smtpAuthenticationVerified: false, readyToSend: false, deliveredToClient: false };
  }
}
