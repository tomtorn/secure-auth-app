/**
 * Shared utility functions for the client application
 */

// =============================================================================
// Date/Time Formatting
// =============================================================================

/**
 * Format a date string to a human-readable "time ago" format
 */
export const formatTimeAgo = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

/**
 * Format a timestamp to a localized time string (HH:MM:SS)
 */
export const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/**
 * Format a date to a readable date string (e.g., "Jan 15, 2025")
 */
export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
};

// =============================================================================
// Status Colors - Shared across components
// =============================================================================

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export const STATUS_BADGE_COLORS: Record<StatusType, string> = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-800',
};

export const STATUS_DOT_COLORS: Record<StatusType, string> = {
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-gray-500',
};

// =============================================================================
// String Utilities
// =============================================================================

/**
 * Get the first character of a string, uppercased (for avatars)
 */
export const getInitial = (str: string | null | undefined): string => {
  return str?.charAt(0).toUpperCase() ?? '?';
};

/**
 * Truncate a string to a max length with ellipsis
 */
export const truncate = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
};
