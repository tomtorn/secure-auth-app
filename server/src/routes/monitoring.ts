/**
 * Monitoring API Routes
 * Provides system health and metrics data
 *
 * All endpoints require authentication via Supabase
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { monitoringService } from '../services/monitoring.service.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { monitoringRateLimit } from '../middleware/rateLimit.js';
import { activityQuerySchema, logsQuerySchema } from '../schemas/index.js';
import { fetchEcsStatus } from '../lib/ecs.js';
import { fetchCloudWatchLogs } from '../lib/cloudwatch-logs.js';
import { fetchSentryStats } from '../lib/sentry-api.js';
import { fetchMetricTimeSeries } from '../lib/cloudwatch.js';

export const monitoringRouter = Router();

// All monitoring routes require authentication and rate limiting
// Rate limiting prevents DoS on expensive AWS/Sentry API calls
monitoringRouter.use(requireAuth);
monitoringRouter.use(monitoringRateLimit);

/**
 * GET /api/monitoring
 *
 * Returns aggregated monitoring data:
 * - AWS metrics (CPU, memory, requests, errors)
 * - Auth metrics (signups, logins, failed logins)
 * - App metrics (users, latency, status)
 *
 * Response: MonitoringResponse
 * Cache: 60 seconds server-side
 */
monitoringRouter.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await monitoringService.getData();
    res.json({ success: true, data });
  }),
);

/**
 * GET /api/monitoring/activity?limit=20
 *
 * Returns recent authentication activity
 * Query params validated with Zod
 *
 * Response: ActivityResponse
 */
monitoringRouter.get(
  '/activity',
  asyncHandler(async (req: Request, res: Response) => {
    const query = activityQuerySchema.parse(req.query);
    const data = await monitoringService.getActivity(query.limit);
    res.json({ success: true, data });
  }),
);

/**
 * GET /api/monitoring/health
 *
 * Returns detailed system health status
 * Checks: API, Database, Auth service
 *
 * Response: HealthResponse
 */
monitoringRouter.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await monitoringService.getHealth();
    res.json({ success: true, data });
  }),
);

/**
 * GET /api/monitoring/deployments
 *
 * Returns ECS deployment status:
 * - Service status, running/desired counts
 * - Current deployments with task definitions
 * - Task health status
 */
monitoringRouter.get(
  '/deployments',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await fetchEcsStatus();
    res.json({ success: true, data });
  }),
);

/**
 * GET /api/monitoring/logs?limit=50
 *
 * Returns recent CloudWatch logs from ECS container
 * Formatted and parsed from Pino JSON logs
 */
monitoringRouter.get(
  '/logs',
  asyncHandler(async (req: Request, res: Response) => {
    const query = logsQuerySchema.parse(req.query);
    const data = await fetchCloudWatchLogs({ limit: query.limit });
    res.json({ success: true, data });
  }),
);

/**
 * GET /api/monitoring/errors
 *
 * Returns Sentry error stats and recent issues
 * Requires SENTRY_AUTH_TOKEN env var
 */
monitoringRouter.get(
  '/errors',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await fetchSentryStats();
    res.json({ success: true, data });
  }),
);

/**
 * GET /api/monitoring/metrics/timeseries
 *
 * Returns CPU/Memory time-series data for charts
 * Last 1 hour with 5-minute intervals (real CloudWatch data)
 */
monitoringRouter.get(
  '/metrics/timeseries',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await fetchMetricTimeSeries();
    res.json({ success: true, data });
  }),
);
