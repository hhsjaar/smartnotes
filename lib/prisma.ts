import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function getSanitizedDatabaseUrl() {
  let url = process.env.DATABASE_URL || '';
  if (!url) return url;

  // Automatically replace connection_limit=1 with connection_limit=10 to prevent connection pool exhaustion on serverless/Vercel
  if (url.includes('connection_limit=1') && !url.includes('connection_limit=10') && !url.includes('connection_limit=15')) {
    url = url.replace('connection_limit=1', 'connection_limit=10');
  }

  // Ensure pool_timeout=20 is configured
  if (!url.includes('pool_timeout=')) {
    url += (url.includes('?') ? '&' : '?') + 'pool_timeout=20';
  }

  return url;
}

const dbUrl = getSanitizedDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
    log: ['query', 'error', 'warn'],
  });

globalForPrisma.prisma = prisma;
