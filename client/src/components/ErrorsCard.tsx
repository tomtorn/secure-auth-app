/**
 * Sentry Errors Card
 * Shows recent errors and issues from Sentry
 * Uses generic Card component for consistent styling
 */

import { useSentryErrors, type SentryIssue } from '../hooks/useMonitoring';
import { formatTimeAgo } from '../lib/utils';
import { Card, CardSkeleton } from './Card';

const IssueRow = ({ issue }: { issue: SentryIssue }): JSX.Element => {
  const levelColors: Record<string, string> = {
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500',
  };

  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-start gap-3">
        <span
          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${levelColors[issue.level] || 'bg-gray-400'}`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate" title={issue.title}>
            {issue.title}
          </p>
          <p className="text-xs text-gray-500 truncate" title={issue.culprit}>
            {issue.culprit}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span>{issue.count} events</span>
            <span>{issue.userCount} users</span>
            <span>{formatTimeAgo(issue.lastSeen)}</span>
          </div>
        </div>
        <span className="text-xs font-mono text-gray-400">{issue.shortId}</span>
      </div>
    </div>
  );
};

export const ErrorsCard = (): JSX.Element => {
  const { data, isLoading, isError } = useSentryErrors();

  if (isLoading) {
    return <CardSkeleton />;
  }

  if (isError) {
    return (
      <Card padding="lg">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Sentry Errors</h3>
        <p className="text-sm text-gray-400">Unable to fetch error data</p>
        <p className="text-xs text-gray-400 mt-1">Configure SENTRY_AUTH_TOKEN to enable</p>
      </Card>
    );
  }

  const hasIssues = data && data.topIssues.length > 0;

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Sentry Errors</h3>
        {data && (
          <div className="flex items-center gap-3 text-xs">
            {data.errorsToday > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full">
                {data.errorsToday} today
              </span>
            )}
            <span className="text-gray-500">{data.unresolvedIssues} unresolved</span>
          </div>
        )}
      </div>

      {/* Issues List */}
      <div className="px-4 max-h-64 overflow-auto">
        {!hasIssues ? (
          <div className="py-8 text-center">
            <div className="text-2xl mb-2">✅</div>
            <p className="text-sm text-gray-600">No unresolved errors</p>
            <p className="text-xs text-gray-400">Your app is running smoothly</p>
          </div>
        ) : (
          data.topIssues.map((issue) => <IssueRow key={issue.id} issue={issue} />)
        )}
      </div>

      {/* Footer */}
      {hasIssues && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <a
            href="https://sentry.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            View all in Sentry →
          </a>
        </div>
      )}
    </Card>
  );
};
