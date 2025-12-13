#!/usr/bin/env npx ts-node
/* eslint-disable no-console */
/**
 * CLI Script: Cleanup Orphan Users
 *
 * One-time script to remove users from RDS that don't exist in Supabase.
 * Also syncs email verification status for all users.
 *
 * Usage:
 *   npx ts-node src/scripts/cleanup-orphans.ts
 *
 * Or via npm script:
 *   npm run cleanup-orphans
 */

import { syncService } from '../services/sync.service.js';
import { checkDatabaseConnection, disconnectDatabase } from '../lib/prisma.js';

const main = async (): Promise<void> => {
  console.log('🔄 Starting orphan user cleanup...\n');

  try {
    // Check database connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database');
      process.exit(1);
    }
    console.log('✅ Database connected\n');

    // Step 1: Cleanup orphan users
    console.log('Step 1: Cleaning up orphan users...');
    const cleanupResult = await syncService.cleanupOrphanUsers();
    console.log(`   Processed: ${cleanupResult.processed} users`);
    console.log(`   Deleted: ${cleanupResult.deleted} orphan users\n`);

    // Step 2: Sync email verification status
    console.log('Step 2: Syncing email verification status...');
    const syncResult = await syncService.syncEmailVerificationStatus();
    console.log(`   Synced: ${syncResult.synced} users`);
    console.log(`   Updated: ${syncResult.updated} users`);
    console.log(`   Errors: ${syncResult.errors}\n`);

    console.log('✅ Cleanup complete!');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
};

main();
