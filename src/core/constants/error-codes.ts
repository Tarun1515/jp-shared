/**
 * Machine-readable codes returned in `ApiResponse.code`.
 *
 * These must match JP.Core.Constants.ErrorCodes on the server exactly.
 * Renaming one is a breaking change on both sides at once.
 */
export const ERROR_CODES = {
  // account state
  accountPending: 'ACCOUNT_PENDING',
  accountRejected: 'ACCOUNT_REJECTED',
  accountSuspended: 'ACCOUNT_SUSPENDED',
  accountLocked: 'ACCOUNT_LOCKED',
  accountResubmitRequired: 'ACCOUNT_RESUBMIT_REQUIRED',
  accountInactive: 'ACCOUNT_INACTIVE',

  // authentication
  invalidCredentials: 'INVALID_CREDENTIALS',
  unauthorized: 'UNAUTHORIZED',
  forbidden: 'FORBIDDEN',
  tokenInvalid: 'TOKEN_INVALID',
  tokenExpired: 'TOKEN_EXPIRED',
  tokenRevoked: 'TOKEN_REVOKED',
  tokenAlreadyUsed: 'TOKEN_ALREADY_USED',

  // OTP
  otpInvalid: 'OTP_INVALID',
  otpExpired: 'OTP_EXPIRED',
  otpMaxAttempts: 'OTP_MAX_ATTEMPTS',

  // password
  passwordReused: 'PASSWORD_REUSED',
  passwordIncorrect: 'PASSWORD_INCORRECT',
  passwordPolicyFailed: 'PASSWORD_POLICY_FAILED',

  // uniqueness
  duplicateEmail: 'DUPLICATE_EMAIL',
  duplicateMobile: 'DUPLICATE_MOBILE',
  duplicateRecord: 'DUPLICATE_RECORD',

  // generic
  validationFailed: 'VALIDATION_FAILED',
  notFound: 'NOT_FOUND',
  businessRuleViolated: 'BUSINESS_RULE_VIOLATED',
  concurrencyConflict: 'CONCURRENCY_CONFLICT',
  rateLimited: 'RATE_LIMITED',
  fileTooLarge: 'FILE_TOO_LARGE',
  fileTypeNotAllowed: 'FILE_TYPE_NOT_ALLOWED',
  internalError: 'INTERNAL_ERROR',
} as const;

/**
 * Codes that mean "you are authenticated, but your account is not usable yet".
 * These route the user to an explanatory screen rather than logging them out —
 * a pending school still needs to reach its document upload page.
 */
export const ACCOUNT_STATE_CODES: readonly string[] = [
  ERROR_CODES.accountPending,
  ERROR_CODES.accountRejected,
  ERROR_CODES.accountSuspended,
  ERROR_CODES.accountLocked,
  ERROR_CODES.accountResubmitRequired,
  ERROR_CODES.accountInactive,
];
