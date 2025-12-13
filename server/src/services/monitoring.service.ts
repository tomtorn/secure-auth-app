/**
 * Monitoring Service
 * Aggregates metrics from AWS, Prisma, and auth events
 * Lean implementation - no unnecessary abstraction
 */

import { prisma } from '../lib/prisma.js';
import { getCached, setCache } from '../lib/cache.js';
import { fetchAwsMetrics } from '../lib/cloudwatch.js';
import { checkSupabaseHealth } from '../lib/supabase-admin.js';
import { authEventService } from './authEvent.service.js';
import { logger } from '../lib/logger.js';
import type { MonitoringData } from '@secure-auth/schemas';

const CACHE_KEY = 'monitoring:data';
const CACHE_TTL_SECONDS = 60;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;
const DB_LATENCY_DEGRADED_MS = 500;

export const monitoringService = {
  /**
   * Get all monitoring data (cached for 60 seconds)
   */
  getData: async (): Promise<MonitoringData> => {
    // Check cache first
    const cached = getCached<MonitoringData>(CACHE_KEY);
    if (cached) {
      return cached;
    }

    const oneDayAgo = new Date(Date.now() - ONE_DAY_MS);

    // Fetch all metrics in parallel
    const [awsMetrics, appMetrics, authCounts] = await Promise.all([
      fetchAwsMetrics(),
      fetchAppMetrics(),
      authEventService.getCounts(oneDayAgo),
    ]);

    // Auth metrics from auth_events table
    // Note: dbSizeMb would require RDS API call - omitted for simplicity
    const authMetrics = {
      totalAuthUsers: appMetrics.totalUsers,
      signups24h: authCounts.signUps,
      logins24h: authCounts.signIns,
      failedLogins24h: authCounts.signInsFailed,
      dbSizeMb: 0, // TODO: Fetch from RDS DescribeDBInstances if needed
    };

    const data: MonitoringData = {
      aws: awsMetrics,
      auth: authMetrics,
      app: appMetrics,
      timestamp: new Date().toISOString(),
    };

    // Cache the result
    setCache(CACHE_KEY, data, CACHE_TTL_SECONDS);

    return data;
  },

  /**
   * Get recent auth activity
   */
  getActivity: async (limit: number): Promise<{ items: AuthEventRecord[]; hasMore: boolean }> => {
    const events = await prisma.authEvent.findMany({
      take: limit + 1, // Fetch one extra to check hasMore
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        eventType: true,
        success: true,
        ipAddress: true,
        createdAt: true,
      },
    });

    const hasMore = events.length > limit;
    const items = events.slice(0, limit).map((e) => ({
      id: e.id,
      email: e.email,
      eventType: e.eventType,
      success: e.success,
      ipAddress: e.ipAddress,
      createdAt: e.createdAt.toISOString(),
    }));

    return { items, hasMore };
  },

  /**
   * Get system health status
   */
  getHealth: async (): Promise<HealthCheckData> => {
    const startTime = Date.now();

    // Check all services in parallel
    const [dbStatus, authStatus] = await Promise.all([
      checkDatabaseHealth(startTime),
      checkSupabaseHealth(),
    ]);

    const overallStatus =
      dbStatus === 'down' || authStatus === 'down'
        ? 'down'
        : dbStatus === 'degraded' || authStatus === 'degraded'
          ? 'degraded'
          : 'operational';

    return {
      status: overallStatus,
      services: {
        api: 'operational',
        database: dbStatus,
        auth: authStatus,
      },
      timestamp: new Date().toISOString(),
    };
  },
};

const checkDatabaseHealth = async (
  startTime: number,
): Promise<'operational' | 'degraded' | 'down'> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;
    if (latency > DB_LATENCY_DEGRADED_MS) return 'degraded';
    return 'operational';
  } catch {
    return 'down';
  }
};

interface AuthEventRecord {
  id: string;
  email: string;
  eventType: string;
  success: boolean;
  ipAddress: string | null;
  createdAt: string;
}

interface HealthCheckData {
  status: 'operational' | 'degraded' | 'down';
  services: {
    api: 'operational' | 'degraded' | 'down';
    database: 'operational' | 'degraded' | 'down';
    auth: 'operational' | 'degraded' | 'down';
  };
  timestamp: string;
}

/**
 * Fetch application-level metrics from database
 */
const fetchAppMetrics = async (): Promise<MonitoringData['app']> => {
  const startTime = Date.now();

  const oneDayAgo = new Date(Date.now() - ONE_DAY_MS);
  const oneWeekAgo = new Date(Date.now() - ONE_WEEK_MS);

  try {
    const [totalUsers, newUsers7d, newUsers24h] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { createdAt: { gte: oneWeekAgo } },
      }),
      prisma.user.count({
        where: { createdAt: { gte: oneDayAgo } },
      }),
    ]);

    const dbLatencyMs = Date.now() - startTime;

    return {
      totalUsers,
      newUsers7d,
      newUsers24h,
      apiStatus: 'healthy',
      dbLatencyMs,
    };
  } catch (error) {
    logger.error({ err: error }, 'App metrics fetch failed');
    return {
      totalUsers: 0,
      newUsers7d: 0,
      newUsers24h: 0,
      apiStatus: 'down',
      dbLatencyMs: Date.now() - startTime,
    };
  }
};
