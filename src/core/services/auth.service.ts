import { HttpClient } from '@angular/common/http';
import { JP_API_CONFIG } from '../app-identity';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { UserStatus, UserType } from '../constants/auth-constants';
import { ApiResponse } from '../models/api-response.model';
import {
  AuthTokens,
  CurrentUser,
  CurrentUserResponse,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterSchoolRequest,
  RegisterTeacherRequest,
  RegistrationResponse,
  ResetPasswordRequest,
  SendOtpRequest,
  SetPasswordFromInviteRequest,
  VerifyOtpRequest,
} from '../models/auth.model';
import { toCurrentUser } from '../utils/jwt.util';
import { TokenStorageService } from './token-storage.service';

/**
 * Session state and the auth endpoints.
 *
 * The signed-in user is derived from the access token rather than kept as
 * separate state, so there is exactly one source of truth and no way for the
 * two to disagree after a refresh.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(JP_API_CONFIG);
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorageService);

  private readonly baseUrl = `${this.api.ssoApiUrl}/auth`;

  private readonly currentUserSignal = signal<CurrentUser | null>(this.restoreSession());

  /** The signed-in user, or null. */
  readonly currentUser = this.currentUserSignal.asReadonly();

  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  /**
   * Whether the account has cleared verification. A pending school is
   * authenticated but NOT active — it can sign in, but the server refuses
   * business endpoints until an admin approves it.
   */
  readonly isActive = computed(() => this.currentUserSignal()?.status === UserStatus.Active);

  readonly userType = computed(() => this.currentUserSignal()?.userType ?? null);

  readonly organizationUid = computed(() => this.currentUserSignal()?.organizationUid ?? null);

  login(request: LoginRequest): Observable<ApiResponse<AuthTokens>> {
    return this.http
      .post<ApiResponse<AuthTokens>>(`${this.baseUrl}/login`, request)
      .pipe(tap((response) => this.applyTokens(response.data)));
  }

  /**
   * Exchanges the refresh token for a new pair.
   *
   * The server rotates on every use: the old refresh token is revoked and
   * linked to its replacement, so a stolen token stops working the moment the
   * real user refreshes.
   */
  refreshToken(): Observable<ApiResponse<AuthTokens>> {
    const refreshToken = this.tokenStorage.getRefreshToken();

    return this.http
      .post<ApiResponse<AuthTokens>>(`${this.baseUrl}/refresh-token`, { refreshToken })
      .pipe(tap((response) => this.applyTokens(response.data)));
  }

  /**
   * Ends the session. Local state is cleared first and unconditionally — if
   * the network call fails, the user must still end up signed out on this
   * device.
   */
  logout(): Observable<ApiResponse<unknown>> {
    const refreshToken = this.tokenStorage.getRefreshToken();
    const request = this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/logout`, { refreshToken });

    this.clearSession();
    return request;
  }

  // ---- registration --------------------------------------------------------

  /**
   * Registers a school. The account is created PENDING and the caller is
   * signed in immediately — a school has to be able to reach its own status
   * and document screens while it waits (2.9), so it gets a real token.
   */
  registerSchool(request: RegisterSchoolRequest): Observable<ApiResponse<RegistrationResponse>> {
    return this.http.post<ApiResponse<RegistrationResponse>>(
      `${this.baseUrl}/register/school`,
      request,
    );
  }

  /** Registers a teacher. Active immediately — verification is a badge, not a gate. */
  registerTeacher(request: RegisterTeacherRequest): Observable<ApiResponse<RegistrationResponse>> {
    return this.http.post<ApiResponse<RegistrationResponse>>(
      `${this.baseUrl}/register/teacher`,
      request,
    );
  }

  // ---- password ------------------------------------------------------------

  /**
   * Starts a password reset.
   *
   * The server answers identically whether the address has an account or not,
   * and takes the same time doing it. This client must not undo that by
   * behaving differently on the two responses — there is only one response.
   */
  forgotPassword(request: ForgotPasswordRequest): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/forgot-password`, request);
  }

  resetPassword(request: ResetPasswordRequest): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/reset-password`, request);
  }

  setPasswordFromInvite(
    request: SetPasswordFromInviteRequest,
  ): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${this.baseUrl}/set-password-from-invite`,
      request,
    );
  }

  // ---- verification --------------------------------------------------------

  sendOtp(request: SendOtpRequest): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/send-otp`, request);
  }

  verifyOtp(request: VerifyOtpRequest): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/verify-otp`, request);
  }

  /** The full profile, roles and permissions. Fresher than the token's claims. */
  me(): Observable<ApiResponse<CurrentUserResponse>> {
    return this.http.get<ApiResponse<CurrentUserResponse>>(`${this.baseUrl}/me`);
  }

  /** Drops local session state without calling the server. */
  clearSession(): void {
    this.tokenStorage.clear();
    this.currentUserSignal.set(null);
  }

  hasRole(...roleCodes: string[]): boolean {
    const roles = this.currentUserSignal()?.roles ?? [];
    return roleCodes.some((required) =>
      roles.some((held) => held.toUpperCase() === required.toUpperCase()),
    );
  }

  hasPermission(permissionCode: string): boolean {
    const permissions = this.currentUserSignal()?.permissions ?? [];
    return permissions.some((held) => held.toUpperCase() === permissionCode.toUpperCase());
  }

  /**
   * Where to go after a successful sign-in.
   *
   * Each app is now single-audience, so this is simply that app's root — the
   * old version branched on user type to pick between /admin, /school and
   * /teacher, which were sections of one application that no longer exists.
   *
   * Landing someone at the wrong app is prevented earlier, by AppAccessService:
   * by the time this is called the utype has already been checked.
   */
  homeRoute(): string {
    return '/';
  }

  private applyTokens(tokens: AuthTokens | null): void {
    if (!tokens?.accessToken) {
      return;
    }

    this.tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
    this.currentUserSignal.set(toCurrentUser(tokens.accessToken));
  }

  /**
   * Rebuilds the session on a page reload.
   *
   * An expired access token is deliberately still accepted here: the refresh
   * token may well be valid, and the auth interceptor will exchange it on the
   * first request. Discarding the session at this point would sign people out
   * every time they reloaded after an hour away.
   */
  private restoreSession(): CurrentUser | null {
    const accessToken = this.tokenStorage.getAccessToken();
    if (!accessToken) {
      return null;
    }

    const user = toCurrentUser(accessToken);
    if (!user) {
      this.tokenStorage.clear();
      return null;
    }

    return user;
  }
}
