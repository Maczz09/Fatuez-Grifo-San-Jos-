import 'reflect-metadata';
import { Body, Controller, Get, Header, HttpException, Module, Param, Post, Req } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AccessError } from '@factuez/service-access';
import { PrismaService } from './prisma.service';
import { LocalMail } from './local-mail';
import { LocalCaptureSmtp } from './capture-smtp';
import { SmtpConfigurationModule } from './smtp-configuration.module';
@Controller('api/v1/mail-qa') class MailController {
  constructor(private readonly mail: LocalMail) {}
  private async run<T>(action: () => Promise<T>) { try { return await action(); } catch (error) { if (error instanceof AccessError) throw new HttpException(error.message, error.status); throw error; } }
  @Get(':id') @Header('Cache-Control', 'private, no-store')
  status(@Param('id') id: string, @Req() req: { headers: { authorization?: string } }) { return this.run(() => this.mail.status(id, req.headers.authorization ?? '')); }
  @Post(':id') @Header('Cache-Control', 'private, no-store')
  enqueue(@Param('id') id: string, @Body() body: { recipient?: unknown; format?: unknown }, @Req() req: { headers: { authorization?: string } }) { return this.run(() => this.mail.enqueue(id, body, req.headers.authorization ?? '')); }
}
@Controller('health') class Health { @Get() health() { return { status: 'ok', transport: 'LOCAL_MAILPIT', deliveredToClient: false }; } }
@Module({ imports: [SmtpConfigurationModule], controllers: [MailController, Health], providers: [PrismaService, LocalMail, LocalCaptureSmtp] }) class AppModule {}
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.useBodyParser('json', { limit: '4kb' }); app.enableShutdownHooks(); await app.listen(3004, '0.0.0.0');
}
void bootstrap();
