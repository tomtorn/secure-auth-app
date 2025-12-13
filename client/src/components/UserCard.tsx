import type { User } from '../lib/schemas';
import { formatDate, getInitial } from '../lib/utils';
import { Card } from './Card';

interface UserCardProps {
  user: User;
}

export const UserCard = ({ user }: UserCardProps): JSX.Element => {
  return (
    <Card padding="lg">
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
          <span className="text-lg font-semibold text-primary-700">
            {getInitial(user.name) !== '?' ? getInitial(user.name) : getInitial(user.email)}
          </span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{user.name ?? 'No name'}</h3>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
        <span className="text-gray-500">Member since</span>
        <span className="text-gray-700 font-medium">{formatDate(user.createdAt)}</span>
      </div>
    </Card>
  );
};
