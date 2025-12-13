/**
 * AWS CloudWatch metrics fetcher
 * Lean implementation - single function, no unnecessary abstraction
 */

import {
  CloudWatchClient,
  GetMetricDataCommand,
  type MetricDataQuery,
} from '@aws-sdk/client-cloudwatch';
import { logger } from './logger.js';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const ECS_CLUSTER = process.env.ECS_CLUSTER || 'secure-auth-cluster';
const ECS_SERVICE = process.env.ECS_SERVICE || 'secure-auth-service';
const ALB_ARN = process.env.ALB_ARN_SUFFIX || '';

// Client is initialized lazily to avoid issues in dev without AWS credentials
let cloudwatchClient: CloudWatchClient | null = null;

const getClient = (): CloudWatchClient => {
  if (!cloudwatchClient) {
    cloudwatchClient = new CloudWatchClient({ region: REGION });
  }
  return cloudwatchClient;
};

export interface AwsMetrics {
  cpu: number;
  memory: number;
  requests24h: number;
  errors5xx24h: number;
  latencyMs: number;
  dbConnections: number;
}

export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

export interface MetricTimeSeries {
  cpu: MetricDataPoint[];
  memory: MetricDataPoint[];
}

export const fetchAwsMetrics = async (): Promise<AwsMetrics> => {
  const now = new Date();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const queries: MetricDataQuery[] = [
    // ECS CPU
    {
      Id: 'cpu',
      MetricStat: {
        Metric: {
          Namespace: 'AWS/ECS',
          MetricName: 'CPUUtilization',
          Dimensions: [
            { Name: 'ClusterName', Value: ECS_CLUSTER },
            { Name: 'ServiceName', Value: ECS_SERVICE },
          ],
        },
        Period: 300, // 5 minutes
        Stat: 'Average',
      },
    },
    // ECS Memory
    {
      Id: 'memory',
      MetricStat: {
        Metric: {
          Namespace: 'AWS/ECS',
          MetricName: 'MemoryUtilization',
          Dimensions: [
            { Name: 'ClusterName', Value: ECS_CLUSTER },
            { Name: 'ServiceName', Value: ECS_SERVICE },
          ],
        },
        Period: 300,
        Stat: 'Average',
      },
    },
  ];

  // Add ALB metrics if configured
  if (ALB_ARN) {
    queries.push(
      {
        Id: 'requests',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/ApplicationELB',
            MetricName: 'RequestCount',
            Dimensions: [{ Name: 'LoadBalancer', Value: ALB_ARN }],
          },
          Period: 86400, // 24 hours
          Stat: 'Sum',
        },
      },
      {
        Id: 'errors5xx',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/ApplicationELB',
            MetricName: 'HTTPCode_Target_5XX_Count',
            Dimensions: [{ Name: 'LoadBalancer', Value: ALB_ARN }],
          },
          Period: 86400,
          Stat: 'Sum',
        },
      },
      {
        Id: 'latency',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/ApplicationELB',
            MetricName: 'TargetResponseTime',
            Dimensions: [{ Name: 'LoadBalancer', Value: ALB_ARN }],
          },
          Period: 300,
          Stat: 'Average',
        },
      },
    );
  }

  try {
    const client = getClient();
    const command = new GetMetricDataCommand({
      StartTime: oneDayAgo,
      EndTime: now,
      MetricDataQueries: queries,
    });

    const response = await client.send(command);
    const results = response.MetricDataResults || [];

    const getLatestValue = (id: string): number => {
      const metric = results.find((r) => r.Id === id);
      const values = metric?.Values || [];
      return values.length > 0 ? values[0] : 0;
    };

    const getSumValue = (id: string): number => {
      const metric = results.find((r) => r.Id === id);
      return (metric?.Values || []).reduce((sum, v) => sum + v, 0);
    };

    return {
      cpu: Math.round(getLatestValue('cpu') * 10) / 10,
      memory: Math.round(getLatestValue('memory') * 10) / 10,
      requests24h: Math.round(getSumValue('requests')),
      errors5xx24h: Math.round(getSumValue('errors5xx')),
      latencyMs: Math.round(getLatestValue('latency') * 1000),
      dbConnections: 0,
    };
  } catch (error) {
    logger.warn({ err: error }, 'CloudWatch fetch failed (expected in dev)');
    return {
      cpu: 0,
      memory: 0,
      requests24h: 0,
      errors5xx24h: 0,
      latencyMs: 0,
      dbConnections: 0,
    };
  }
};

/**
 * Fetch CPU/Memory time-series data for charts (last 1 hour, 5-min intervals)
 */
export const fetchMetricTimeSeries = async (): Promise<MetricTimeSeries> => {
  const now = new Date();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const queries: MetricDataQuery[] = [
    {
      Id: 'cpu',
      MetricStat: {
        Metric: {
          Namespace: 'AWS/ECS',
          MetricName: 'CPUUtilization',
          Dimensions: [
            { Name: 'ClusterName', Value: ECS_CLUSTER },
            { Name: 'ServiceName', Value: ECS_SERVICE },
          ],
        },
        Period: 300, // 5-minute intervals
        Stat: 'Average',
      },
    },
    {
      Id: 'memory',
      MetricStat: {
        Metric: {
          Namespace: 'AWS/ECS',
          MetricName: 'MemoryUtilization',
          Dimensions: [
            { Name: 'ClusterName', Value: ECS_CLUSTER },
            { Name: 'ServiceName', Value: ECS_SERVICE },
          ],
        },
        Period: 300,
        Stat: 'Average',
      },
    },
  ];

  try {
    const client = getClient();
    const command = new GetMetricDataCommand({
      StartTime: oneHourAgo,
      EndTime: now,
      MetricDataQueries: queries,
    });

    const response = await client.send(command);
    const results = response.MetricDataResults || [];

    const parseTimeSeries = (id: string): MetricDataPoint[] => {
      const metric = results.find((r) => r.Id === id);
      if (!metric?.Timestamps || !metric?.Values) return [];

      return metric.Timestamps.map((ts, i) => ({
        timestamp: ts.toISOString(),
        value: Math.round((metric.Values?.[i] ?? 0) * 10) / 10,
      })).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    };

    return {
      cpu: parseTimeSeries('cpu'),
      memory: parseTimeSeries('memory'),
    };
  } catch (error) {
    logger.warn({ err: error }, 'CloudWatch time-series fetch failed');
    return { cpu: [], memory: [] };
  }
};
