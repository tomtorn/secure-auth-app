/**
 * Sentry API Client
 * Fetches recent errors and issues from Sentry
 *
 * Requires SENTRY_AUTH_TOKEN and SENTRY_ORG/SENTRY_PROJECT env vars
 */

import { logger } from './logger.js';

const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const SENTRY_ORG = process.env.SENTRY_ORG || 'secure-auth';
const SENTRY_PROJECT = process.env.SENTRY_PROJECT || 'secure-auth-server';
const SENTRY_API_BASE = 'https://sentry.io/api/0';

export interface SentryIssue {
  id: string;
  title: string;
  culprit: string;
  level: 'error' | 'warning' | 'info';
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  status: 'resolved' | 'unresolved' | 'ignored';
  shortId: string;
}

export interface SentryStats {
  totalIssues: number;
  unresolvedIssues: number;
  errorsToday: number;
  topIssues: SentryIssue[];
}

/**
 * Fetch recent issues from Sentry
 */
export const fetchSentryIssues = async (limit = 10): Promise<SentryIssue[]> => {
  if (!SENTRY_AUTH_TOKEN) {
    logger.debug('Sentry API token not configured, skipping');
    return [];
  }

  try {
    const url = `${SENTRY_API_BASE}/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=is:unresolved&limit=${limit}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${SENTRY_AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Sentry API error: ${response.status}`);
    }

    const issues = (await response.json()) as Array<{
      id: string;
      title: string;
      culprit: string;
      level: string;
      count: string;
      userCount: number;
      firstSeen: string;
      lastSeen: string;
      status: string;
      shortId: string;
    }>;

    const validLevels = ['error', 'warning', 'info'] as const;
    const validStatuses = ['resolved', 'unresolved', 'ignored'] as const;

    return issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      culprit: issue.culprit,
      level: validLevels.includes(issue.level as SentryIssue['level'])
        ? (issue.level as SentryIssue['level'])
        : 'error',
      count: parseInt(issue.count, 10) || 0,
      userCount: issue.userCount || 0,
      firstSeen: issue.firstSeen,
      lastSeen: issue.lastSeen,
      status: validStatuses.includes(issue.status as SentryIssue['status'])
        ? (issue.status as SentryIssue['status'])
        : 'unresolved',
      shortId: issue.shortId,
    }));
  } catch (error) {
    logger.warn({ err: error }, 'Sentry API fetch failed');
    return [];
  }
};

/**
 * Get Sentry stats summary
 */
export const fetchSentryStats = async (): Promise<SentryStats> => {
  const issues = await fetchSentryIssues(20);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const errorsToday = issues.filter(
    (i) => new Date(i.lastSeen) >= todayStart && i.level === 'error',
  ).length;

  return {
    totalIssues: issues.length,
    unresolvedIssues: issues.filter((i) => i.status === 'unresolved').length,
    errorsToday,
    topIssues: issues.slice(0, 5),
  };
};
