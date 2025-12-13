/**
 * CloudWatch Logs Viewer
 * Real-time log viewer with filtering and color coding
 */

import { useState } from 'react';
import { useLogs, type LogEntry } from '../hooks/useMonitoring';
import { formatTime } from '../lib/utils';

const LogLevelBadge = ({ level }: { level: LogEntry['level'] }): JSX.Element => {
  const colors: Record<LogEntry['level'], string> = {
    error: 'bg-red-100 text-red-800',
    warn: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-800',
    debug: 'bg-gray-100 text-gray-600',
  };

  return (
    <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${colors[level]}`}>
      {level.toUpperCase()}
    </span>
  );
};

export const LogsViewer = (): JSX.Element => {
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const { data: logs, isLoading, isError, dataUpdatedAt } = useLogs(100);

  const filteredLogs = logs?.filter((log) => {
    if (filter === 'all') return true;
    if (filter === 'error') return log.level === 'error';
    if (filter === 'warn') return log.level === 'warn' || log.level === 'error';
    return log.level === filter;
  });

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '-';

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-900">Server Logs</h3>
          <span className="text-xs text-gray-500">Updated: {lastUpdated}</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-500">Live</span>
          </span>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1" role="group" aria-label="Log level filters">
          {(['all', 'error', 'warn', 'info'] as const).map((level) => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              aria-pressed={filter === level}
              aria-label={`Filter logs by ${level} level`}
              className={`px-2 py-1 text-xs rounded ${
                filter === level
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Container */}
      <div className="bg-gray-900 text-gray-100 font-mono text-xs overflow-auto max-h-80">
        {isLoading && <div className="p-4 text-gray-500">Loading logs...</div>}

        {isError && <div className="p-4 text-red-400">Failed to load logs</div>}

        {!isLoading && !isError && filteredLogs?.length === 0 && (
          <div className="p-4 text-gray-500">No logs found</div>
        )}

        {filteredLogs?.map((log, idx) => (
          <div
            key={`${log.timestamp}-${idx}`}
            className={`px-4 py-1.5 border-b border-gray-800 hover:bg-gray-800 flex items-start gap-3 ${
              log.level === 'error' ? 'bg-red-900/20' : ''
            }`}
          >
            <span className="text-gray-500 shrink-0">{formatTime(log.timestamp)}</span>
            <LogLevelBadge level={log.level} />
            <span className="text-gray-300 break-all">{log.message}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        Showing {filteredLogs?.length || 0} of {logs?.length || 0} log entries
      </div>
    </div>
  );
};
