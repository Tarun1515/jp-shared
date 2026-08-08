/** Mirrors m_sso_user_types. */
export enum UserType {
  Admin = 1,
  School = 2,
  Teacher = 3,
}

/**
 * Mirrors m_sso_user_status.
 *
 * Only `Active` clears the server's [RequireActiveAccount] filter. A pending
 * school genuinely does hold a valid token — it just cannot reach business
 * endpoints yet.
 */
export enum UserStatus {
  PendingApproval = 1,
  Active = 2,
  Rejected = 3,
  Suspended = 4,
  Locked = 5,
  ResubmitRequired = 6,
}

/** Seeded role codes. Mirrors t_sso_roles.RoleCode. */
export const ROLE_CODES = {
  superAdmin: 'SUPER_ADMIN',
  verificationAdmin: 'VERIFICATION_ADMIN',
  moderationAdmin: 'MODERATION_ADMIN',
  schoolOwner: 'SCHOOL_OWNER',
  seniorHr: 'SENIOR_HR',
  hr: 'HR',
  schoolViewer: 'SCHOOL_VIEWER',
  teacher: 'TEACHER',
} as const;

/** Keys used in browser storage. Namespaced so they cannot collide. */
export const STORAGE_KEYS = {
  accessToken: 'jp.accessToken',
  refreshToken: 'jp.refreshToken',
} as const;

/**
 * Claim names inside the access token.
 * Must match JP.Core.Constants.JpClaimTypes.
 */
export const CLAIM_KEYS = {
  userId: 'uid',
  userUid: 'uuid',
  userType: 'utype',
  status: 'status',
  organizationUid: 'orgUid',
  roles: 'roles',
  permissions: 'perms',
} as const;
