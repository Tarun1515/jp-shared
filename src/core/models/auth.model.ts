import { UserStatus, UserType } from '../constants/auth-constants';

/** Raw claim payload decoded from the access token. */
export interface JwtClaims {
  uid: string;
  uuid: string;
  utype: string;
  status: string;
  orgUid?: string;

  /**
   * A JWT serialises a repeated claim as an array, but a single occurrence as
   * a bare string. Both shapes arrive here and are normalised on read.
   */
  roles?: string | string[];
  perms?: string | string[];

  /** Standard JWT expiry, seconds since epoch. */
  exp: number;
  iat?: number;
  jti?: string;
}

/** The signed-in user, derived from the token's claims. */
export interface CurrentUser {
  userId: number;
  userUid: string;
  userType: UserType;
  status: UserStatus;
  organizationUid: string | null;
  roles: string[];
  permissions: string[];
  /** Token expiry as a real date. */
  expiresOn: Date;
}

/** POST /api/auth/login */
export interface LoginRequest {
  loginId: string;
  password: string;
}

/** What the login and refresh endpoints return. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresOn: string;
}

/** POST /api/auth/refresh-token */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/** POST /api/auth/register/school */
export interface RegisterSchoolRequest {
  email: string;
  mobile?: string | null;
  password: string;
}

/** POST /api/auth/register/teacher */
export interface RegisterTeacherRequest {
  /**
   * 🔴 ADDED IN 7B (G43). The signup form has required a name since Phase 1
   * and this interface had no field for it, so the name was collected and
   * dropped before the request left the browser. The database column and the
   * provisioning procedure's @FullName parameter were there all along.
   */
  name: string;

  email: string;
  mobile?: string | null;
  password: string;
}

/** What both registration endpoints return. */
export interface RegistrationResponse {
  userUid: string;
  organizationUid: string | null;
  statusId: number;
  statusCode: string;
}

/** POST /api/auth/forgot-password */
export interface ForgotPasswordRequest {
  email: string;
}

/** POST /api/auth/reset-password */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/** POST /api/auth/set-password-from-invite */
export interface SetPasswordFromInviteRequest {
  token: string;
  password: string;
}

/** POST /api/auth/send-otp — 1 = email, 2 = SMS. */
export interface SendOtpRequest {
  channelId: number;
}

/** POST /api/auth/verify-otp */
export interface VerifyOtpRequest {
  channelId: number;
  code: string;
}

/** GET /api/auth/me */
export interface CurrentUserResponse {
  userUid: string;
  userTypeId: number;
  userTypeCode: string;
  statusId: number;
  statusCode: string;
  statusName: string;
  email: string;
  mobile: string | null;
  isEmailVerified: boolean;
  isMobileVerified: boolean;
  organizationUid: string | null;
  lastLoginOnUtc: string | null;
  lastPasswordChangeOnUtc: string | null;
  createdOnUtc: string;
  rowVersion: number;
  roles: string[];
  permissions: string[];
}

/** The OTP channels the server accepts. */
export const OTP_CHANNEL = {
  email: 1,
  sms: 2,
} as const;
