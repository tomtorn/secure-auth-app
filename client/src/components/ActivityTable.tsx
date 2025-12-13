/**
 * Activity log table showing recent auth events
 * Uses shared utilities and Card component
 */

import { useActivity, type AuthEvent } from '../hooks/useActivity';
import { formatTimeAgo, STATUS_BADGE_COLORS } from '../lib/utils';
import { Card, CardSkeleton } from './Card';

const eventTypeLabels: Record<AuthEvent['eventType'], string> = {
  SIGN_IN: 'Sign In',
  SIGN_UP: 'Sign Up',
  SIGN_OUT: 'Sign Out',
  SIGN_IN_FAILED: 'Failed Login',
};

const eventTypeColors: Record<AuthEvent['eventType'], string> = {
  SIGN_IN: STATUS_BADGE_COLORS.success,
  SIGN_UP: STATUS_BADGE_COLORS.info,
  SIGN_OUT: STATUS_BADGE_COLORS.neutral,
  SIGN_IN_FAILED: STATUS_BADGE_COLORS.error,
};

export const ActivityTable = (): JSX.Element => {
  const { data, isLoading, error } = useActivity(10);

  if (isLoading) {
    return <CardSkeleton />;
  }

  if (error) {
    return (
      <Card padding="lg">
        <p className="text-red-600 text-sm">Failed to load activity</p>
      </Card>
    );
  }

  const events = data?.items ?? [];

  return (
    <Card padding="none">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
      </div>

      {events.length === 0 ? (
        <div className="p-6 text-center text-gray-500 text-sm">No activity yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Event</th>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-4 py-2 text-left font-medium">IP</th>
                <th className="px-4 py-2 text-left font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${eventTypeColors[event.eventType]}`}
                    >
                      {eventTypeLabels[event.eventType]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-900 truncate max-w-[200px]">{event.email}</td>
                  <td className="px-4 py-2 text-gray-500 font-mono text-xs">
                    {event.ipAddress || '-'}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{formatTimeAgo(event.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
