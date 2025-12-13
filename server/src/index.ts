import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { Server } from 'http';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { asyncHandler } from './middleware/asyncHandler.js';
import { requestTimeout } from './middleware/timeout.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { monitoringRouter } from './routes/monitoring.js';
import { webhooksRouter } from './routes/webhooks.js';
import { logger, httpLogger } from './lib/logger.js';
import { checkDatabaseConnection, disconnectDatabase } from './lib/prisma.js';
import { disconnectRedis } from './lib/redis.js';

const app = express();

// Note: Sentry is initialized in lib/monitoring.ts when SENTRY_DSN is set

// Fix 1.6: Trust first proxy (set to number of proxies in front of the server)
// In Kubernetes/AWS ALB typically 1, adjust based on your infrastructure
// WARNING: Setting this incorrectly can allow IP spoofing
app.set('trust proxy', 1);

// Request logging with pino-http (generates requestId for tracing)
app.use(httpLogger);

// Security middleware - explicit configuration for audit compliance
app.use(
  helmet({
    // Content Security Policy - restrict resource loading
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"], // Deny all by default (API doesn't serve HTML)
        frameAncestors: ["'none'"], // Prevent clickjacking
      },
    },
    // Prevent MIME type sniffing
    xContentTypeOptions: true,
    // Strict HTTPS enforcement
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    // Prevent clickjacking
    xFrameOptions: { action: 'deny' },
    // Control referrer information
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Disable DNS prefetching
    dnsPrefetchControl: { allow: false },
    // Don't advertise Express
    hidePoweredBy: true,
  }),
);
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-XSRF-TOKEN'],
  }),
);

// Body parsing with size limit to prevent DoS
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Request timeout (30 seconds) to prevent hanging connections
app.use(requestTimeout());

// Simple liveness probe - minimal info for public access
// Used by ALB health checks; reveals nothing about internal state
app.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});

// Deep health check - verifies database connectivity
// Note: This endpoint is used internally by container health checks
// The response reveals DB state, which is acceptable for internal use
// but consider restricting if exposed publicly
app.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const dbConnected = await checkDatabaseConnection();

    if (!dbConnected) {
      logger.error('Health check failed: Database unreachable');
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'disconnected',
        },
      });
      return;
    }

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
      },
    });
  }),
);

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/monitoring', monitoringRouter);
app.use('/api/webhooks', webhooksRouter);

// Security: RFC 9116 - Vulnerability disclosure policy
// Shows security maturity to interviewers and auditors
app.get('/.well-known/security.txt', (_req, res) => {
  res.type('text/plain').send(`Contact: security@secureauth.dev
Expires: 2026-12-31T23:59:59.000Z
Preferred-Languages: en
Canonical: https://api.secureauth.dev/.well-known/security.txt
Policy: https://secureauth.dev/security-policy
`);
});

// 404 handler - must be before error handler
// Security: Prevents leaking Express internals for undefined routes
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Error handling
app.use(errorHandler);

// Server instance for graceful shutdown
// Using let because it's assigned after gracefulShutdown is defined
// eslint-disable-next-line prefer-const
let server: Server;

// Graceful shutdown handler
const SHUTDOWN_TIMEOUT_MS = 10_000; // 10 seconds

const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Set a timeout to force exit if shutdown takes too long
  const forceExitTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    // Stop accepting new connections
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      logger.info('HTTP server closed');
    }

    // Disconnect from database
    await disconnectDatabase();
    logger.info('Database disconnected');

    // Disconnect from Redis (if connected)
    await disconnectRedis();
    logger.info('Redis disconnected');

    // Clear timeout and exit cleanly
    clearTimeout(forceExitTimeout);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during graceful shutdown');
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection');
  gracefulShutdown('unhandledRejection');
});

// Start server
server = app.listen(config.port, () => {
  logger.info(`Server running on http://localhost:${String(config.port)}`);
});

export { app, server };
