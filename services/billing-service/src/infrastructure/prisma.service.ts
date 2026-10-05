import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '../generated/prisma/client';

function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const passwordPath = process.env.DB_PASSWORD_FILE;
  const user = process.env.DB_USER;
  const database = process.env.DB_NAME;
  if (!passwordPath || !user || !database) throw new Error('DATABASE_URL o DB_PASSWORD_FILE, DB_USER y DB_NAME son obligatorios');
  const password = readFileSync(passwordPath, 'utf8').trim();
  const host = process.env.DB_HOST ?? 'postgres';
  const port = process.env.DB_PORT ?? '5432';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: connectionString(), connectionTimeoutMillis: 5_000 }) });
  }

  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
