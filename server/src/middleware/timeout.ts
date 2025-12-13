import type { Request, Response, NextFunction } from 'express';

const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds

/**
 * Request timeout middleware.
 * Terminates requests that take too long to prevent hanging connections.
 * Destroys the socket after timeout to free resources.
 *
 * @param timeoutMs - Timeout in milliseconds (default: 30 seconds)
 */
export const requestTimeout = (timeoutMs: number = DEFAULT_TIMEOUT_MS) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    let timedOut = false;

    const handleTimeout = (): void => {
      if (timedOut) return; // Prevent double handling
      timedOut = true;

      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: 'Request timeout',
        });
      }

      // Destroy the socket to free resources
      req.destroy();
    };

    // Set timeout on the request
    req.setTimeout(timeoutMs, handleTimeout);

    // Also set response timeout
    res.setTimeout(timeoutMs, handleTimeout);

    next();
  };
};
