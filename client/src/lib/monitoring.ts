import * as Sentry from '@sentry/react';

// Sentry integration for error tracking.
// Falls back to console logging when DSN is not configured.

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const IS_PRODUCTION = import.meta.env.PROD;

// Initialize Sentry if DSN is configured
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: IS_PRODUCTION ? 'production' : 'development',

    // Performance monitoring (optional)
    tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0, // 10% in prod, 100% in dev

    // Session replay for debugging (optional)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Don't send errors in development unless DSN is explicitly set
    enabled: IS_PRODUCTION || Boolean(SENTRY_DSN),

    // Filter out noisy errors
    ignoreErrors: ['ResizeObserver loop limit exceeded', 'Network request failed', 'Load failed'],
  });
}

export interface MonitoringEvent {
  name: string;
  data?: Record<string, unknown>;
  level?: 'info' | 'warning' | 'error';
}

/**
 * Report an event to monitoring service.
 * Use for business-level events like failed signouts, auth issues, etc.
 */
export const reportEvent = (event: MonitoringEvent): void => {
  const { name, data = {}, level = 'info' } = event;

  if (SENTRY_DSN) {
    Sentry.addBreadcrumb({
      category: 'app',
      message: name,
      level,
      data,
    });

    if (level === 'error') {
      Sentry.captureMessage(name, {
        level: 'error',
        extra: data,
      });
    }
  } else {
    // Fallback to console in development
    const logFn =
      level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
    logFn(`[Monitoring] ${name}`, data);
  }
};

/**
 * Report an exception to monitoring service.
 */
export const reportException = (error: Error, context?: Record<string, unknown>): void => {
  if (SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  } else {
    console.error('[Monitoring] Exception:', error, context);
  }
};

/**
 * Set user context for monitoring.
 * Call after successful login.
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
 * React Error Boundary wrapper from Sentry.
 * Use in App.tsx to catch React render errors.
 */
export const ErrorBoundary = Sentry.ErrorBoundary;
