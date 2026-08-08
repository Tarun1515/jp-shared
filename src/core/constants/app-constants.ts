/**
 * Client-side mirror of JP.Core.Constants.AppConstants.
 *
 * Only the values the UI genuinely needs are duplicated here. Each one is
 * enforced on the server as well — these exist so a form can show the rule
 * before the user submits, not so the client can decide it.
 */
export const AppConstants = {
  /** Must match AppConstants.Paging on the server. */
  paging: {
    defaultPageNumber: 1,
    defaultPageSize: 20,
    /** The server clamps anything larger; asking for more just wastes a round trip. */
    maxPageSize: 200,
    pageSizeOptions: [10, 20, 50, 100],
  },

  /** Must match AppConstants.Password on the server. */
  password: {
    minLength: 8,
    /**
     * Also a server-side denial-of-service control: PBKDF2 cost scales with
     * input length, so an over-length password is rejected before hashing.
     */
    maxLength: 128,
  },

  /** Must match AppConstants.Otp on the server. */
  otp: {
    length: 6,
    validityMinutes: 10,
    maxVerifyAttempts: 5,
  },

  /** Must match FileStorageOptions in appsettings.json. */
  upload: {
    maxFileSizeKb: 10_240,
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx'],
  },
} as const;
