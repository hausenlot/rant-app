/**
 * Shared shape for the authenticated user.
 *
 * This mirrors the API's `AuthUser` DTO and what gets persisted to localStorage.
 * Kept minimal — the UI shows id, username, displayName, profileImageUrl.
 */
export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl?: string;
}

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
export interface AuthResponse {
  token: string;
  user?: AuthUser;
  id?: string;
  username?: string;
  displayName?: string;
  profileImageUrl?: string;
}

