/**
 * Monitoring Dashboard Schemas
 * Production-ready Zod schemas with TypeScript types
 */

import { z } from 'zod';

// ============================================
// AWS Metrics
// ============================================

export const awsMetricsSchema = z.object({
  cpu: z.number().min(0).max(100),
  memory: z.number().min(0).max(100),
  requests24h: z.number().int().min(0),
  errors5xx24h: z.number().int().min(0),
  latencyMs: z.number().min(0),
  dbConnections: z.number().int().min(0),
});

export type AwsMetrics = z.infer<typeof awsMetricsSchema>;

// ============================================
// Auth Metrics (from auth_events table)
// ============================================

export const authMetricsSchema = z.object({
  totalAuthUsers: z.number().int().min(0),
  signups24h: z.number().int().min(0),
  logins24h: z.number().int().min(0),
  failedLogins24h: z.number().int().min(0),
  dbSizeMb: z.number().min(0),
});

export type AuthMetrics = z.infer<typeof authMetricsSchema>;

// ============================================
// App Metrics
// ============================================

export const appStatusSchema = z.enum(['healthy', 'degraded', 'down']);

export const appMetricsSchema = z.object({
  totalUsers: z.number().int().min(0),
  newUsers7d: z.number().int().min(0),
  newUsers24h: z.number().int().min(0),
  apiStatus: appStatusSchema,
  dbLatencyMs: z.number().min(0),
});

export type AppStatus = z.infer<typeof appStatusSchema>;
export type AppMetrics = z.infer<typeof appMetricsSchema>;

// ============================================
// Combined Monitoring Response
// ============================================

export const monitoringDataSchema = z.object({
  aws: awsMetricsSchema,
  auth: authMetricsSchema,
  app: appMetricsSchema,
  timestamp: z.string().datetime(),
});

export type MonitoringData = z.infer<typeof monitoringDataSchema>;

// ============================================
// API Response Wrappers
// ============================================

export const monitoringResponseSchema = z.object({
  success: z.literal(true),
  data: monitoringDataSchema,
});

export type MonitoringResponse = z.infer<typeof monitoringResponseSchema>;

// ============================================
// Error Response
// ============================================

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

// ============================================
// Auth Events Query (for activity feed)
// ============================================

export const authEventTypeSchema = z.enum(['SIGN_IN', 'SIGN_UP', 'SIGN_OUT', 'SIGN_IN_FAILED']);

export const authEventSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  eventType: authEventTypeSchema,
  success: z.boolean(),
  ipAddress: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type AuthEventType = z.infer<typeof authEventTypeSchema>;
export type AuthEvent = z.infer<typeof authEventSchema>;

// ============================================
// Activity Feed
// ============================================

export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================
// Logs Query (for CloudWatch logs viewer)
// ============================================

export const logsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type LogsQuery = z.infer<typeof logsQuerySchema>;

export const activityResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(authEventSchema),
    hasMore: z.boolean(),
  }),
});

export type ActivityQuery = z.infer<typeof activityQuerySchema>;
export type ActivityResponse = z.infer<typeof activityResponseSchema>;

// ============================================
// Health Check
// ============================================

export const healthStatusSchema = z.enum(['operational', 'degraded', 'down']);

export const healthCheckSchema = z.object({
  status: healthStatusSchema,
  services: z.object({
    api: healthStatusSchema,
    database: healthStatusSchema,
    auth: healthStatusSchema,
  }),
  timestamp: z.string().datetime(),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type HealthCheck = z.infer<typeof healthCheckSchema>;

export const healthResponseSchema = z.object({
  success: z.literal(true),
  data: healthCheckSchema,
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
