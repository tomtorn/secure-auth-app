/**
 * AWS CloudWatch Logs Fetcher
 * Provides recent log entries from ECS container logs
 */

import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
  type FilteredLogEvent,
} from '@aws-sdk/client-cloudwatch-logs';
import { logger } from './logger.js';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const LOG_GROUP = process.env.LOG_GROUP || '/ecs/secure-auth-server';

let logsClient: CloudWatchLogsClient | null = null;

const getClient = (): CloudWatchLogsClient => {
  if (!logsClient) {
    logsClient = new CloudWatchLogsClient({ region: REGION });
  }
  return logsClient;
};

export interface LogEntry {
  timestamp: string;
  message: string;
  logStream: string;
  level: 'info' | 'warn' | 'error' | 'debug';
}

/**
 * Parse log level from Pino JSON log message
 */
const parseLogLevel = (message: string): LogEntry['level'] => {
  try {
    const parsed = JSON.parse(message);
    const level = parsed.level;
    if (level >= 50) return 'error';
    if (level >= 40) return 'warn';
    if (level >= 30) return 'info';
    return 'debug';
  } catch {
    // Not JSON, try to detect from message content
    if (message.toLowerCase().includes('error')) return 'error';
    if (message.toLowerCase().includes('warn')) return 'warn';
    return 'info';
  }
};

/**
 * Format log message for display
 */
const formatLogMessage = (message: string): string => {
  try {
    const parsed = JSON.parse(message);
    // Extract meaningful info from Pino logs
    const msg = parsed.msg || parsed.message || '';
    const req = parsed.req ? `${parsed.req.method} ${parsed.req.url}` : '';
    const res = parsed.res ? `${parsed.res.statusCode}` : '';
    const err = parsed.err?.message || parsed.error?.message || '';

    if (req && res) {
      return `${req} → ${res}`;
    }
    if (err) {
      return `ERROR: ${err}`;
    }
    return msg || message;
  } catch {
    return message;
  }
};

export interface FetchLogsOptions {
  limit?: number;
  startTime?: Date;
  filterPattern?: string;
}

export const fetchCloudWatchLogs = async (options: FetchLogsOptions = {}): Promise<LogEntry[]> => {
  const { limit = 50, startTime, filterPattern } = options;

  try {
    const client = getClient();

    const command = new FilterLogEventsCommand({
      logGroupName: LOG_GROUP,
      startTime: startTime?.getTime() || Date.now() - 60 * 60 * 1000, // Last hour
      limit,
      filterPattern,
    });

    const response = await client.send(command);
    const events = response.events || [];

    return events
      .map((event: FilteredLogEvent) => ({
        timestamp: event.timestamp
          ? new Date(event.timestamp).toISOString()
          : new Date().toISOString(),
        message: formatLogMessage(event.message || ''),
        logStream: event.logStreamName?.split('/').pop() || 'unknown',
        level: parseLogLevel(event.message || ''),
      }))
      .reverse(); // Most recent first
  } catch (error) {
    logger.warn({ err: error }, 'CloudWatch Logs fetch failed (expected in dev)');
    return [];
  }
};

/**
 * Fetch only error logs
 */
export const fetchErrorLogs = async (limit = 20): Promise<LogEntry[]> => {
  return fetchCloudWatchLogs({
    limit,
    filterPattern: '?"level":50 ?"level":40', // Pino error (50) and warn (40)
  });
};
