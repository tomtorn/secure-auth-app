import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

/**
 * Public Supabase client using anon key.
 * Use for user-facing operations (signin, signup, getUser).
 */
export const supabase = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: { persistSession: false },
});

/**
 * Admin Supabase client using service role key.
 * Use for admin operations that bypass RLS (signOut, user management).
 *
 * SECURITY: This client has full access. Only use for server-side admin operations.
 */
export const supabaseAdmin = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
