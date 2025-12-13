// Re-export all schemas from shared package
export {
  userSchema,
  idParamSchema,
  updateUserSchema,
  getUsersQuerySchema,
  signUpSchema,
  signInSchema,
  authSessionSchema,
  exchangeTokenSchema,
  // Monitoring schemas
  activityQuerySchema,
  logsQuerySchema,
  monitoringDataSchema,
  monitoringResponseSchema,
  errorResponseSchema,
} from '@secure-auth/schemas';

export type {
  User,
  IdParam,
  UpdateUserInput,
  GetUsersQuery,
  SignUpInput,
  SignInInput,
  AuthSession,
  ExchangeTokenInput,
  // Monitoring types
  MonitoringData,
  MonitoringResponse,
  ErrorResponse,
  ActivityQuery,
  ActivityResponse,
  AuthEvent,
  HealthCheck,
} from '@secure-auth/schemas';
