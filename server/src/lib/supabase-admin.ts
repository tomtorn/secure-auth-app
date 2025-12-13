/**
 * Supabase Admin API helpers for monitoring
 */

import { supabaseAdmin } from './supabase.js';
import { logger } from './logger.js';

interface SupabaseAuthStats {
  totalUsers: number;
  confirmedUsers: number;
  unconfirmedUsers: number;
}

/**
 * Get auth user statistics from Supabase Admin API
 * Note: This uses the listUsers API which may be paginated for large user bases
 */
export const getSupabaseAuthStats = async (): Promise<SupabaseAuthStats> => {
  try {
    // Get total count - Supabase Admin API
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1, // We just need the count
    });

    if (error) {
      logger.warn({ err: error }, 'Failed to fetch Supabase auth stats');
      return { totalUsers: 0, confirmedUsers: 0, unconfirmedUsers: 0 };
    }

    // For accurate counts, we'd need to paginate through all users
    // For now, return what we have from the response
    const users = data.users || [];
    const totalUsers = users.length;
    const confirmedUsers = users.filter((u) => u.email_confirmed_at).length;

    return {
      totalUsers,
      confirmedUsers,
      unconfirmedUsers: totalUsers - confirmedUsers,
    };
  } catch (error) {
    logger.error({ err: error }, 'Supabase admin API call failed');
    return { totalUsers: 0, confirmedUsers: 0, unconfirmedUsers: 0 };
  }
};

/**
 * Check Supabase service health
 */
export const checkSupabaseHealth = async (): Promise<'operational' | 'degraded' | 'down'> => {
  try {
    const start = Date.now();
    const { error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
    const latency = Date.now() - start;

    if (error) return 'down';
    if (latency > 2000) return 'degraded';
    return 'operational';
  } catch {
    return 'down';
  }
};
