import { PrismaClient, Prisma } from '@prisma/client';
import { config } from '../config/index.js';
import { logger } from './logger.js';

// =============================================================================
// Configuration
// =============================================================================

const SLOW_QUERY_THRESHOLD_MS = 1000; // Log queries taking > 1 second
const CONNECTION_TIMEOUT_MS = 10000; // 10 second connection timeout

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// =============================================================================
// Prisma Client Factory
// =============================================================================

const createPrismaClient = (): PrismaClient => {
  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

  // Log slow queries in all environments
  client.$on('query', (e: Prisma.QueryEvent) => {
    if (e.duration > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn(
        {
          event: 'slow_query',
          duration: e.duration,
          query: config.isDev ? e.query : '[redacted]', // Don't log query in prod
        },
        `Slow query detected: ${e.duration}ms`,
      );
    } else if (config.isDev) {
      // In dev, log all queries for debugging
      logger.debug({ query: e.query, duration: e.duration }, 'Query executed');
    }
  });

  // Log errors
  client.$on('error', (e: Prisma.LogEvent) => {
    logger.error({ event: 'prisma_error', message: e.message }, 'Prisma error');
  });

  // Log warnings
  client.$on('warn', (e: Prisma.LogEvent) => {
    logger.warn({ event: 'prisma_warn', message: e.message }, 'Prisma warning');
  });

  return client;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

// Prevent multiple instances in development (hot reload)
if (!config.isProd) {
  globalForPrisma.prisma = prisma;
}

// =============================================================================
// Connection Management
// =============================================================================

let isConnected = false;

/**
 * Ensures the database connection is established.
 * Call this at startup to fail fast if DB is unreachable.
 */
export const ensureConnection = async (): Promise<void> => {
  if (isConnected) return;

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database connection timeout')), CONNECTION_TIMEOUT_MS);
  });

  try {
    await Promise.race([prisma.$connect(), timeoutPromise]);
    isConnected = true;
    logger.info('Database connected');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to database');
    throw error;
  }
};

/**
 * Check database connectivity by running a simple query.
 * Returns true if connected, false otherwise.
 */
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    isConnected = true;
    return true;
  } catch (error) {
    isConnected = false;
    logger.error({ error }, 'Database health check failed');
    return false;
  }
};

/**
 * Gracefully disconnect from the database.
 * Call this during shutdown.
 */
export const disconnectDatabase = async (): Promise<void> => {
  isConnected = false;
  await prisma.$disconnect();
  logger.info('Database disconnected');
};
