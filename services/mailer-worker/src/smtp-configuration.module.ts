import { Body, Controller, Get, Header, HttpException, Module, Param, Post, Req } from '@nestjs/common';
import { AccessError } from '@factuez/service-access';
import { PrismaService } from './prisma.service';
import { SmtpConfigurationVault } from './smtp-configuration.crypto';
import { SmtpConfigurationStore } from './smtp-configuration.store';
import { SmtpConfigurationService } from './smtp-configuration.service';
import { PreparedCorporateSmtp } from './smtp-configuration.transport';

type AuthorizedRequest = { headers: { authorization?: string } };
@Controller('api/v1/mail-settings')
export class SmtpConfigurationController {
  constructor(private readonly service: SmtpConfigurationService) {}
  private async run<T>(action: () => Promise<T>) {
    try { return await action(); }
    catch (error) { if (error instanceof AccessError) throw new HttpException(error.message, error.status); throw new HttpException('Configuración SMTP no disponible', 503); }
  }
  @Get(':companyId') @Header('Cache-Control', 'private, no-store')
  status(@Param('companyId') companyId: string, @Req() req: AuthorizedRequest) {
    return this.run(() => this.service.status(companyId, req.headers.authorization ?? ''));
  }
  @Post(':companyId') @Header('Cache-Control', 'private, no-store')
  save(@Param('companyId') companyId: string, @Body() body: unknown, @Req() req: AuthorizedRequest) {
    return this.run(() => this.service.save(companyId, body, req.headers.authorization ?? ''));
  }
  @Post(':companyId/dry-run') @Header('Cache-Control', 'private, no-store')
  dryRun(@Param('companyId') companyId: string, @Body() body: unknown, @Req() req: AuthorizedRequest) {
    return this.run(() => this.service.dryRun(companyId, body, req.headers.authorization ?? ''));
  }
}

@Module({ controllers: [SmtpConfigurationController], providers: [PrismaService, SmtpConfigurationStore,
  SmtpConfigurationVault, PreparedCorporateSmtp, SmtpConfigurationService] })
export class SmtpConfigurationModule {}
