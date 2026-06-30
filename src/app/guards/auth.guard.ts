/**
 * Route guards for authenticated access.
 *
 * - authGuard: protects routes that require a signed-in user
 *   (messages, notifications, bookmarks, profile).
 *   The feed and explore pages are PUBLIC — they are not guarded.
 *
 * - publicOnlyGuard: redirects already-authenticated users away from
 *   /auth/sign-in and /auth/sign-up back to the home feed.
 */
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AUTH_CONTEXT, AuthContext } from '../contexts/auth.context';

/** Read the AuthContext from the route's injector. */
function authCtx(): AuthContext {
  return inject(AUTH_CONTEXT);
}

/**
 * Protects routes that require a signed-in user.
 * If there is no currentUser, redirects to '/auth/sign-in'.
 */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return authCtx().derived.isAuthenticated() ? true : router.parseUrl('/auth/sign-in');
};

/**
 * Protects public-only routes like /auth/sign-in and /auth/sign-up.
 * If a user is already authenticated, redirects to the home feed.
 */
export const publicOnlyGuard: CanActivateFn = () => {
  const router = inject(Router);
  return authCtx().derived.isAuthenticated() ? router.parseUrl('/') : true;
};
