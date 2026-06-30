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
