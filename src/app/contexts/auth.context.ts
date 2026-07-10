/**
 * AuthContext
 * -----------
 * Signal-based Context (state + provider + hook) for authentication.
 *
 * Owns:
 *  - `currentUser`: the authenticated user (or null)
 *  - `isAuthenticated`: boolean convenience
 *  - `isTrueAuth`: true when current user came from a fresh server round-trip (vs. restored-from-storage)
 *  - `status`: lifecycle of the in-flight form submission
 *  - `error`: last error message
 *
 * Actions:
 *  - `login({ username, password })` / `login$(...)` — imperative + reactive flavors
 *  - `register({ username, password, displayName })` / `register$(...)`
 *  - `logout()` — clears storage and state, then navigates to '/sign-in'
 *  - `refresh()` — re-reads localStorage so a tab-shared / external change propagates
 *  - `reset()` — clears only in-memory state and errors (no redirect)
 *  - `init()` — restores the snapshot from localStorage; call once on app bootstrap
 *
 * Components consume via useAuthContext() after adding provideAuthContext().
 * Unlike timeline contexts, auth is usually a singleton — provide it once at the
 * root of the app so the whole app shares one current-user signal.
 */
import {
  Injectable,
  Signal,
  computed,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../services/auth.service';
import type { AuthUser, LoginRequest, RegisterRequest } from '../models/auth.model';

/* --------------------------------- State --------------------------------- */

export type AuthStatus = 'idle' | 'submitting' | 'error';

export interface AuthState {
  readonly currentUser: AuthUser | null;
  readonly status: AuthStatus;
  readonly error: string | null;
}

export const INITIAL_AUTH_STATE: AuthState = {
  currentUser: null,
  status: 'idle',
  error: null,
};

/* ------------------------------ Derived ---------------------------------- */

export interface AuthDerived {
  readonly isAuthenticated: Signal<boolean>;
  readonly isSubmitting: Signal<boolean>;
  readonly hasError: Signal<boolean>;
}

/* ------------------------------ Context --------------------------------- */

@Injectable()
export class AuthContext {
  private readonly api = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly currentUser = signal<AuthUser | null>(INITIAL_AUTH_STATE.currentUser);
  private readonly status = signal<AuthStatus>(INITIAL_AUTH_STATE.status);
  private readonly error = signal<string | null>(INITIAL_AUTH_STATE.error);

  /** Public snapshot signal (kept in sync by effects below). */
  readonly state = signal<AuthState>(INITIAL_AUTH_STATE);

  /** Derived signals the UI reads. */
  readonly derived: AuthDerived = {
    isAuthenticated: computed(() => this.currentUser() !== null),
    isSubmitting: computed(() => this.status() === 'submitting'),
    hasError: computed(() => this.status() === 'error'),
  };

  /* ------------------------------- Lifecycle ----------------------------- */

  /**
   * Restore the authenticated user from localStorage if a valid session exists.
   * Call once at app bootstrap. No network request — this is a local restore.
   */
  init(): void {
    const restored = this.api.getStoredUser();
    if (restored && restored.username) {
      this.currentUser.set(restored);
      this.syncState();
    }
  }

  /** Re-read localStorage and update in-memory state. Reflects cross-tab session changes. */
  refresh(): void {
    const restored = this.api.getStoredUser();
    this.currentUser.set(restored);
    this.syncState();
  }

  /** Clear in-memory errors and reset to idle (no storage change, no redirect). */
  reset(): void {
    this.error.set(null);
    this.status.set('idle');
    this.syncState();
  }

  /* ------------------------------- Actions ------------------------------- */

  /**
   * Imperative login — returns nothing; read state.derived for lifecycle.
   * On success: navigates to '/feed'.
   */
  login(req: LoginRequest): void {
    this.runAuth(() => this.api.login(req), '/feed');
  }

  /**
   * Imperative register — returns nothing; read state.derived for lifecycle.
   * On success: navigates to '/feed'.
   */
  register(req: RegisterRequest): void {
    this.runAuth(() => this.api.register(req), '/feed');
  }

  /** Reactive login — returns the Observable so callers can chain/tap. */
  login$(req: LoginRequest) {
    this.status.set('submitting');
    this.error.set(null);
    return this.api.login(req).pipe(takeUntilDestroyed(this.destroyRef));
  }

  /** Reactive register — returns the Observable so callers can chain/tap. */
  register$(req: RegisterRequest) {
    this.status.set('submitting');
    this.error.set(null);
    return this.api.register(req).pipe(takeUntilDestroyed(this.destroyRef));
  }

  /**
   * Log out: clears storage + state, then navigates to '/sign-in'.
   */
  logout(): void {
    this.api.clearStorage();
    this.currentUser.set(null);
    this.error.set(null);
    this.status.set('idle');
    this.syncState();
    this.router.navigateByUrl('/sign-in');
  }

  /* ------------------------------ Internals ------------------------------ */

  /** Run an auth operation, updating status + error + currentUser, then navigate. */
  private runAuth(op: () => ReturnType<AuthService['login']>, onSuccessRedirect: string): void {
    this.status.set('submitting');
    this.error.set(null);

    op()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.currentUser.set(user);
          this.status.set('idle');
          this.syncState();
          this.router.navigateByUrl(onSuccessRedirect);
        },
        error: (err: unknown) => {
          this.status.set('error');
          this.error.set(this.humanizeError(err));
          this.syncState();
        },
      });
  }

  /** Push raw signals into the public `state` snapshot. */
  private syncState(): void {
    this.state.set({
      currentUser: this.currentUser(),
      status: this.status(),
      error: this.error(),
    });
  }

  private humanizeError(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err instanceof Error) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        return 'Network unreachable — please check if the backend API is running.';
      }
      if (err.message.toLowerCase().includes('400') || err.message.toLowerCase().includes('validation')) {
        return 'Invalid credentials or missing fields.';
      }
      return err.message;
    }
    return 'Authentication failed.';
  }
}

/* --------------------------------- Hook ---------------------------------- */

import { InjectionToken, Provider, inject as angularInject } from '@angular/core';

export const AUTH_CONTEXT = new InjectionToken<AuthContext>('AUTH_CONTEXT');

/**
 * Provide App-wide auth as a singleton. Add to app-level providers (or a root
 * component), then consume with useAuthContext() anywhere.
 */
export function provideAuthContext(): Provider {
  return { provide: AUTH_CONTEXT, useClass: AuthContext };
}

/**
 * Hook to consume the AuthContext. Promises a singleton for the whole app.
 */
export function useAuthContext(): AuthContext {
  return angularInject(AUTH_CONTEXT);
}
