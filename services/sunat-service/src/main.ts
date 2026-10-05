import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  // JSON con PKCS#12 base64, acotado también por Kong. Nunca logging de bodies.
  app.useBodyParser('json', { limit: '768kb' });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3003), '0.0.0.0');
}
void bootstrap();
