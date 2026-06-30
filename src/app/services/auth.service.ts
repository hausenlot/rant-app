/**
 * AuthService
 * -----------
 * Auth API wrapper. Talks to the live backend at /api/auth/{login,register}.
 *
 * Wire format (from old frontend + live probe):
 *   POST /api/auth/login    { username, password }  → { token, user? }
 *   POST /api/auth/register { username, password, displayName } → { token, user? }
 *   - `user` may be embedded fields (id/username/displayName/profileImageUrl) or absent
 *   - On absent `user`, id/username/displayName are decoded from the JWT payload
 *
 * Tokens are persisted to localStorage under `token` and `user`, and read by the
 * AuthInterceptor on every outgoing request as `Authorization: Bearer <token>`.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import type { AuthUser } from '../models/auth.model';

/** Login request body. */
export interface LoginRequest {
  username: string;
  password: string;
}

/** Register request body. */
export interface RegisterRequest {
  username: string;
  password: string;
  displayName: string;
}

/** Raw login/register response envelope from the API. */
interface AuthResponse {
  token: string;
  user?: AuthUser;
  id?: string;
  username?: string;
  displayName?: string;
  profileImageUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = 'http://192.168.1.44:5000/api/auth';
  private readonly http = inject(HttpClient);

  /** Canonical storage key for the bearer token (also read by the auth interceptor). */
  static readonly TOKEN_KEY = 'token';
  /** Canonical storage key for the authenticated user snapshot. */
  static readonly USER_KEY = 'user';

  /**
   * Log in with username + password.
   * Persists `token` and `user` to localStorage before emitting the user.
   */
  login(req: LoginRequest): Observable<AuthUser> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, req).pipe(
      map((res) => this.normalizeAndStore(res))
    );
  }

  /**
   * Register a new account.
   * Persists `token` and `user` to localStorage before emitting the user.
   */
  register(req: RegisterRequest): Observable<AuthUser> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, req).pipe(
      map((res) => this.normalizeAndStore(res))
    );
  }

  /** Remove the persisted token/user snapshot. */
  clearStorage(): void {
    localStorage.removeItem(AuthService.TOKEN_KEY);
    localStorage.removeItem(AuthService.USER_KEY);
  }

  /** Read the persisted token (may be null). */
  getToken(): string | null {
    return localStorage.getItem(AuthService.TOKEN_KEY);
  }

  /** Read the persisted user snapshot (may be null / malformed). */
  getStoredUser(): AuthUser | null {
    const raw = localStorage.getItem(AuthService.USER_KEY);
    if (!raw || raw === 'undefined' || raw === 'null') return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  /** True if there is any token stored — cheap pre-check, does not validate. */
  hasStoredToken(): boolean {
    return !!this.getToken();
  }

  /* ------------------------------- Internals ------------------------------ */

  /**
   * Normalizes the API response into an AuthUser and persists both the token
   * and the user snapshot to localStorage. Mirrors the old storeAuth() logic.
   */
  private normalizeAndStore(res: AuthResponse): AuthUser {
    localStorage.setItem(AuthService.TOKEN_KEY, res.token);

    let user: AuthUser;
    if (res.user && res.user.username) {
      user = { ...res.user, profileImageUrl: res.profileImageUrl ?? res.user.profileImageUrl };
    } else if (res.username) {
      user = {
        id: res.id ?? '',
        username: res.username,
        displayName: res.displayName ?? res.username,
        profileImageUrl: res.profileImageUrl,
      };
    } else {
      // Fallback: decode the JWT payload.
      const decoded = this.decodeTokenPayload(res.token);
      user = {
        id: decoded.id ?? '',
        username: decoded.username ?? '',
        displayName: decoded.displayName ?? decoded.username ?? '',
        profileImageUrl: res.profileImageUrl,
      };
    }

    localStorage.setItem(AuthService.USER_KEY, JSON.stringify(user));
    return user;
  }

  /**
   * Decode a JWT's payload claims into a Partial<AuthUser>, returning {} on failure.
   *
   * Handles two claim styles this backend may emit:
   *  - Conventional short keys: sub, nameid, unique_name, name, preferred_username, given_name
   *  - WSFederation fully-qualified URIs (this backend's default for id):
   *      http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier  -> id
   */
  private decodeTokenPayload(token: string): Partial<AuthUser> {
    try {
      const base64 = token.split('.')[1];
      const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
      // Decode UTF-8 safely (handles non-ASCII display names).
      const bytes = new Uint8Array(json.length);
      for (let i = 0; i < json.length; i++) bytes[i] = json.charCodeAt(i);
      const p = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, string>;

      // WSFederation claim URI -> id (fully-qualified, so match by suffix).
      const id =
        p['nameid'] ||
        p['sub'] ||
        p['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ||
        '';

      // Username / display name: prefer the short conventional keys, then the
      // fully-qualified equivalent for `name`.
      const username =
        p['unique_name'] ||
        p['name'] ||
        p['preferred_username'] ||
        p['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
        '';

      const displayName =
        p['given_name'] ||
        p['unique_name'] ||
        p['name'] ||
        p['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] ||
        '';

      return { id, username, displayName };
    } catch {
      return {};
    }
  }
}
