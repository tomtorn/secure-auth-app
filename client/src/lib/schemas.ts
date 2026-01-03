import { z } from 'zod';

// Re-export all schemas from shared package
export { userSchema, signInSchema, signUpSchema } from '@secure-auth/schemas';

export type { User, SignInInput, SignUpInput } from '@secure-auth/schemas';

// =============================================================================
// API Response Schemas for Runtime Validation
// =============================================================================

/**
 * Generic API success response wrapper.
 * Use with a data schema: apiSuccessSchema(userSchema)
 */
export const apiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

/**
 * API error response schema.
 */
export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

/**
 * Generic API response (success or error).
 */
export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.union([apiSuccessSchema(dataSchema), apiErrorSchema]);

export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { success: false; error: string };
