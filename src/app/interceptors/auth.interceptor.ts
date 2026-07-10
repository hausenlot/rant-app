/**
 * AuthInterceptor
 * ---------------
 * Attaches the bearer token (read straight from localStorage, the canonical
 * source of truth) to every outgoing request that is part of the app's API.
 *
 * 401 handling:
 *  - clears `token` and `user` from localStorage
 *  - redirects the user to '/sign-in'
 *
 * Register via provideHttpClient(withInterceptors([authInterceptor])) in app.config.ts.
 */
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/** Canonical storage key (shared with AuthService). */
const TOKEN_KEY = 'token';
/** Canonical storage key (shared with AuthService). */
const USER_KEY = 'user';

/**
 * Requests that must never carry the auth header — these fire *before* a token
 * exists, and attaching a stale/empty token could short-circuit server logic.
 */
const SKIP_AUTH_PATHS = ['/auth/login', '/auth/register'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // Read the token directly from localStorage — the canonical source of truth.
  const token = localStorage.getItem(TOKEN_KEY);

  // Only attach for our API requests that aren't unauthenticated paths.
  const shouldAttach =
    Boolean(token) &&
    isAppApiUrl(req.url) &&
    !SKIP_AUTH_PATHS.some((p) => req.url.includes(p));

  const outgoing = shouldAttach
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(outgoing).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        router.navigateByUrl('/auth/sign-in');
      }
      return throwError(() => err);
    })
  );
};

/** True when the request is targeting our API (relative /api path or backend IP). */
function isAppApiUrl(url: string): boolean {
  return url.startsWith('/api') || url.includes('/api') || url.startsWith('/hubs') || url.includes('/hubs');
}
