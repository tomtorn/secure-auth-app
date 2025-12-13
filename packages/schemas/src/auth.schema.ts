import { z } from 'zod';
import { userSchema } from './user.schema.js';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  name: z.string().min(1).optional(),
});

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const authSessionSchema = z.object({
  user: userSchema,
  accessToken: z.string(),
  refreshToken: z.string().nullable(),
  expiresIn: z.number().nullable(),
});

export const exchangeTokenSchema = z.object({
  accessToken: z.string().min(1, 'Access token is required'),
  refreshToken: z.string().optional(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type ExchangeTokenInput = z.infer<typeof exchangeTokenSchema>;
