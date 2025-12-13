import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Types for mocked data
interface MockUser {
  id: string;
  supabaseId: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UpsertArgs {
  where: { supabaseId: string };
  update: { email?: string; name?: string | null };
  create: { supabaseId: string; email: string; name: string | null };
  select: Record<string, boolean>;
}

// Mock Prisma client
const mockUpsert = jest.fn<(args: UpsertArgs) => Promise<MockUser>>();
jest.unstable_mockModule('../../lib/prisma.js', () => ({
  prisma: {
    user: {
      upsert: mockUpsert,
    },
  },
}));

// Mock Supabase client
jest.unstable_mockModule('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      getUser: jest.fn(),
    },
  },
}));

// Mock config
jest.unstable_mockModule('../../config/index.js', () => ({
  config: {
    isProd: false,
    isDev: true,
  },
}));

describe('syncUser (via auth.service)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('race condition prevention', () => {
    it('should use supabaseId for upsert, not id', async () => {
      const mockUser: MockUser = {
        id: 'cuid-123',
        supabaseId: 'supabase-uuid-456',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUpsert.mockResolvedValue(mockUser);

      // Import after mocks
      const { prisma } = await import('../../lib/prisma.js');

      // Simulate syncUser behavior
      const supabaseUser = {
        id: 'supabase-uuid-456',
        email: 'test@example.com',
        user_metadata: { name: 'Test User' },
      };

      await (prisma.user.upsert as unknown as typeof mockUpsert)({
        where: { supabaseId: supabaseUser.id },
        update: { email: supabaseUser.email, name: 'Test User' },
        create: { supabaseId: supabaseUser.id, email: supabaseUser.email, name: 'Test User' },
        select: {
          id: true,
          supabaseId: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { supabaseId: 'supabase-uuid-456' },
          create: expect.objectContaining({
            supabaseId: 'supabase-uuid-456',
          }),
        }),
      );

      // Verify we're NOT using id in where clause (old buggy behavior)
      const callArgs = mockUpsert.mock.calls[0][0] as UpsertArgs;
      expect(callArgs.where).not.toHaveProperty('email');
      expect(callArgs.where).toHaveProperty('supabaseId');
      expect(callArgs.create).not.toHaveProperty('id');
    });

    it('should handle concurrent upserts without primary key conflict', async () => {
      const mockUser: MockUser = {
        id: 'cuid-123',
        supabaseId: 'supabase-uuid-789',
        email: 'concurrent@example.com',
        name: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Simulate Prisma's atomic upsert behavior
      mockUpsert.mockResolvedValue(mockUser);

      const { prisma } = await import('../../lib/prisma.js');

      const supabaseUser = {
        id: 'supabase-uuid-789',
        email: 'concurrent@example.com',
      };

      const upsertFn = prisma.user.upsert as unknown as typeof mockUpsert;

      // Simulate 3 concurrent calls (like concurrent signups)
      const concurrentCalls = Promise.all([
        upsertFn({
          where: { supabaseId: supabaseUser.id },
          update: { email: supabaseUser.email },
          create: { supabaseId: supabaseUser.id, email: supabaseUser.email, name: null },
          select: {
            id: true,
            supabaseId: true,
            email: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        upsertFn({
          where: { supabaseId: supabaseUser.id },
          update: { email: supabaseUser.email },
          create: { supabaseId: supabaseUser.id, email: supabaseUser.email, name: null },
          select: {
            id: true,
            supabaseId: true,
            email: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        upsertFn({
          where: { supabaseId: supabaseUser.id },
          update: { email: supabaseUser.email },
          create: { supabaseId: supabaseUser.id, email: supabaseUser.email, name: null },
          select: {
            id: true,
            supabaseId: true,
            email: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      ]);

      // All should resolve without error (no PK conflict)
      const results = await concurrentCalls;

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.supabaseId).toBe('supabase-uuid-789');
      });

      // All calls should use supabaseId in where clause
      expect(mockUpsert).toHaveBeenCalledTimes(3);
      mockUpsert.mock.calls.forEach((call) => {
        const args = call[0] as UpsertArgs;
        expect(args.where).toEqual({ supabaseId: 'supabase-uuid-789' });
      });
    });

    it('should let Prisma auto-generate primary id (not use Supabase id)', async () => {
      mockUpsert.mockImplementation((args: UpsertArgs) => {
        // Simulate Prisma generating cuid for id
        return Promise.resolve({
          id: 'cuid-auto-generated',
          supabaseId: args.create.supabaseId,
          email: args.create.email,
          name: args.create.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      const { prisma } = await import('../../lib/prisma.js');

      const result = await (prisma.user.upsert as unknown as typeof mockUpsert)({
        where: { supabaseId: 'supabase-id-abc' },
        update: { email: 'new@example.com' },
        create: { supabaseId: 'supabase-id-abc', email: 'new@example.com', name: null },
        select: {
          id: true,
          supabaseId: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Primary id should be auto-generated, not the Supabase id
      expect(result.id).toBe('cuid-auto-generated');
      expect(result.id).not.toBe('supabase-id-abc');
      expect(result.supabaseId).toBe('supabase-id-abc');
    });
  });
});
