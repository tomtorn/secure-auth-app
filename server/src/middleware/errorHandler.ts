import type { ErrorRequestHandler, Request } from 'express';
import { ZodError, ZodIssue } from 'zod';
import { AppError } from '../services/errors.js';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { reportException } from '../lib/monitoring.js';

/**
 * Get request ID from pino-http for error correlation.
 * This allows correlating client-side errors with server logs.
 */
const getRequestId = (req: Request): string | undefined => {
  // pino-http adds 'id' to the request object
  return (req as Request & { id?: string }).id;
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = getRequestId(req);

  // Zod validation errors
  if (err instanceof ZodError) {
    // Fix 1.5: In production, return generic message to avoid leaking schema details
    const errorMessage = config.isProd
      ? 'Validation failed'
      : err.errors.map((e: ZodIssue) => e.message).join(', ');

    // Always log full details server-side with structured logging
    logger.warn({ requestId, validationErrors: err.errors }, 'Validation failed');

    res.status(400).json({
      success: false,
      error: errorMessage,
      ...(requestId && { requestId }), // Include requestId for debugging
    });
    return;
  }

  // Custom application errors
  if (err instanceof AppError) {
    logger.warn(
      { requestId, statusCode: err.statusCode, message: err.message },
      'Application error',
    );
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(requestId && { requestId }),
    });
    return;
  }

  // Unknown errors - log as error level and report to monitoring
  logger.error({ requestId, error: err }, 'Unhandled error');
  reportException(err instanceof Error ? err : new Error(String(err)), {
    requestId,
    path: req.path,
    method: req.method,
  });
  res.status(500).json({
    success: false,
    error: 'Something went wrong',
    ...(requestId && { requestId }), // Help debugging without exposing internals
  });
};
