import pino from 'pino';
import pinoHttp from 'pino-http';
import crypto from 'crypto';
import { config } from '../config/index.js';

/**
 * Pino logger instance with environment-aware configuration.
 * - Development: Pretty print with debug level
 * - Production: JSON format with info level
 */
export const logger = pino({
  level: config.isDev ? 'debug' : 'info',
  ...(config.isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
});

/**
 * HTTP request logger middleware.
 * Generates unique requestId for tracing.
 */
export const httpLogger = pinoHttp({
  logger,
  genReqId: () => crypto.randomUUID(),
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  // Don't log health check requests to reduce noise
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});
