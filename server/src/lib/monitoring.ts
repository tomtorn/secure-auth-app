import * as Sentry from '@sentry/node';
import { config } from '../config/index.js';

// Sentry integration for server-side error tracking.
// Errors are also logged via Pino, so this is supplemental.

const SENTRY_DSN = config.sentryDsn;
const IS_PRODUCTION = config.isProd;
const ENV_NAME = IS_PRODUCTION ? 'production' : 'development';

// Initialize Sentry if DSN is configured
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENV_NAME,

    // Performance monitoring - sample 10% in prod, 100% in dev
    tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0,

    // Don't send PII to Sentry
    sendDefaultPii: false,
  });
}

export interface MonitoringEvent {
  name: string;
  data?: Record<string, unknown>;
  level?: 'info' | 'warning' | 'error';
}

/**
 * Report an event to monitoring service.
 * Use for security events, business events, etc.
 */
export const reportEvent = (event: MonitoringEvent): void => {
  const { name, data = {}, level = 'info' } = event;

  if (SENTRY_DSN) {
    Sentry.addBreadcrumb({
      category: 'server',
      message: name,
      level,
      data,
    });

    if (level === 'error' || level === 'warning') {
      Sentry.captureMessage(name, {
        level: level === 'error' ? 'error' : 'warning',
        extra: data,
      });
    }
  }
  // Note: Server already uses Pino logger, so no console fallback needed
};

/**
 * Report an exception to monitoring service.
 */
export const reportException = (error: Error, context?: Record<string, unknown>): void => {
  if (SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
  // Note: Errors are also logged via Pino in error handler
};

/**
 * Set user context for a request.
 * Call in auth middleware after validating user.
 */
export const setMonitoringUser = (user: { id: string; email: string } | null): void => {
  if (SENTRY_DSN) {
    if (user) {
      Sentry.setUser({ id: user.id, email: user.email });
    } else {
      Sentry.setUser(null);
    }
  }
};

/**
 * Security event types for consistent monitoring.
 */
export const SecurityEvents = {
  RATE_LIMIT_EXCEEDED: 'security.rate_limit_exceeded',
  ACCOUNT_LOCKED: 'security.account_locked',
  CSRF_INVALID: 'security.csrf_invalid',
  AUTH_FAILED: 'security.auth_failed',
  SUSPICIOUS_ACTIVITY: 'security.suspicious_activity',
} as const;

/**
 * Report a security event with standard format.
 */
export const reportSecurityEvent = (
  eventType: (typeof SecurityEvents)[keyof typeof SecurityEvents],
  data: { ip?: string; email?: string; path?: string; reason?: string; [key: string]: unknown },
): void => {
  reportEvent({
    name: eventType,
    data: {
      ...data,
      timestamp: new Date().toISOString(),
    },
    level: 'warning',
  });
};
